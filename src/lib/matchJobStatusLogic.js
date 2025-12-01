
import { supabase } from '@/lib/customSupabaseClient';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, isAfter } from 'date-fns';

/**
 * Gets the current date in EST timezone (start of day)
 */
const getCurrentDateEST = () => {
  const now = new Date();
  const estTime = toZonedTime(now, 'America/New_York');
  return startOfDay(estTime);
};

/**
 * Checks if a due date is one or more full days past today in EST timezone
 * Uses date-only string comparison in EST to avoid timezone parsing issues
 */
export const isOverdueInEST = (dueDateString) => {
  if (!dueDateString) return false;
  
  // Get today's date as a string in EST timezone (yyyy-MM-dd)
  const todayEstString = formatInTimeZone(new Date(), 'America/New_York', 'yyyy-MM-dd');
  
  // Extract just the date part from dueDateString (in case it has time component)
  const dueDateStringOnly = String(dueDateString).split('T')[0];
  
  // Job is overdue if due date string is less than today's date string
  return dueDateStringOnly < todayEstString;
};

// Alias for backwards compatibility
export const isOverdueInESTByDateString = isOverdueInEST;

/**
 * Updates the status of a match request based on the statuses of its individual matches
 * and business rules defined in the requirements.
 */
export const updateJobStatusBasedOnMatches = async (matchRequestId) => {
  try {
    // Get current user's organization to determine which measurements to count
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();
    
    const userOrgId = profile?.organization_id;

    // Get the current job and its measurements
    const { data: jobData, error: jobError } = await supabase
      .from('match_requests')
      .select(`
        id,
        status,
        due_date,
        routed_to_org_id,
        match_measurements (
          id,
          status,
          is_routed
        )
      `)
      .eq('id', matchRequestId)
      .single();

    if (jobError) throw jobError;
    if (!jobData) return;

    let measurements = jobData.match_measurements || [];
    
    // Filter measurements based on organization role - only count "visible" measurements
    if (userOrgId === jobData.routed_to_org_id) {
      // If current user is from routed-to org, only count routed measurements
      measurements = measurements.filter(m => m.is_routed === true);
    }
    // If current user is NOT from routed-to org, count all measurements (no filter needed)
    
    // If no visible measurements exist, keep status as "New"
    if (measurements.length === 0) {
      if (jobData.status !== 'New') {
        await updateJobStatus(matchRequestId, 'New');
      }
      return;
    }

    // Count measurements by status
    const statusCounts = measurements.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {});

    console.log('updateJobStatusBasedOnMatches - statusCounts', statusCounts);
    const totalMeasurements = measurements.length;
    const approvedCount = statusCounts['Approved'] || 0;
    const rejectedCount = statusCounts['Rejected'] || 0;
    const sentCount = statusCounts['Sent for Approval'] || 0;
    const savedCount = statusCounts['Saved'] || 0;
    const newCount = statusCounts['New'] || 0;

    let newStatus = jobData.status;

    // Business logic for status transitions:

    // 1. If any match is rejected -> "Re-Match Required"
    if (rejectedCount > 0) {
      newStatus = 'Re-Match Required';
    }
    // 2. If all matches are approved -> "Approved"
    else if (approvedCount === totalMeasurements) {
      newStatus = 'Approved';
    }
    // 3. If all matches are sent/approved/rejected (no new/saved) -> "Pending Approval"
    else if ((sentCount + approvedCount + rejectedCount) === totalMeasurements && (newCount + savedCount) === 0) {
      newStatus = 'Pending Approval';
    }
    // 4. If at least one match is saved/sent -> "In Progress"
    else if ((savedCount + sentCount + approvedCount + rejectedCount) > 0) {
      newStatus = 'In Progress';
    }
    // 5. If all matches are new -> "New"
    else if (newCount === totalMeasurements) {
      newStatus = 'New';
    }

    // 6. Check if due date has passed by one or more full days in EST (overrides other statuses except Approved/Re-Match Required)
    if (isOverdueInEST(jobData.due_date) && !['Approved', 'Re-Match Required'].includes(newStatus)) {
      newStatus = 'Overdue';
    }

    // Update status if it changed
    console.log('updateJobStatusBasedOnMatches - final', { previous: jobData.status, next: newStatus });
    if (newStatus !== jobData.status) {
      await updateJobStatus(matchRequestId, newStatus);
    }

    return newStatus;
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
};

/**
 * Updates the job status in the database
 */
const updateJobStatus = async (matchRequestId, status) => {
  const { error } = await supabase
    .from('match_requests')
    .update({ status })
    .eq('id', matchRequestId);

  if (error) {
    console.error('Error updating match request status:', error);
    throw error;
  }
};

/**
 * Updates an individual match measurement status and then updates the job status accordingly
 * Note: The database trigger will only send notifications to brands for "Sent for Approval" status
 * to avoid notification spam from "Saved" status updates.
 */
export const updateMatchStatusAndJobStatus = async (measurementId, newStatus) => {
  try {
    console.log('📝 updateMatchStatusAndJobStatus - input', { measurementId, newStatus });
    
    // First, update the match measurement status
    const { data: measurementData, error: updateError } = await supabase
      .from('match_measurements')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', measurementId)
      .select('match_request_id')
      .maybeSingle();

    if (updateError) {
      console.error('❌ Failed to update measurement status:', updateError);
      throw updateError;
    }

    // If no rows were affected, check if measurement exists
    if (!measurementData) {
      // Try to read the measurement to distinguish between not found vs RLS denial
      const { data: readCheck, error: readError } = await supabase
        .from('match_measurements')
        .select('id, status')
        .eq('id', measurementId)
        .maybeSingle();
      
      if (readError || !readCheck) {
        throw new Error('Match measurement not found. Please refresh the page and try again.');
      } else {
        throw new Error('Permission denied. You may not have access to update this match status.');
      }
    }

    console.log('✅ Measurement status updated. Request ID:', measurementData?.match_request_id);
    
    // Then update the job status based on all measurements
    // Use try-catch to make this resilient to job status update failures
    if (measurementData?.match_request_id) {
      try {
        await updateJobStatusBasedOnMatches(measurementData.match_request_id);
        console.log('✅ Job status updated successfully');
      } catch (jobStatusError) {
        console.warn('⚠️ Job status update failed, but measurement update succeeded:', jobStatusError);
        // Don't throw this error - the measurement update succeeded
        // Log it but continue - the measurement status change is the primary operation
      }
    }

    return measurementData;
  } catch (error) {
    console.error('❌ Error updating match and job status:', {
      measurementId,
      newStatus,
      error: error.message,
      code: error.code,
      hint: error.hint,
      details: error.details
    });
    throw error;
  }
};

/**
 * Check and update all overdue jobs (can be run as a periodic task)
 */
export const updateOverdueJobs = async () => {
  try {
    // Get yesterday's date in EST timezone as the cutoff (jobs due yesterday or earlier)
    const todayEST = getCurrentDateEST();
    const yesterdayEST = new Date(todayEST);
    yesterdayEST.setDate(yesterdayEST.getDate() - 1);
    const cutoffDate = formatInTimeZone(yesterdayEST, 'America/New_York', 'yyyy-MM-dd');

    const { data: overdueJobs, error } = await supabase
      .from('match_requests')
      .select('id')
      .lte('due_date', cutoffDate)
      .not('status', 'in', '(Approved,Re-Match Required)');

    if (error) throw error;

    if (overdueJobs?.length > 0) {
      const { error: updateError } = await supabase
        .from('match_requests')
        .update({ status: 'Overdue' })
        .in('id', overdueJobs.map(job => job.id));

      if (updateError) throw updateError;
    }

    return overdueJobs?.length || 0;
  } catch (error) {
    console.error('Error updating overdue jobs:', error);
    throw error;
  }
};

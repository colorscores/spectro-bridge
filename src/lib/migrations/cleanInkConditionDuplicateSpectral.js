/**
 * Migration to clean up ink conditions with duplicate spectral data
 * Fixes the issue where backfill created both top-level and measurements-level spectral data
 */

import { supabase } from '@/lib/customSupabaseClient';

/**
 * Clean duplicate spectral data from ink conditions
 * Move top-level spectral data into measurements arrays and remove redundant fields
 * @param {string} organizationId - Organization ID to clean
 * @returns {Promise<{cleaned: number, errors: Array}>}
 */
export const cleanInkConditionDuplicateSpectral = async (organizationId) => {
  const errors = [];
  let cleanedCount = 0;

  try {
    console.log('🧹 Starting ink condition duplicate spectral cleanup for org:', organizationId);

    // Fetch all ink conditions for the organization that might have malformed data
    const { data: inkConditions, error: fetchError } = await supabase
      .from('ink_conditions')
      .select('id, imported_tints, ink_id')
      .eq('organization_id', organizationId)
      .not('imported_tints', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch ink conditions: ${fetchError.message}`);
    }

    console.log(`📋 Found ${inkConditions.length} ink conditions to check`);

    for (const condition of inkConditions) {
      try {
        const cleaned = cleanConditionTints(condition.imported_tints);
        
        if (cleaned.needsUpdate) {
          console.log(`🔧 Cleaning condition ${condition.id}: ${cleaned.duplicatesRemoved} duplicates removed`);
          
          const { error: updateError } = await supabase
            .from('ink_conditions')
            .update({
              imported_tints: cleaned.tints,
              updated_at: new Date().toISOString()
            })
            .eq('id', condition.id);

          if (updateError) {
            throw new Error(`Failed to update condition ${condition.id}: ${updateError.message}`);
          }

          cleanedCount++;
        }
      } catch (conditionError) {
        console.error(`Error cleaning condition ${condition.id}:`, conditionError);
        errors.push({
          conditionId: condition.id,
          error: conditionError.message
        });
      }
    }

    console.log(`✅ Cleanup completed: ${cleanedCount} conditions cleaned, ${errors.length} errors`);
    
    return {
      cleaned: cleanedCount,
      errors
    };

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

/**
 * Clean tints by moving top-level spectral data into measurements and removing duplicates
 * @param {Object|Array} importedTints - The imported tints data
 * @returns {Object} - {tints: cleanedTints, needsUpdate: boolean, duplicatesRemoved: number}
 */
const cleanConditionTints = (importedTints) => {
  if (!importedTints || typeof importedTints !== 'object') {
    return { tints: importedTints, needsUpdate: false, duplicatesRemoved: 0 };
  }

  let needsUpdate = false;
  let duplicatesRemoved = 0;
  const cleanedTints = {};

  // Process each tint in the object structure (expected: {0: {...}, 10: {...}, etc.})
  Object.entries(importedTints).forEach(([key, tint]) => {
    if (key === 'measurement_settings' || key === 'ui_state' || !tint || typeof tint !== 'object') {
      cleanedTints[key] = tint;
      return;
    }

    const cleanedTint = cleanSingleTint(tint);
    
    if (cleanedTint.needsUpdate) {
      needsUpdate = true;
      duplicatesRemoved += cleanedTint.duplicatesRemoved;
    }
    
    cleanedTints[key] = cleanedTint.tint;
  });

  return {
    tints: cleanedTints,
    needsUpdate,
    duplicatesRemoved
  };
};

/**
 * Clean a single tint object
 * @param {Object} tint - The tint object to clean
 * @returns {Object} - {tint: cleanedTint, needsUpdate: boolean, duplicatesRemoved: number}
 */
const cleanSingleTint = (tint) => {
  if (!tint || typeof tint !== 'object') {
    return { tint, needsUpdate: false, duplicatesRemoved: 0 };
  }

  let needsUpdate = false;
  let duplicatesRemoved = 0;
  const cleanedTint = { ...tint };

  // Check if we have both top-level spectral data and measurements with spectral data
  const hasTopLevelSpectral = !!(tint.spectralData || tint.spectral_data || tint.spectral || tint.spectrum);
  const hasMeasurementsWithSpectral = !!(
    tint.measurements && 
    Array.isArray(tint.measurements) && 
    tint.measurements.some(m => m.spectral_data || m.spectralData)
  );

  if (hasTopLevelSpectral && hasMeasurementsWithSpectral) {
    // Remove redundant top-level spectral fields
    delete cleanedTint.spectralData;
    delete cleanedTint.spectral_data;
    delete cleanedTint.spectral;
    delete cleanedTint.spectrum;
    delete cleanedTint.spectral_string;
    
    needsUpdate = true;
    duplicatesRemoved = 1;
    
    console.log(`🧹 Removed duplicate top-level spectral data from tint ${tint.tintPercentage || tint.tint_percentage || 'unknown'}%`);
  } else if (hasTopLevelSpectral && !hasMeasurementsWithSpectral && tint.measurements && Array.isArray(tint.measurements)) {
    // Move top-level spectral data into measurements if measurements exist but don't have spectral data
    const spectralData = tint.spectralData || tint.spectral_data || tint.spectral || tint.spectrum;
    
    cleanedTint.measurements = tint.measurements.map(measurement => ({
      ...measurement,
      spectral_data: measurement.spectral_data || measurement.spectralData || spectralData
    }));
    
    // Remove top-level spectral fields
    delete cleanedTint.spectralData;
    delete cleanedTint.spectral_data;
    delete cleanedTint.spectral;
    delete cleanedTint.spectrum;
    delete cleanedTint.spectral_string;
    
    needsUpdate = true;
    console.log(`🔄 Moved top-level spectral data into measurements for tint ${tint.tintPercentage || tint.tint_percentage || 'unknown'}%`);
  }

  return {
    tint: cleanedTint,
    needsUpdate,
    duplicatesRemoved
  };
};

/**
 * Clean all ink conditions for the current user's organization
 * @returns {Promise<{cleaned: number, errors: Array}>}
 */
export const cleanCurrentOrgInkConditions = async () => {
  try {
    // Get current user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to get user profile: ${profileError.message}`);
    }

    if (!profile?.organization_id) {
      throw new Error('No organization found for current user');
    }

    return await cleanInkConditionDuplicateSpectral(profile.organization_id);
  } catch (error) {
    console.error('Failed to clean current org ink conditions:', error);
    throw error;
  }
};

// Make function available globally for manual execution
if (typeof window !== 'undefined') {
  window.cleanInkConditionDuplicateSpectral = cleanCurrentOrgInkConditions;
}
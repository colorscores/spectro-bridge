import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { normalizeTints, getTintPercentage } from '@/lib/tintsUtils';

export const useAssetHistory = (assetType, assetId) => {
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Early validation to prevent hook errors
  if (!assetId || assetId === 'new' || !assetType) {
    return {
      historyItems: [],
      loading: false,
      error: null,
      refetch: () => {}
    };
  }

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return format(new Date(date), 'MMM dd, yyyy h:mm a');
  };

  const fetchAssetHistory = async () => {
    if (!assetId || !assetType) {
      setHistoryItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const history = [];

      // Get current user's organization context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHistoryItems([]);
        return;
      }

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('organization_id, full_name')
        .eq('id', user.id)
        .single();

      if (!currentProfile?.organization_id) {
        setHistoryItems([]);
        return;
      }

      // Fetch asset-specific history based on asset type
      switch (assetType.toLowerCase()) {
        case 'color':
          await fetchColorHistory(assetId, history);
          break;
        case 'ink':
          await fetchInkHistory(assetId, history);
          break;
        case 'ink condition':
          await fetchInkConditionHistory(assetId, history);
          break;
        case 'substrate':
          await fetchSubstrateHistory(assetId, history);
          break;
        case 'substrate condition':
          await fetchSubstrateConditionHistory(assetId, history);
          break;
        case 'print condition':
          await fetchPrintConditionHistory(assetId, history);
          break;
        default:
          console.warn(`Unknown asset type: ${assetType}`);
      }

      // Sort by date descending (most recent first)
      const sortedHistory = history.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
      
      // Log if no history was found
      if (sortedHistory.length === 0) {
        console.warn('[useAssetHistory] No history items found for:', { assetType, assetId });
      }
      
      setHistoryItems(sortedHistory);

    } catch (err) {
      console.error('[useAssetHistory] Error fetching asset history:', {
        assetType,
        assetId,
        error: err,
        message: err.message,
        details: err.details
      });
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchColorHistory = async (colorId, history) => {
    // Fetch color creation and updates
    const { data: color } = await supabase
      .from('colors')
      .select(`
        *,
        creator:profiles!colors_created_by_fkey(full_name),
        editor:profiles!colors_last_edited_by_fkey(full_name)
      `)
      .eq('id', colorId)
      .single();

    if (color) {
      // Color creation
      history.push({
        id: `color-created-${color.id}`,
        description: 'Color created',
        editedDate: formatDate(color.created_at),
        rawDate: color.created_at,
        editedBy: color.creator?.full_name || 'System'
      });

      // Color updates (if updated_at is different from created_at)
      if (new Date(color.updated_at) > new Date(color.created_at)) {
        history.push({
          id: `color-updated-${color.id}`,
          description: 'Color properties updated',
          editedDate: formatDate(color.updated_at),
          rawDate: color.updated_at,
          editedBy: color.editor?.full_name || 'System'
        });
      }
    }

    // Fetch color measurements
    const { data: measurements } = await supabase
      .from('color_measurements')
      .select('*')
      .eq('color_id', colorId)
      .order('created_at', { ascending: false });

    if (measurements) {
      measurements.forEach(measurement => {
        history.push({
          id: `measurement-${measurement.id}`,
          description: `Measurement added (${measurement.mode})`,
          editedDate: formatDate(measurement.created_at),
          rawDate: measurement.created_at,
          editedBy: 'System'
        });
      });
    }

    // Fetch tag associations
    const { data: tagAssociations } = await supabase
      .from('tag_associations')
      .select(`
        *,
        tag:tags(name)
      `)
      .eq('color_id', colorId)
      .order('created_at', { ascending: false });

    if (tagAssociations) {
      tagAssociations.forEach(association => {
        history.push({
          id: `tag-${association.id}`,
          description: `Tagged as "${association.tag?.name}"`,
          editedDate: formatDate(association.created_at),
          rawDate: association.created_at,
          editedBy: 'System'
        });
      });
    }

    // Fetch color book associations
    const { data: bookAssociations } = await supabase
      .from('color_book_associations')
      .select(`
        *,
        book:color_books(name)
      `)
      .eq('color_id', colorId)
      .order('created_at', { ascending: false });

    if (bookAssociations) {
      bookAssociations.forEach(association => {
        history.push({
          id: `book-${association.id}`,
          description: `Added to color book "${association.book?.name}"`,
          editedDate: formatDate(association.created_at),
          rawDate: association.created_at,
          editedBy: 'System'
        });
      });
    }

    // Fetch match requests for this color
    const { data: matchMeasurements } = await supabase
      .from('match_measurements')
      .select(`
        *,
        match_request:match_requests(job_id, status, created_at)
      `)
      .eq('color_id', colorId)
      .order('created_at', { ascending: false });

    if (matchMeasurements) {
      matchMeasurements.forEach(measurement => {
        history.push({
          id: `match-${measurement.id}`,
          description: `Included in match request (Job: ${measurement.match_request?.job_id})`,
          editedDate: formatDate(measurement.created_at),
          rawDate: measurement.created_at,
          editedBy: 'System'
        });

        // Add status updates if different from created
        if (measurement.status && measurement.status !== 'New' && 
            new Date(measurement.updated_at) > new Date(measurement.created_at)) {
          history.push({
            id: `match-status-${measurement.id}`,
            description: `Match measurement status: ${measurement.status}`,
            editedDate: formatDate(measurement.updated_at),
            rawDate: measurement.updated_at,
            editedBy: measurement.matched_by_name || 'System'
          });
        }
      });
    }
  };

  const fetchInkHistory = async (inkId, history) => {
    const { data: ink } = await supabase
      .from('inks')
      .select('*')
      .eq('id', inkId)
      .single();

    if (ink) {
      history.push({
        id: `ink-created-${ink.id}`,
        description: 'Ink created',
        editedDate: formatDate(ink.created_at),
        rawDate: ink.created_at,
        editedBy: 'System'
      });

      if (new Date(ink.updated_at) > new Date(ink.created_at)) {
        history.push({
          id: `ink-updated-${ink.id}`,
          description: 'Ink properties updated',
          editedDate: formatDate(ink.updated_at),
          rawDate: ink.updated_at,
          editedBy: 'System'
        });
      }
    }

    // Fetch ink conditions
    const { data: conditions } = await supabase
      .from('ink_conditions')
      .select('*')
      .eq('ink_id', inkId)
      .order('created_at', { ascending: false });

    if (conditions) {
      conditions.forEach(condition => {
        history.push({
          id: `condition-${condition.id}`,
          description: `Condition added: ${condition.name}`,
          editedDate: formatDate(condition.created_at),
          rawDate: condition.created_at,
          editedBy: 'System'
        });
      });
    }
  };

  const fetchInkConditionHistory = async (conditionId, history) => {
    console.log('[useAssetHistory] Fetching ink condition history for:', conditionId);
    
    const { data: condition, error: conditionError } = await supabase
      .from('ink_conditions')
      .select(`
        *,
        ink:inks(name),
        substrate:substrates(name)
      `)
      .eq('id', conditionId)
      .maybeSingle();

    if (conditionError) {
      console.error('[useAssetHistory] Error fetching ink condition:', conditionError);
      // Add a fallback history entry to show that we tried
      history.push({
        id: `condition-error-${conditionId}`,
        description: 'Unable to load condition history (permission or data issue)',
        editedDate: formatDate(new Date()),
        rawDate: new Date().toISOString(),
        editedBy: 'System'
      });
      return;
    }

    if (!condition) {
      console.warn('[useAssetHistory] No ink condition found with ID:', conditionId);
      // Add a fallback entry
      history.push({
        id: `condition-notfound-${conditionId}`,
        description: 'Condition not found',
        editedDate: formatDate(new Date()),
        rawDate: new Date().toISOString(),
        editedBy: 'System'
      });
      return;
    }

    console.log('[useAssetHistory] Successfully fetched condition:', condition.name);

    // Creation event
    history.push({
      id: `condition-created-${condition.id}`,
      description: 'Ink condition created',
      editedDate: formatDate(condition.created_at),
      rawDate: condition.created_at,
      editedBy: 'System'
    });

    // Track substrate relationship
    if (condition.substrate) {
      history.push({
        id: `condition-substrate-${condition.id}`,
        description: `Linked to substrate: ${condition.substrate.name}`,
        editedDate: formatDate(condition.created_at),
        rawDate: condition.created_at,
        editedBy: 'System'
      });
    }

    // Track imported tints
    if (condition.imported_tints) {
      const normalizedTints = normalizeTints(condition.imported_tints);
      
      if (normalizedTints && normalizedTints.length > 0) {
        const tintPercentages = normalizedTints
          .map(tint => getTintPercentage(tint))
          .sort((a, b) => a - b)
          .map(pct => `${pct}%`)
          .join(', ');
        
        history.push({
          id: `condition-imported-tints-${condition.id}`,
          description: `Imported tint data added (${tintPercentages})`,
          editedDate: formatDate(condition.created_at),
          rawDate: condition.created_at,
          editedBy: 'System'
        });
      }
    }

    // Track adapted tints
    if (condition.adapted_tints) {
      const normalizedTints = normalizeTints(condition.adapted_tints);
      
      if (normalizedTints && normalizedTints.length > 0) {
        const tintPercentages = normalizedTints
          .map(tint => getTintPercentage(tint))
          .sort((a, b) => a - b)
          .map(pct => `${pct}%`)
          .join(', ');
        
        history.push({
          id: `condition-adapted-tints-${condition.id}`,
          description: `Adapted tint data added (${tintPercentages})`,
          editedDate: formatDate(condition.created_at),
          rawDate: condition.created_at,
          editedBy: 'System'
        });
      }
    }

    // Track spectral data
    if (condition.spectral_data) {
      history.push({
        id: `condition-spectral-${condition.id}`,
        description: 'Spectral measurement data added',
        editedDate: formatDate(condition.created_at),
        rawDate: condition.created_at,
        editedBy: 'System'
      });
    }

    // Track Lab data
    if (condition.lab) {
      history.push({
        id: `condition-lab-${condition.id}`,
        description: 'Lab color data added',
        editedDate: formatDate(condition.created_at),
        rawDate: condition.created_at,
        editedBy: 'System'
      });
    }

    // Track pack type
    if (condition.pack_type) {
      history.push({
        id: `condition-pack-type-${condition.id}`,
        description: `Pack type set: ${condition.pack_type}`,
        editedDate: formatDate(condition.created_at),
        rawDate: condition.created_at,
        editedBy: 'System'
      });
    }

    // Track ink curve
    if (condition.ink_curve && condition.ink_curve !== 'as_measured') {
      const curveDisplay = condition.ink_curve === 'linearized' ? 'Linearized' : 
                          condition.ink_curve === 'optimized' ? 'Optimized' : 
                          condition.ink_curve;
      history.push({
        id: `condition-curve-${condition.id}`,
        description: `Ink curve set: ${curveDisplay}`,
        editedDate: formatDate(condition.created_at),
        rawDate: condition.created_at,
        editedBy: 'System'
      });
    }

    // Update event (if different from creation)
    if (new Date(condition.updated_at) > new Date(condition.created_at)) {
      history.push({
        id: `condition-updated-${condition.id}`,
        description: 'Condition properties updated',
        editedDate: formatDate(condition.updated_at),
        rawDate: condition.updated_at,
        editedBy: 'System'
      });
    }

    // Fetch color approvals for this condition
    const { data: approvals } = await supabase
      .from('ink_condition_color_approvals')
      .select(`
        *,
        approver:profiles!ink_condition_color_approvals_approved_by_fkey(full_name),
        color:colors(name)
      `)
      .eq('ink_condition_id', conditionId)
      .order('created_at', { ascending: false });

    if (approvals) {
      approvals.forEach(approval => {
        history.push({
          id: `approval-${approval.id}`,
          description: `Color "${approval.color?.name}" ${approval.status}`,
          editedDate: formatDate(approval.created_at),
          rawDate: approval.created_at,
          editedBy: approval.approver?.full_name || 'System'
        });
      });
    }
  };

  const fetchSubstrateHistory = async (substrateId, history) => {
    // Similar pattern for substrates - fetch from substrate tables
    // This would need substrate tables to be defined in Supabase
    history.push({
      id: `substrate-placeholder-${substrateId}`,
      description: 'Substrate created',
      editedDate: formatDate(new Date()),
      rawDate: new Date(),
      editedBy: 'System'
    });
  };

  const fetchSubstrateConditionHistory = async (conditionId, history) => {
    // Similar pattern for substrate conditions
    history.push({
      id: `substrate-condition-placeholder-${conditionId}`,
      description: 'Substrate condition created',
      editedDate: formatDate(new Date()),
      rawDate: new Date(),
      editedBy: 'System'
    });
  };

  const fetchPrintConditionHistory = async (conditionId, history) => {
    const { data: condition } = await supabase
      .from('print_conditions')
      .select('*')
      .eq('id', conditionId)
      .single();

    if (condition) {
      history.push({
        id: `print-condition-created-${condition.id}`,
        description: 'Print condition created',
        editedDate: formatDate(condition.created_at),
        rawDate: condition.created_at,
        editedBy: 'System'
      });

      if (new Date(condition.updated_at) > new Date(condition.created_at)) {
        history.push({
          id: `print-condition-updated-${condition.id}`,
          description: 'Print condition updated',
          editedDate: formatDate(condition.updated_at),
          rawDate: condition.updated_at,
          editedBy: 'System'
        });
      }
    }
  };

  useEffect(() => {
    fetchAssetHistory();

    // Set up real-time subscriptions based on asset type
    const channels = [];

    if (assetType.toLowerCase() === 'color') {
      const colorChannel = supabase
        .channel(`color-history-${assetId}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'colors', filter: `id=eq.${assetId}` },
          () => fetchAssetHistory()
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'color_measurements', filter: `color_id=eq.${assetId}` },
          () => fetchAssetHistory()
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'tag_associations', filter: `color_id=eq.${assetId}` },
          () => fetchAssetHistory()
        )
        .subscribe();
      channels.push(colorChannel);
    }

    if (assetType.toLowerCase() === 'ink') {
      const inkChannel = supabase
        .channel(`ink-history-${assetId}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'inks', filter: `id=eq.${assetId}` },
          () => fetchAssetHistory()
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'ink_conditions', filter: `ink_id=eq.${assetId}` },
          () => fetchAssetHistory()
        )
        .subscribe();
      channels.push(inkChannel);
    }

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [assetId, assetType]);

  return { historyItems, loading, error, refetch: fetchAssetHistory };
};
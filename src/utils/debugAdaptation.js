// Debug utility to test adaptation logic in browser console
// Usage: window.debugAdaptation()

export const debugAdaptation = async () => {
  console.log('🔍 Debug adaptation utility loaded. Open dev console and run:');
  console.log('window.debugAdaptation()');
  
  // Import backfill utility
  const { backfillAdaptedTintsForCondition } = await import('@/utils/backfillAdaptedTints');
  window.backfillAdaptedTints = backfillAdaptedTintsForCondition;

  // Make functions available globally for debugging
  window.debugAdaptation = async () => {
    console.log('🚀 Starting adaptation debugging...');
    
    // Get current ink condition from URL
    const url = window.location.pathname;
    const conditionMatch = url.match(/\/conditions\/([^\/]+)/);
    
    if (!conditionMatch) {
      console.log('❌ Not on an ink condition page');
      return;
    }
    
    const conditionId = conditionMatch[1];
    console.log('📍 Current condition ID:', conditionId);
    
    // Import required modules dynamically
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Fetch current condition data
    try {
      const { data: condition, error } = await supabase
        .from('ink_conditions')
        .select('*')
        .eq('id', conditionId)
        .single();
        
      if (error) throw error;
      
      console.log('📊 Current condition data:', {
        id: condition.id,
        name: condition.name,
        hasImportedTints: !!condition.imported_tints,
        importedTintsCount: condition.imported_tints?.length || 0,
        hasAdaptedTints: !!condition.adapted_tints,
        adaptedTintsCount: condition.adapted_tints?.length || 0,
        measurementSettings: condition.measurement_settings,
        uiState: condition.ui_state
      });
      
      // Check for 0% tint in imported data
      if (condition.imported_tints) {
        const zeroTint = condition.imported_tints.find(tint => 
          (tint.tintPercentage || tint.tint_percentage || 0) === 0
        );
        console.log('🎯 Zero percent tint found:', !!zeroTint);
        if (zeroTint) {
          console.log('   - Has spectral data:', !!zeroTint.spectralData || !!zeroTint.spectral_data);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to fetch condition:', error);
    }
  };
  
  // Also expose individual debug functions
  window.debugEffectiveMode = async (importedTints, selectedCondition, assignedCondition) => {
    const { getEffectiveDataMode } = await import('@/lib/substrateAdaptationUtils');
    const { useAstmTablesCache } = await import('@/hooks/useAstmTablesCache');
    
    // This is a simplified test - in real usage you'd need proper React context
    console.log('🧪 Testing effective mode calculation...');
    console.log('Result would depend on real ASTM tables and org defaults');
  };
};

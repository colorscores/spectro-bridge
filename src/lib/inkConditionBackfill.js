/**
 * Backfill utility to add measurements arrays to existing ink conditions
 * This resolves the issue where mode switching doesn't work due to missing per-tint measurements
 */

import { supabase } from '@/integrations/supabase/client';
import { normalizeTints } from '@/lib/tintsUtils';

/**
 * Backfill an ink condition's imported_tints with measurements arrays
 * @param {string} conditionId - The ink condition ID to backfill
 * @returns {Promise<boolean>} - Success status
 */
export const backfillInkConditionMeasurements = async (conditionId) => {
  try {
    console.log('🔄 Backfilling measurements for condition:', conditionId);
    
    // Fetch the current condition
    const { data: condition, error } = await supabase
      .from('ink_conditions')
      .select('*')
      .eq('id', conditionId)
      .single();
    
    if (error || !condition) {
      console.error('Failed to fetch condition for backfill:', error);
      return false;
    }
    
    const availableModes = condition.measurement_settings?.available_modes || [];
    if (availableModes.length === 0) {
      console.log('No available modes found, skipping backfill');
      return false;
    }
    
    // Check if imported_tints is an array that needs conversion to object with measurements
    let importedTints = condition.imported_tints;
    if (Array.isArray(importedTints)) {
      console.log('Converting array imported_tints to rich object structure');
      
      // Create measurements arrays for each tint from available modes and existing spectral data
      const richImportedTints = {};
      
      importedTints.forEach((tint, index) => {
        const measurements = [];
        
        // For each available mode, create a measurement entry
        availableModes.forEach(mode => {
          if (tint.spectral_data || tint.spectralData) {
            measurements.push({
              mode: mode,
              spectral_data: tint.spectral_data || tint.spectralData,
              lab: tint.lab,
              backgroundName: tint.backgroundName || 'Substrate'
            });
          }
        });
        
        richImportedTints[index] = {
          ...tint,
          measurements: measurements
        };
      });
      
      // Update the condition with the new structure
      const { error: updateError } = await supabase
        .from('ink_conditions')
        .update({
          imported_tints: richImportedTints,
          updated_at: new Date().toISOString()
        })
        .eq('id', conditionId);
      
      if (updateError) {
        console.error('Failed to update condition with backfilled measurements:', updateError);
        return false;
      }
      
      console.log('✅ Successfully backfilled measurements for condition:', conditionId);
      return true;
    }
    
    // If it's already an object, check if measurements arrays exist
    if (importedTints && typeof importedTints === 'object' && !Array.isArray(importedTints)) {
      let needsUpdate = false;
      const updatedTints = { ...importedTints };
      
      Object.keys(importedTints).forEach(key => {
        const tint = importedTints[key];
        if (!tint.measurements || !Array.isArray(tint.measurements) || tint.measurements.length === 0) {
          // Add measurements array if missing
          const measurements = [];
          
          availableModes.forEach(mode => {
            if (tint.spectral_data || tint.spectralData) {
              measurements.push({
                mode: mode,
                spectral_data: tint.spectral_data || tint.spectralData,
                lab: tint.lab,
                backgroundName: tint.backgroundName || 'Substrate'
              });
            }
          });
          
          updatedTints[key] = {
            ...tint,
            measurements: measurements
          };
          needsUpdate = true;
        }
      });
      
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('ink_conditions')
          .update({
            imported_tints: updatedTints,
            updated_at: new Date().toISOString()
          })
          .eq('id', conditionId);
        
        if (updateError) {
          console.error('Failed to update condition with added measurements:', updateError);
          return false;
        }
        
        console.log('✅ Successfully added missing measurements to condition:', conditionId);
        return true;
      }
    }
    
    console.log('Condition already has proper measurements structure');
    return true;
    
  } catch (error) {
    console.error('Error in backfillInkConditionMeasurements:', error);
    return false;
  }
};
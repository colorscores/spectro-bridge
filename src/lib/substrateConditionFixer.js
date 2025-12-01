import { supabase } from '@/integrations/supabase/client';
import { spectralToLabASTME308, labToChromaHue } from '@/lib/colorUtils';
import { computeSubstrateConditionHex } from '@/lib/objectSpecificColorCalculation';
import { selectSubstrateZeroTint, getBackgroundName } from '@/lib/tintSelection';

/**
 * Fix a specific substrate condition by processing its missing data
 */
export const fixSubstrateCondition = async (substrateConditionId, options = {}) => {
  const { force = false, dryRun = false } = options;
  try {
    console.log('🔧 Fixing substrate condition:', substrateConditionId);

    // First, find the ink condition that was used to create this substrate condition
    const { data: inkConditions, error: inkError } = await supabase
      .from('ink_conditions') 
      .select('id, imported_tints, measurement_settings')
      .eq('substrate_condition', substrateConditionId);

    if (inkError) {
      throw new Error(`Failed to find related ink condition: ${inkError.message}`);
    }

    if (!inkConditions || inkConditions.length === 0) {
      throw new Error('No related ink condition found for this substrate condition');
    }

    const inkCondition = inkConditions[0];
    
    if (!inkCondition.imported_tints) {
      throw new Error('No imported_tints data found in related ink condition');
    }

    console.log('✅ Found related ink condition with imported_tints');

    // Extract 0% substrate data directly from imported_tints (no normalization)
    const { selected: substrateData, reason, zeroTints } = selectSubstrateZeroTint(inkCondition.imported_tints);

    if (!substrateData) {
      throw new Error('No 0% substrate tint found in imported_tints');
    }

    console.log('🎯 Selected 0% substrate tint', {
      reason,
      background: getBackgroundName(substrateData),
      zeroTintCount: zeroTints?.length || 0,
    });

    const spectralData = substrateData.spectralData || substrateData.spectral_data || substrateData.spectrum;

    if (!spectralData || typeof spectralData !== 'object') {
      throw new Error('No valid spectral data found in substrate tint');
    }

    console.log('✅ Found substrate spectral data with', Object.keys(spectralData).length, 'wavelengths');

    // Get organization defaults for calculations
    const { data: orgData, error: orgError } = await supabase
      .from('substrate_conditions')
      .select(`
        id,
        spectral_data,
        lab,
        ch,
        color_hex,
        imported_tints,
        substrates!inner (
          organization_id,
          organizations!inner (
            default_illuminant,
            default_observer, 
            default_astm_table
          )
        )
      `)
      .eq('id', substrateConditionId)
      .single();

    if (orgError) {
      throw new Error(`Failed to get organization defaults: ${orgError.message}`);
    }

    const orgDefaults = orgData.substrates.organizations;

    // Determine if condition already has valid processed data
    const hasSpectral = orgData?.spectral_data && typeof orgData.spectral_data === 'object' && Object.keys(orgData.spectral_data).length > 0;
    const hasLab = orgData?.lab && typeof orgData.lab === 'object' && typeof orgData.lab.L === 'number';
    const hasCh = orgData?.ch && typeof orgData.ch === 'object' && (typeof orgData.ch.C === 'number' || typeof orgData.ch.c === 'number');
    const hasHex = typeof orgData?.color_hex === 'string' && orgData.color_hex.length >= 4;

    if (!force && (hasSpectral || (hasLab && hasCh) || (hasLab && hasHex))) {
      console.log('⏭️ Skipping substrate condition processing: existing processed data detected', {
        hasSpectral,
        hasLab,
        hasCh,
        hasHex,
      });
      return {
        skipped: true,
        reason: 'existing_data',
        existing: {
          spectral_data: orgData.spectral_data || null,
          lab: orgData.lab || null,
          ch: orgData.ch || null,
          color_hex: orgData.color_hex || null,
        }
      };
    }

    const illuminant = inkCondition.measurement_settings?.illuminant || orgDefaults.default_illuminant || 'D50';
    const observer = inkCondition.measurement_settings?.observer || orgDefaults.default_observer || '2';
    const table = inkCondition.measurement_settings?.table || orgDefaults.default_astm_table || '5';

    console.log('📊 Using calculation settings:', { illuminant, observer, table, force });

    // Load ASTM tables for calculations
    const { data: astmTables, error: astmError } = await supabase
      .from('astm_e308_tables')
      .select('*');

    if (astmError) {
      throw new Error(`Failed to load ASTM tables: ${astmError.message}`);
    }

    // Find the appropriate ASTM weighting table
    const weightingTable = astmTables.filter(row => 
      row.illuminant_name === illuminant && 
      row.observer === observer &&
      String(row.table_number) === String(table)
    );

    if (!weightingTable.length) {
      throw new Error(`No ASTM weighting table found for ${illuminant}/${observer}/Table ${table}`);
    }

    // Calculate Lab values
    const labValues = spectralToLabASTME308(spectralData, weightingTable);
    if (!labValues || typeof labValues.L !== 'number') {
      throw new Error('Failed to calculate Lab values from spectral data');
    }

    // Calculate Chroma and Hue
    const chValues = labToChromaHue(labValues.L, labValues.a, labValues.b);

    // Calculate display hex color using standardized approach
    const displayHex = computeSubstrateConditionHex({ 
      spectral_data: spectralData,
      lab: labValues,
      measurement_settings: { illuminant }
    }, orgDefaults, astmTables);

    console.log('✅ Calculated values:', { 
      lab: labValues, 
      ch: chValues, 
      hex: displayHex 
    });

    // Update the substrate condition with the processed data
    const updateData = {
      spectral_data: spectralData,
      lab: labValues,
      ch: chValues,
      color_hex: displayHex,
      measurement_settings: {
        illuminant,
        observer,
        table,
        mode: inkCondition.measurement_settings?.mode || 'M0'
      }
    };

    if (dryRun) {
      console.log('🧪 Dry run: would update substrate condition with:', updateData);
      return { ...updateData, dryRun: true };
    }

    const { error: updateError } = await supabase
      .from('substrate_conditions')
      .update(updateData)
      .eq('id', substrateConditionId);

    if (updateError) {
      throw new Error(`Failed to update substrate condition: ${updateError.message}`);
    }

    console.log('✅ Successfully fixed substrate condition data');
    return updateData;

  } catch (error) {
    console.error('❌ Error fixing substrate condition:', error);
    throw error;
  }
};

// Export a helper to run the fix immediately  
export const runSubstrateConditionFix = async (conditionId) => {
  try {
    const result = await fixSubstrateCondition(conditionId);
    console.log('🎉 Substrate condition fix completed successfully');
    return result;
  } catch (error) {
    console.error('💥 Substrate condition fix failed:', error.message);
    throw error;
  }
};
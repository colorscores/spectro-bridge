import { getSolidSpectralData } from '@/lib/colorUtils/spectralDataHelpers';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';
import { supabase } from '@/integrations/supabase/client';
import { computeSubstrateConditionHex } from '@/lib/objectSpecificColorCalculation';
import { selectSubstrateZeroTint, getBackgroundName } from '@/lib/tintSelection';

/**
 * Processes imported_tints data from an ink condition to populate substrate condition
 * spectral_data, lab, and ch fields
 */
export const processSubstrateConditionFromImportedTints = async (
  substrateConditionId, 
  inkConditionId,
  organizationDefaults = null
) => {
  try {
    console.log('🔄 Processing substrate condition from imported tints:', { substrateConditionId, inkConditionId });

    // Get the ink condition with imported_tints data
    const { data: inkCondition, error: inkError } = await supabase
      .from('ink_conditions')
      .select('imported_tints, measurement_settings')
      .eq('id', inkConditionId)
      .maybeSingle();

    if (inkError) {
      throw new Error(`Failed to fetch ink condition: ${inkError.message}`);
    }

    if (!inkCondition?.imported_tints) {
      throw new Error('No imported_tints data found in ink condition');
    }

    // Get organization defaults if not provided
    let orgDefaults = organizationDefaults;
    if (!orgDefaults) {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('default_illuminant, default_observer, default_astm_table')
        .eq('id', (await supabase.from('substrate_conditions').select('substrate_id').eq('id', substrateConditionId).single()).data?.substrate_id)
        .maybeSingle();
      
      if (!orgError && orgData) {
        orgDefaults = {
          default_illuminant: orgData.default_illuminant || 'D50',
          default_observer: orgData.default_observer || '2',
          default_astm_table: orgData.default_astm_table || '5'
        };
      } else {
        orgDefaults = {
          default_illuminant: 'D50',
          default_observer: '2',
          default_astm_table: '5'
        };
      }
    }

    // Select the correct 0% substrate tint directly from imported_tints (no normalization)
    const { selected: substrateData, reason, zeroTints } = selectSubstrateZeroTint(inkCondition.imported_tints);

    if (!substrateData) {
      throw new Error('No 0% substrate tint found in imported_tints data');
    }

    // Extract available modes from all tints in the imported data
    const allTints = Array.isArray(inkCondition.imported_tints)
      ? inkCondition.imported_tints
      : (Array.isArray(inkCondition.imported_tints?.tints) ? inkCondition.imported_tints.tints : []);

    const availableModes = new Set();
    allTints.forEach(tint => {
      if (tint.measurements && Array.isArray(tint.measurements)) {
        tint.measurements.forEach(measurement => {
          if (measurement.mode) availableModes.add(measurement.mode);
        });
      }
      if (tint.mode) availableModes.add(tint.mode);
    });

    console.log('🎯 Selected 0% substrate tint', {
      reason,
      background: getBackgroundName(substrateData),
      zeroTintCount: zeroTints?.length || 0,
    });

    // Extract spectral data from the substrate tint
    const spectralData = substrateData.spectralData || substrateData.spectral_data || substrateData.spectrum;

    if (!spectralData || typeof spectralData !== 'object') {
      throw new Error('No valid spectral data found in 0% substrate tint');
    }

    console.log('✅ Found substrate spectral data:', Object.keys(spectralData).length, 'wavelengths');

    // Get measurement settings (prefer from ink condition, fallback to org defaults)
    const measurementSettings = inkCondition.measurement_settings || {};
    const illuminant = measurementSettings.illuminant || orgDefaults.default_illuminant;
    const observer = measurementSettings.observer || orgDefaults.default_observer;
    const table = measurementSettings.table || orgDefaults.default_astm_table;

    // Load ASTM tables for calculations
    const { data: astmTables, error: astmError } = await supabase
      .from('astm_e308_tables')
      .select('*');

    if (astmError) {
      throw new Error(`Failed to load ASTM tables: ${astmError.message}`);
    }

    // Calculate Lab and CH values using spectral calculations
    const { spectralToLabASTME308, labToChromaHue } = await import('@/lib/colorUtils');
    
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

    console.log('✅ Calculated color values:', { labValues, chValues });

    // Calculate display hex color using substrate-specific calculation
    const displayHex = computeSubstrateConditionHex({ 
      spectral_data: spectralData,
      lab: labValues,
      measurement_settings: { illuminant }
    }, orgDefaults, astmTables);

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
        mode: measurementSettings.mode || 'M0',
        available_modes: Array.from(availableModes)
      }
    };

    const { error: updateError } = await supabase
      .from('substrate_conditions')
      .update(updateData)
      .eq('id', substrateConditionId);

    if (updateError) {
      throw new Error(`Failed to update substrate condition: ${updateError.message}`);
    }

    console.log('✅ Successfully processed substrate condition data');
    return updateData;

  } catch (error) {
    console.error('❌ Error processing substrate condition from imported tints:', error);
    throw error;
  }
};

/**
 * Checks if a substrate condition needs processing and processes it if needed
 * This is the main function to use in the creation workflow
 */
export const ensureSubstrateConditionProcessed = async (substrateConditionId) => {
  try {
    // Check if the substrate condition already has processed data
    const { data: condition, error: conditionError } = await supabase
      .from('substrate_conditions')
      .select('spectral_data, lab, ch, imported_tints')
      .eq('id', substrateConditionId)
      .maybeSingle();

    if (conditionError) {
      throw new Error(`Failed to fetch substrate condition: ${conditionError.message}`);
    }

    if (!condition) {
      throw new Error('Substrate condition not found');
    }

    // If already has processed data, no need to process
    if (condition.spectral_data && condition.lab && condition.ch) {
      console.log('✅ Substrate condition already has processed data');
      return condition;
    }

    // If no imported_tints, check if created from ink condition
    if (!condition.imported_tints) {
      console.log('⚠️ No imported_tints found, cannot process');
      return null;
    }

    // Find the related ink condition that created this substrate condition
    const { data: inkConditions, error: inkError } = await supabase
      .from('ink_conditions')
      .select('id')
      .eq('substrate_condition', substrateConditionId)
      .limit(1);

    if (inkError || !inkConditions?.length) {
      console.log('⚠️ No related ink condition found');
      return null;
    }

    const inkConditionId = inkConditions[0].id;
    
    // Process the substrate condition
    return await processSubstrateConditionFromImportedTints(substrateConditionId, inkConditionId);

  } catch (error) {
    console.error('❌ Error ensuring substrate condition processed:', error);
    throw error;
  }
};
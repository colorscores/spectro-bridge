import { supabase } from '@/integrations/supabase/client';
import { computeSubstrateConditionHex } from './objectSpecificColorCalculation';

/**
 * Identify and repair all objects with invalid hex values
 */
export async function repairAllInvalidHexValues(organizationId, orgDefaults, astmTables) {
  const results = {
    substrateConditions: { updated: 0, errors: [] },
    printConditions: { updated: 0, errors: [] },
    colors: { updated: 0, errors: [] },
    inkConditions: { updated: 0, errors: [] }
  };

  // Repair substrate conditions
  try {
    const substrateResult = await repairSubstrateConditionHexValues(organizationId, orgDefaults, astmTables);
    results.substrateConditions = substrateResult;
  } catch (error) {
    results.substrateConditions.errors.push(error);
  }

  // Add more repair functions for other object types as needed
  
  return results;
}

/**
 * Repair substrate condition hex values specifically
 */
async function repairSubstrateConditionHexValues(organizationId, orgDefaults, astmTables) {
  const results = { updated: 0, errors: [] };

  try {
    // Find substrate conditions with invalid hex values
    const { data: invalidConditions, error: fetchError } = await supabase
      .from('substrate_conditions')
      .select(`
        id, name, color_hex, spectral_data, lab, measurement_settings,
        substrates!inner(organization_id)
      `)
      .eq('substrates.organization_id', organizationId)
      .or('color_hex.is.null,color_hex.like.%AN%,color_hex.eq.#E5E7EB');

    if (fetchError) {
      console.error('Error fetching invalid substrate conditions:', fetchError);
      results.errors.push(fetchError);
      return results;
    }

    console.log(`Found ${invalidConditions?.length || 0} substrate conditions with invalid hex values`);

    for (const condition of invalidConditions || []) {
      try {
        // Calculate correct hex value
        const newHex = computeSubstrateConditionHex(condition, orgDefaults, astmTables);
        
        if (newHex && newHex !== condition.color_hex && newHex !== '#E5E7EB') {
          // Update the condition
          const { error: updateError } = await supabase
            .from('substrate_conditions')
            .update({ color_hex: newHex })
            .eq('id', condition.id);

          if (updateError) {
            results.errors.push({ conditionId: condition.id, error: updateError });
          } else {
            results.updated++;
            console.log(`Repaired substrate condition ${condition.name}: ${condition.color_hex} → ${newHex}`);
          }
        }
      } catch (error) {
        results.errors.push({ conditionId: condition.id, error });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in repairSubstrateConditionHexValues:', error);
    results.errors.push(error);
    return results;
  }
}

/**
 * Validate that hex calculation is working correctly
 */
export function validateHexCalculation(object, orgDefaults, astmTables, objectType = 'unknown') {
  const validations = {
    hasValidSpectral: false,
    hasValidLab: false,
    calculatedHex: null,
    isValidHex: false,
    errors: []
  };

  try {
    // Check spectral data
    if (object.spectral_data && typeof object.spectral_data === 'object') {
      const spectralKeys = Object.keys(object.spectral_data);
      validations.hasValidSpectral = spectralKeys.length > 0;
    }

    // Check Lab data
    if (object.lab && typeof object.lab === 'object') {
      const { L, a, b } = object.lab;
      validations.hasValidLab = typeof L === 'number' && typeof a === 'number' && typeof b === 'number';
    } else if (typeof object.lab_l === 'number' && typeof object.lab_a === 'number' && typeof object.lab_b === 'number') {
      validations.hasValidLab = true;
    }

    // Calculate hex based on object type
    if (objectType === 'substrate_condition') {
      validations.calculatedHex = computeSubstrateConditionHex(object, orgDefaults, astmTables);
    }
    // Add more object types as needed

    // Validate hex format
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    validations.isValidHex = hexRegex.test(validations.calculatedHex);

  } catch (error) {
    validations.errors.push(error);
  }

  return validations;
}
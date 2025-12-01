import { supabase } from '@/integrations/supabase/client';

/**
 * Backfill utility to fix ink conditions with incomplete available_backgrounds
 * Identifies conditions where available_backgrounds is ["Substrate"] only but tints have multiple backgrounds
 */
export async function backfillInkConditionBackgrounds(organizationId) {
  console.log('🔧 Starting backfill for organization:', organizationId);
  
  // Fetch all ink conditions for the organization
  const { data: conditions, error } = await supabase
    .from('ink_conditions')
    .select('*')
    .eq('organization_id', organizationId);
  
  if (error) {
    console.error('Failed to fetch ink conditions:', error);
    return { updated: 0, errors: [error.message] };
  }
  
  let updated = 0;
  const errors = [];
  
  for (const condition of conditions) {
    try {
      const ms = condition.measurement_settings || {};
      const currentBg = ms.available_backgrounds || [];
      
      // Check if this condition needs fixing (only has "Substrate" or is empty)
      if (currentBg.length <= 1) {
        // Collect backgrounds from imported_tints and adapted_tints
        const uniqueBackgrounds = new Set();
        
        const importedTints = Array.isArray(condition.imported_tints) 
          ? condition.imported_tints 
          : [];
        const adaptedTints = Array.isArray(condition.adapted_tints) 
          ? condition.adapted_tints 
          : [];
        
        const allTints = [...importedTints, ...adaptedTints];
        
        allTints.forEach(tint => {
          if (tint.backgroundName) uniqueBackgrounds.add(tint.backgroundName);
          if (tint.background_name) uniqueBackgrounds.add(tint.background_name);
          
          if (Array.isArray(tint.measurements)) {
            tint.measurements.forEach(m => {
              if (m.backgroundName) uniqueBackgrounds.add(m.backgroundName);
              if (m.background_name) uniqueBackgrounds.add(m.background_name);
            });
          }
        });
        
        // Ensure "Substrate" is always present
        if (!uniqueBackgrounds.has('Substrate')) {
          uniqueBackgrounds.add('Substrate');
        }
        
        const newAvailableBackgrounds = Array.from(uniqueBackgrounds);
        
        // Only update if we found more backgrounds
        if (newAvailableBackgrounds.length > currentBg.length) {
          // Assign background_key to tints that don't have it
          const attachBackgroundKeys = (tints) => {
            if (!Array.isArray(tints)) return tints;
            
            return tints.map(tint => {
              const bgName = tint.backgroundName || tint.background_name;
              let bgKey = tint.background_key;
              
              if (!bgKey && bgName) {
                const bgIndex = newAvailableBackgrounds.indexOf(bgName);
                if (bgIndex >= 0) {
                  bgKey = `bg${bgIndex}`;
                }
              }
              
              return {
                ...tint,
                ...(bgKey && { background_key: bgKey })
              };
            });
          };
          
          const updatedImportedTints = attachBackgroundKeys(importedTints);
          const updatedAdaptedTints = adaptedTints.length > 0 
            ? attachBackgroundKeys(adaptedTints) 
            : condition.adapted_tints;
          
          const { error: updateError } = await supabase
            .from('ink_conditions')
            .update({
              measurement_settings: {
                ...ms,
                available_backgrounds: newAvailableBackgrounds
              },
              imported_tints: updatedImportedTints,
              ...(updatedAdaptedTints && { adapted_tints: updatedAdaptedTints })
            })
            .eq('id', condition.id);
          
          if (updateError) {
            errors.push(`Failed to update condition ${condition.id}: ${updateError.message}`);
          } else {
            updated++;
            console.log(`✅ Updated condition ${condition.name}:`, {
              old: currentBg,
              new: newAvailableBackgrounds
            });
          }
        }
      }
    } catch (error) {
      errors.push(`Error processing condition ${condition.id}: ${error.message}`);
    }
  }
  
  console.log('🔧 Backfill complete:', { updated, errors: errors.length });
  return { updated, errors };
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.backfillInkConditionBackgrounds = backfillInkConditionBackgrounds;
}

/**
 * Resolves the active data mode from an entity's various possible locations
 * Ensures consistent precedence across all components
 * 
 * @param {Object} entity - The entity (ink condition, color, etc.)
 * @returns {string} The resolved data mode ('imported' or 'adapted')
 */
export function resolveActiveDataMode(entity) {
  if (!entity) return 'imported';
  
  return entity.active_data_mode || 
         entity.ui_state?.active_data_mode || 
         entity.measurement_settings?.preferred_data_mode || 
         'imported';
}

// Utility functions for ink wedge handling
import { getSolidColorHex } from './colorUtils/solidColorExtractor';
import { getTintPercentage } from './tintsUtils';

/**
 * Find the index of the solid wedge (100% or highest percentage)
 * @param {Array} wedgeData - Array of wedge/tint data
 * @returns {number} - Index of the solid wedge
 */
export const findSolidWedgeIndex = (wedgeData) => {
  if (!wedgeData || wedgeData.length === 0) return 0;
  
  // Look for 100% solid first
  const solidIndex = wedgeData.findIndex(wedge => getTintPercentage(wedge) === 100);
  if (solidIndex !== -1) return solidIndex;
  
  // If no 100% found, find the highest percentage (excluding substrate at 0%)
  let maxPercentage = -1;
  let maxIndex = 0;
  
  wedgeData.forEach((wedge, index) => {
    const percentage = getTintPercentage(wedge);
    if (percentage > 0 && percentage > maxPercentage) {
      maxPercentage = percentage;
      maxIndex = index;
    }
  });
  
  // If we only have substrate data (all 0%), return 0 but don't auto-select it
  if (maxPercentage === -1) {
    return 0; // Return substrate index but caller should check if it should be auto-selected
  }
  
  return maxIndex;
};

/**
 * Get solid color from condition - ALWAYS returns on-substrate solid (100%) color
 * Delegates to solidColorExtractor to keep logic consistent across the app.
 * @param {Object} conditionData
 * @returns {string}
 */
export const getSolidColorFromCondition = (conditionData, activeDataMode = null) => {
  return getSolidColorHex(conditionData, activeDataMode);
};
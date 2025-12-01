import { describe, it, expect } from 'vitest';
import { getInkConditionDisplayColor, hasCompleteConditionData, hasExpectedAdaptedData } from '@/lib/inkConditionUtils';

describe('inkConditionUtils', () => {
  describe('getInkConditionDisplayColor', () => {
    it('should return stored color_hex as primary strategy', () => {
      const condition = {
        measurement_settings: { preferred_data_mode: 'adapted' },
        adapted_tints: [
          { tintPercentage: 100, colorHex: '#ff0000' },
          { tintPercentage: 50, colorHex: '#ff5555' }
        ],
        color_hex: '#0000ff'
      };
      
      // Should return stored color_hex, not calculate from tints
      expect(getInkConditionDisplayColor(condition)).toBe('#0000FF');
    });

    it('should calculate from tints when no stored color_hex', () => {
      const condition = {
        measurement_settings: { preferred_data_mode: 'adapted' },
        adapted_tints: [
          { tintPercentage: 100, colorHex: '#ff0000' },
          { tintPercentage: 50, colorHex: '#ff5555' }
        ]
      };
      
      expect(getInkConditionDisplayColor(condition)).toBe('#FF0000');
    });

    it('should use imported tints when no adapted tints and no color_hex', () => {
      const condition = {
        imported_tints: [
          { tintPercentage: 100, colorHex: '#00ff00' },
          { tintPercentage: 50, colorHex: '#55ff55' }
        ]
      };
      
      expect(getInkConditionDisplayColor(condition)).toBe('#00FF00');
    });

    it('should return default gray for empty condition', () => {
      expect(getInkConditionDisplayColor(null)).toBe('#f3f4f6');
      expect(getInkConditionDisplayColor({})).toBe('#f3f4f6');
    });
  });

  describe('hasCompleteConditionData', () => {
    it('should return true for condition with adapted tints', () => {
      const condition = {
        adapted_tints: [{ tintPercentage: 100, colorHex: '#ff0000' }]
      };
      
      expect(hasCompleteConditionData(condition)).toBe(true);
    });

    it('should return true for condition with imported tints', () => {
      const condition = {
        imported_tints: [{ tintPercentage: 100, colorHex: '#ff0000' }]
      };
      
      expect(hasCompleteConditionData(condition)).toBe(true);
    });

    it('should return true for condition with color_hex', () => {
      const condition = {
        color_hex: '#ff0000'
      };
      
      expect(hasCompleteConditionData(condition)).toBe(true);
    });

    it('should return false for incomplete condition', () => {
      expect(hasCompleteConditionData(null)).toBe(false);
      expect(hasCompleteConditionData({})).toBe(false);
    });
  });
});
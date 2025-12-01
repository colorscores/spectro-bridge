import { describe, it, expect, beforeAll } from 'vitest';
import { importAstmWeights, validateAstmSums } from '@/utils/importAstmWeights';
import { clearAndReloadAstmCache } from '@/utils/astmCacheManager';

describe('ASTM E308 Weights Import', () => {
  // Sample T5/D50/2 data for testing
  const sampleT5D50Data = [
    { illuminant_name: 'D50', observer: '2', table_number: 5, wavelength: 360, x_factor: 0.0001, y_factor: 0.0000, z_factor: 0.0007, white_point_x: 96.4210, white_point_y: 99.9970, white_point_z: 82.5240 },
    { illuminant_name: 'D50', observer: '2', table_number: 5, wavelength: 370, x_factor: 0.0005, y_factor: 0.0001, z_factor: 0.0025, white_point_x: 96.4210, white_point_y: 99.9970, white_point_z: 82.5240 },
    // ... more rows would be here for a complete test
  ];

  beforeAll(async () => {
    // Clear caches before testing
    await clearAndReloadAstmCache();
  });

  it('should import ASTM weight rows successfully', async () => {
    const result = await importAstmWeights(sampleT5D50Data);
    
    expect(result.success).toBe(true);
    expect(result.processed_rows).toBeGreaterThan(0);
    expect(Array.isArray(result.verification_sums)).toBe(true);
  });

  it('should validate sum totals correctly', () => {
    const mockSums = [
      { illuminant_name: 'D50', observer: '2', table_number: 5, rows: 43, sum_x: 96.4210, sum_y: 99.9970, sum_z: 82.5240 }
    ];

    const expected = {
      'D50/2/T5': { x: 96.4210, y: 99.9970, z: 82.5240 }
    };

    const validation = validateAstmSums(mockSums, expected);
    
    expect(validation).toHaveLength(1);
    expect(validation[0].valid).toBe(true);
    expect(validation[0].errors).toHaveLength(0);
  });

  it('should detect sum mismatches', () => {
    const mockSums = [
      { illuminant_name: 'D50', observer: '2', table_number: 5, rows: 43, sum_x: 10.684, sum_y: 10.686, sum_z: 10.679 }
    ];

    const expected = {
      'D50/2/T5': { x: 96.4210, y: 99.9970, z: 82.5240 }
    };

    const validation = validateAstmSums(mockSums, expected);
    
    expect(validation).toHaveLength(1);
    expect(validation[0].valid).toBe(false);
    expect(validation[0].errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid row data', async () => {
    const invalidData = [
      { illuminant_name: 'D50' } // Missing required fields
    ];

    await expect(importAstmWeights(invalidData)).rejects.toThrow();
  });

  it('should handle empty data gracefully', async () => {
    await expect(importAstmWeights([])).rejects.toThrow('No valid rows provided');
  });
});
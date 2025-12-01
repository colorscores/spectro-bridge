import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/customSupabaseClient';

describe('ASTM E308 Verification Tests', () => {
  it('should verify T5/D50/2 sum values match expected official values', async () => {
    // Query the current sums using the view
    const { data: sums, error } = await supabase
      .from('astm_e308_sums')
      .select('*')
      .eq('illuminant_name', 'D50')
      .eq('observer', '2')
      .eq('table_number', 5)
      .single();

    expect(error).toBeNull();
    expect(sums).toBeTruthy();

    // Expected official ASTM E308 Table 5 sums
    const expected = {
      sum_x: 96.4210,
      sum_y: 99.9970,
      sum_z: 82.5240
    };

    // Allow small floating point tolerance
    const tolerance = 0.001;

    expect(Math.abs(sums.sum_x - expected.sum_x)).toBeLessThan(tolerance);
    expect(Math.abs(sums.sum_y - expected.sum_y)).toBeLessThan(tolerance);
    expect(Math.abs(sums.sum_z - expected.sum_z)).toBeLessThan(tolerance);

    console.log(`✅ T5/D50/2 validation PASSED: X=${sums.sum_x}, Y=${sums.sum_y}, Z=${sums.sum_z}`);
  });

  it('should have exactly 43 rows for T5/D50/2 (360-780nm)', async () => {
    const { data: rows, error } = await supabase
      .from('astm_e308_tables')
      .select('wavelength')
      .eq('illuminant_name', 'D50')
      .eq('observer', '2')
      .eq('table_number', 5)
      .order('wavelength');

    expect(error).toBeNull();
    expect(rows).toHaveLength(43);
    expect(rows[0].wavelength).toBe(360);
    expect(rows[42].wavelength).toBe(780);
  });

  it('should have consistent white point values across all T5/D50/2 rows', async () => {
    const { data: rows, error } = await supabase
      .from('astm_e308_tables')
      .select('white_point_x, white_point_y, white_point_z')
      .eq('illuminant_name', 'D50')
      .eq('observer', '2')
      .eq('table_number', 5)
      .not('white_point_x', 'is', null);

    expect(error).toBeNull();
    expect(rows.length).toBeGreaterThan(0);

    // All white points should be the same
    const expectedWhitePoint = {
      x: 96.4210,
      y: 99.9970,
      z: 82.5240
    };

    rows.forEach(row => {
      expect(Number(row.white_point_x)).toBeCloseTo(expectedWhitePoint.x, 4);
      expect(Number(row.white_point_y)).toBeCloseTo(expectedWhitePoint.y, 4);
      expect(Number(row.white_point_z)).toBeCloseTo(expectedWhitePoint.z, 4);
    });
  });

  it('should reject incorrect sum values (regression test)', async () => {
    const { data: sums } = await supabase
      .from('astm_e308_sums')
      .select('*')
      .eq('illuminant_name', 'D50')
      .eq('observer', '2')
      .eq('table_number', 5)
      .single();

    // These were the WRONG CMF-based sums that should never appear again
    const wrongSums = { x: 10.684, y: 10.686, z: 10.679 };

    expect(sums.sum_x).not.toBeCloseTo(wrongSums.x, 2);
    expect(sums.sum_y).not.toBeCloseTo(wrongSums.y, 2);
    expect(sums.sum_z).not.toBeCloseTo(wrongSums.z, 2);
  });
});
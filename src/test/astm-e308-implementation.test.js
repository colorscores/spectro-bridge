import { describe, it, expect, beforeAll } from 'vitest';
import { spectralToLabASTME308 } from '@/lib/colorUtils/colorConversion';
import { supabase } from '@/integrations/supabase/client';

describe('ASTM E308 Implementation with White Point Normalization', () => {
  let astmTables = [];

  beforeAll(async () => {
    // Fetch ASTM tables from database
    const { data, error } = await supabase
      .from('astm_e308_tables')
      .select('*')
      .order('illuminant_name, observer, table_number, wavelength');
    
    if (error) {
      console.error('Failed to fetch ASTM tables:', error);
      return;
    }
    
    astmTables = data || [];
    console.log(`Loaded ${astmTables.length} ASTM table rows`);
  });

  it('should have ASTM tables with white point data', () => {
    expect(astmTables.length).toBeGreaterThan(0);
    
    // Check first row has white point data
    const firstRow = astmTables[0];
    expect(firstRow).toBeDefined();
    expect(firstRow.white_point_x).toBeDefined();
    expect(firstRow.white_point_y).toBeDefined();
    expect(firstRow.white_point_z).toBeDefined();
    expect(typeof firstRow.white_point_x).toBe('string'); // Supabase returns as strings
  });

  it('should have D50 tables with correct white point', () => {
    const d50Tables = astmTables.filter(row => row.illuminant_name === 'D50');
    expect(d50Tables.length).toBeGreaterThan(0);
    
    const firstD50 = d50Tables[0];
    expect(Number(firstD50.white_point_x)).toBeCloseTo(96.422, 2);
    expect(Number(firstD50.white_point_y)).toBeCloseTo(100.000, 2);
    expect(Number(firstD50.white_point_z)).toBeCloseTo(82.521, 2);
  });

  it('should have D65 tables with correct white point', () => {
    const d65Tables = astmTables.filter(row => row.illuminant_name === 'D65');
    expect(d65Tables.length).toBeGreaterThan(0);
    
    const firstD65 = d65Tables[0];
    expect(Number(firstD65.white_point_x)).toBeCloseTo(95.047, 2);
    expect(Number(firstD65.white_point_y)).toBeCloseTo(100.000, 2);
    expect(Number(firstD65.white_point_z)).toBeCloseTo(108.883, 2);
  });

  it('should perform spectral to Lab conversion with D50 white point', () => {
    const d50Tables = astmTables.filter(row => 
      row.illuminant_name === 'D50' && 
      row.observer === '2' && 
      row.table_number === 5
    );
    
    if (d50Tables.length === 0) {
      console.warn('No D50/2°/Table5 data available for test');
      return;
    }

    // Test with sample spectral data
    const spectralData = {
      400: 0.1, 410: 0.15, 420: 0.2, 430: 0.25, 440: 0.3,
      450: 0.35, 460: 0.4, 470: 0.45, 480: 0.5, 490: 0.55,
      500: 0.6, 510: 0.65, 520: 0.7, 530: 0.75, 540: 0.8,
      550: 0.75, 560: 0.7, 570: 0.65, 580: 0.6, 590: 0.55,
      600: 0.5, 610: 0.45, 620: 0.4, 630: 0.35, 640: 0.3,
      650: 0.25, 660: 0.2, 670: 0.15, 680: 0.1, 690: 0.05, 700: 0.03
    };

    const lab = spectralToLabASTME308(spectralData, d50Tables);
    
    expect(lab).toBeDefined();
    expect(typeof lab.L).toBe('number');
    expect(typeof lab.a).toBe('number');
    expect(typeof lab.b).toBe('number');
    expect(Number.isFinite(lab.L)).toBe(true);
    expect(Number.isFinite(lab.a)).toBe(true);
    expect(Number.isFinite(lab.b)).toBe(true);
    
    // Lab values should be in reasonable ranges
    expect(lab.L).toBeGreaterThanOrEqual(0);
    expect(lab.L).toBeLessThanOrEqual(100);
    expect(lab.a).toBeGreaterThanOrEqual(-128);
    expect(lab.a).toBeLessThanOrEqual(127);
    expect(lab.b).toBeGreaterThanOrEqual(-128);
    expect(lab.b).toBeLessThanOrEqual(127);

    console.log('D50 Lab calculation result:', lab);
  });

  it('should use different white points for different illuminants', () => {
    const d50Tables = astmTables.filter(row => 
      row.illuminant_name === 'D50' && 
      row.observer === '2' && 
      row.table_number === 5
    );
    
    const d65Tables = astmTables.filter(row => 
      row.illuminant_name === 'D65' && 
      row.observer === '2' && 
      row.table_number === 5
    );

    if (d50Tables.length === 0 || d65Tables.length === 0) {
      console.warn('Missing ASTM table data for illuminant comparison test');
      return;
    }

    // Same spectral data, different illuminants should give different Lab results
    const spectralData = {
      400: 0.2, 450: 0.4, 500: 0.8, 550: 0.9, 600: 0.6, 650: 0.3, 700: 0.1
    };

    const labD50 = spectralToLabASTME308(spectralData, d50Tables);
    const labD65 = spectralToLabASTME308(spectralData, d65Tables);
    
    expect(labD50).toBeDefined();
    expect(labD65).toBeDefined();
    
    // Results should be different due to different white points
    const labsDifferent = (
      Math.abs(labD50.L - labD65.L) > 0.01 ||
      Math.abs(labD50.a - labD65.a) > 0.01 ||
      Math.abs(labD50.b - labD65.b) > 0.01
    );
    
    expect(labsDifferent).toBe(true);
    console.log('D50 vs D65 Lab results:', { labD50, labD65 });
  });

  it('should handle missing white point data gracefully', () => {
    // Create mock table without white point data
    const mockTable = [
      {
        wavelength: 400,
        x_factor: 0.1,
        y_factor: 0.2,
        z_factor: 0.3
        // Missing white_point_x, white_point_y, white_point_z
      }
    ];

    const spectralData = { 400: 0.5 };
    const lab = spectralToLabASTME308(spectralData, mockTable);
    
    // Should return default values when white point data is missing
    expect(lab).toEqual({ L: 0, a: 0, b: 0 });
  });

  it('should validate illuminant options are available', () => {
    const illuminants = [...new Set(astmTables.map(row => row.illuminant_name))];
    
    // Should have at least D50, D65, A
    expect(illuminants).toContain('D50');
    expect(illuminants).toContain('D65');
    expect(illuminants).toContain('A');
    
    console.log('Available illuminants:', illuminants);
  });

  it('perfect diffuser (R=1) yields near-white under D50/2/table5', () => {
    const d50Tables = astmTables.filter(row => 
      row.illuminant_name === 'D50' && 
      row.observer === '2' && 
      row.table_number === 5
    );

    if (!d50Tables.length) {
      console.warn('No D50/2°/Table5 data available for perfect diffuser test');
      return;
    }

    const spectral = {};
    d50Tables.forEach(r => { spectral[r.wavelength] = 1.0; });

    const lab = spectralToLabASTME308(spectral, d50Tables);
    expect(lab.L).toBeCloseTo(100, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });
});
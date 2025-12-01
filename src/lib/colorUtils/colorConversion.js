import { WHITE_POINTS } from '@/lib/colorStandards';
import { isSimilarDebugEnabled, sdebug } from '@/lib/similarDebug';
import { normalizeTints as normalizeInkTints, getTintPercentage, safeSpectralData } from '@/lib/tintsUtils';
import { normalizeMode, getModeFromMeasurement } from '@/lib/utils/colorMeasurementSelection';

// Debug flag for spectral calculations - set to true to enable verbose logging
const DEBUG_SPECTRAL = false;

function detectAndNormalizeSpectralData(spectralData) {
  if (!spectralData || typeof spectralData !== 'object') {
    return {};
  }

  const result = {};
  let hasPercentageValues = false;
  
  // Check if we have percentage values (>1.0) - be more conservative
  const values = Object.values(spectralData);
  const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v) && v >= 0);
  if (numericValues.length > 0) {
    const maxValue = Math.max(...numericValues);
    const avgValue = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
    // Only treat as percentage if max > 1.1 AND average > 1.0 (safer heuristic)
    hasPercentageValues = maxValue > 1.1 && avgValue > 1.0;
  }

  // Process each wavelength
  for (const [wavelength, value] of Object.entries(spectralData)) {
    const wl = Number(wavelength);
    if (isNaN(wl) || wl < 360 || wl > 830) continue;
    
    let numValue = Number(value);
    if (isNaN(numValue) || numValue < 0) continue;
    
    // Convert percentage to decimal if needed
    if (hasPercentageValues && numValue > 1.0) {
      numValue = numValue / 100.0;
    }
    
    // Clamp to valid reflectance range
    result[wl] = Math.max(0, Math.min(1, numValue));
  }

  return result;
}

// DEPRECATED: This function has been removed in favor of spectralToLabASTME308
// which uses proper ASTM E308 tables with illuminant-specific white points
// All calls to this function should be updated to use spectralToLabASTME308 with ASTM tables

export function spectralToLabASTME308(spectralData, weightingTable) {
    // Check for URL parameter tracing
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const traceE308 = urlParams?.get('traceE308') === '1' || isSimilarDebugEnabled();
    const forceDebug = DEBUG_SPECTRAL;
    
    if (forceDebug) {
        console.log('[E308-DEBUG] spectralToLabASTME308 called with:', {
            spectralDataType: typeof spectralData,
            spectralDataKeys: spectralData ? Object.keys(spectralData).slice(0, 5) : 'null',
            spectralDataSample: spectralData ? Object.entries(spectralData).slice(0, 3) : 'null',
            weightingTableType: typeof weightingTable,
            weightingTableLength: weightingTable?.length || 0,
            firstTableRow: weightingTable?.[0] ? {
                wavelength: weightingTable[0].wavelength,
                illuminant: weightingTable[0].illuminant_name,
                observer: weightingTable[0].observer,
                tableNumber: weightingTable[0].table_number,
                hasWhitePoint: !!(weightingTable[0].white_point_x),
                hasFactors: !!(weightingTable[0].x_factor)
            } : 'null'
        });
    }
    
    if (!spectralData || !weightingTable || weightingTable.length === 0) {
        if (traceE308 || forceDebug) {
            console.log('[E308-TRACE] Missing data', { 
                hasSpectral: !!spectralData, 
                tableRows: weightingTable?.length || 0 
            });
        }
        return { L: 0, a: 0, b: 0 };
    }
    
    // Extract white point from the weighting table (should be consistent across all rows)
    const firstRow = weightingTable[0];
    if (!firstRow || typeof firstRow.white_point_x === 'undefined') {
        if (DEBUG_SPECTRAL) console.error('ASTM E308 table missing white point data');
        return { L: 0, a: 0, b: 0 };
    }
    
    const whitePoint = {
        X: Number(firstRow.white_point_x) || 96.422,
        Y: Number(firstRow.white_point_y) || 100.000,
        Z: Number(firstRow.white_point_z) || 82.521
    };

    if (traceE308 && DEBUG_SPECTRAL) {
        const wls = weightingTable.map(r => Number(r.wavelength)).filter(n => !isNaN(n));
        const wlMin = Math.min(...wls);
        const wlMax = Math.max(...wls);
        const xSum = weightingTable.reduce((sum, r) => sum + Number(r.x_factor || 0), 0);
        const ySum = weightingTable.reduce((sum, r) => sum + Number(r.y_factor || 0), 0); 
        const zSum = weightingTable.reduce((sum, r) => sum + Number(r.z_factor || 0), 0);
        
        console.log('[E308-TRACE] Using ASTM table', {
            illuminant: firstRow.illuminant_name,
            observer: firstRow.observer,
            table: firstRow.table_number,
            rows: weightingTable.length,
            wlRange: `${wlMin}-${wlMax}`,
            whitePoint,
            weightsSum: { X: xSum.toFixed(4), Y: ySum.toFixed(4), Z: zSum.toFixed(4) }
        });
        
        // Spot check key wavelengths
        const wl380 = weightingTable.find(r => r.wavelength === 380);
        const wl390 = weightingTable.find(r => r.wavelength === 390);
        const wl730 = weightingTable.find(r => r.wavelength === 730);
        console.log('[E308-TRACE] Key wavelength spot checks:', {
            '380nm_x': wl380?.x_factor || 'missing',
            '390nm_x': wl390?.x_factor || 'missing', 
            '730nm_x': wl730?.x_factor || 'missing'
        });
    }
    
    const normalizedSpectral = detectAndNormalizeSpectralData(spectralData);
    
    if (forceDebug) {
        console.log('[E308-DEBUG] Normalized spectral data:', {
            originalKeys: Object.keys(spectralData || {}).slice(0, 5),
            normalizedKeys: Object.keys(normalizedSpectral).slice(0, 5),
            originalSample: Object.entries(spectralData || {}).slice(0, 3),
            normalizedSample: Object.entries(normalizedSpectral).slice(0, 3),
            normalizedCount: Object.keys(normalizedSpectral).length
        });
    }
    
    // Create wavelength-indexed lookup for efficiency using Number() not parseInt()
    const spectralLookup = {};
    for (const [wl, value] of Object.entries(normalizedSpectral)) {
        const wavelength = Number(wl);
        if (!isNaN(wavelength)) {
            spectralLookup[wavelength] = Number(value) || 0;
        }
    }
    
    // Determine spectral data range for ASTM E308 tail handling
    const spectralWavelengths = Object.keys(spectralLookup).map(Number).sort((a, b) => a - b);
    if (spectralWavelengths.length === 0) {
        if (forceDebug) {
            console.error('[E308-DEBUG] No valid spectral data found for ASTM E308', {
                spectralLookupKeys: Object.keys(spectralLookup),
                normalizedSpectralKeys: Object.keys(normalizedSpectral)
            });
        }
        return { L: 0, a: 0, b: 0 };
    }
    
    const minSampleWl = spectralWavelengths[0];
    const maxSampleWl = spectralWavelengths[spectralWavelengths.length - 1];
    
    if (traceE308 && DEBUG_SPECTRAL) {
        console.log('[E308-TRACE] Sample range', minSampleWl, 'to', maxSampleWl);
        console.log('[E308-TRACE] Spectral sample values:', {
            first3: spectralWavelengths.slice(0,3).map(wl => `${wl}:${spectralLookup[wl]?.toFixed(3)}`),
            last3: spectralWavelengths.slice(-3).map(wl => `${wl}:${spectralLookup[wl]?.toFixed(3)}`),
            totalPoints: spectralWavelengths.length
        });
    }
    
    // Get boundary reflectance values for tail handling
    const R_min = spectralLookup[minSampleWl] || 0;
    const R_max = spectralLookup[maxSampleWl] || 0;
    
    // Initialize accumulators
    let X = 0, Y = 0, Z = 0;
    let sum_S_x = 0, sum_S_y = 0, sum_S_z = 0;

    // Build fast lookups for ASTM factors and compute global sums
    const factorsByWl = new Map();
    const astmWavelengths = [];
    for (const row of weightingTable) {
        const wl = Number(row.wavelength);
        if (isNaN(wl)) continue;
        const x = Number(row.x_factor) || 0;
        const y = Number(row.y_factor) || 0;
        const z = Number(row.z_factor) || 0;
        factorsByWl.set(wl, { x, y, z });
        astmWavelengths.push(wl);
        sum_S_x += x;
        sum_S_y += y;
        sum_S_z += z;
    }
    astmWavelengths.sort((a,b) => a - b);

    // Helper: sum factors over a predicate on wl
    const sumFactors = (predicate) => {
        let sx = 0, sy = 0, sz = 0;
        for (const wl of astmWavelengths) {
            if (!predicate(wl)) continue;
            const f = factorsByWl.get(wl);
            sx += f.x; sy += f.y; sz += f.z;
        }
        return { sx, sy, sz };
    };

    // Use existing R_min and R_max from earlier declaration

    // Adapted weighting per user's ASTM E308 interpretation:
    // Sumproduct is over the SAMPLE range only. Build adapted weights:
    // - First sample λ: use sum of ASTM weights for all wl ≤ first (lower tail aggregated)
    // - Last sample λ: use sum of ASTM weights for all wl ≥ last (upper tail aggregated)
    // - Interior λ: use 1-for-1 ASTM weights at that λ

    if (spectralWavelengths.length === 1) {
        // Single-point spectrum: aggregate entire table into this wavelength
        const { sx, sy, sz } = { sx: sum_S_x, sy: sum_S_y, sz: sum_S_z };
        const R = R_min; // same as R_max
        X += R * sx;
        Y += R * sy;
        Z += R * sz;
        if (traceE308 && DEBUG_SPECTRAL) {
            console.log('[E308-TRACE] Single-point sample: applying full-table weights', { wl: minSampleWl, R: R.toFixed(6), sx: sx.toFixed(6), sy: sy.toFixed(6), sz: sz.toFixed(6) });
        }
    } else {
        // First wavelength with lower tail
        const lower = sumFactors(wl => wl <= minSampleWl);
        X += R_min * lower.sx;
        Y += R_min * lower.sy;
        Z += R_min * lower.sz;
        if (traceE308 && DEBUG_SPECTRAL) {
            console.log('[E308-TRACE] Lower tail aggregated at first sample', { wl: minSampleWl, R_min: R_min.toFixed(6), sx: lower.sx.toFixed(6), sy: lower.sy.toFixed(6), sz: lower.sz.toFixed(6) });
        }

        // Interior wavelengths (strictly between first and last)
        for (let i = 1; i < spectralWavelengths.length - 1; i++) {
            const wl = spectralWavelengths[i];
            const R = spectralLookup[wl] ?? 0;
            const f = factorsByWl.get(wl);
            if (!f) {
                if (traceE308 && DEBUG_SPECTRAL) console.warn('[E308-TRACE] Missing ASTM factor for interior wavelength; contributing 0', wl);
                continue;
            }
            X += R * f.x;
            Y += R * f.y;
            Z += R * f.z;
        }

        // Last wavelength with upper tail
        const upper = sumFactors(wl => wl >= maxSampleWl);
        X += R_max * upper.sx;
        Y += R_max * upper.sy;
        Z += R_max * upper.sz;
        if (traceE308 && DEBUG_SPECTRAL) {
            console.log('[E308-TRACE] Upper tail aggregated at last sample', { wl: maxSampleWl, R_max: R_max.toFixed(6), sx: upper.sx.toFixed(6), sy: upper.sy.toFixed(6), sz: upper.sz.toFixed(6) });
        }
    }

    // Final raw XYZ totals
    if (traceE308 || forceDebug) {
        console.log('[E308-DEBUG] Raw XYZ totals before normalization:', { 
            X: X.toFixed(6), 
            Y: Y.toFixed(6), 
            Z: Z.toFixed(6),
            sample_range: `${minSampleWl}-${maxSampleWl}nm`,
            astm_range: `${Math.min(...astmWavelengths)}-${Math.max(...astmWavelengths)}nm`,
            sum_S_x: sum_S_x.toFixed(6),
            sum_S_y: sum_S_y.toFixed(6),
            sum_S_z: sum_S_z.toFixed(6),
            astmTableFactorSample: weightingTable.slice(0, 3).map(r => ({
                wl: r.wavelength,
                x: r.x_factor,
                y: r.y_factor,
                z: r.z_factor
            }))
        });
    }

    // Compute white point directly from weighting factors
    const Xn_computed = sum_S_x;
    const Yn_computed = sum_S_y; 
    const Zn_computed = sum_S_z;

    if (traceE308 && DEBUG_SPECTRAL) {
        console.log('[E308-TRACE] Direct XYZ calculation', { 
            XYZ_direct: { X: X.toFixed(4), Y: Y.toFixed(4), Z: Z.toFixed(4) }
        });
        console.log('[E308-TRACE] Computed white point from factors', { 
            Xn: Xn_computed.toFixed(4), 
            Yn: Yn_computed.toFixed(4), 
            Zn: Zn_computed.toFixed(4) 
        });
        console.log('[E308-TRACE] Using table white point for normalization', whitePoint);
    }

    // Use ASTM table white point for normalization
    const Xn = Number(whitePoint.X);
    const Yn = Number(whitePoint.Y);
    const Zn = Number(whitePoint.Z);
    
    // CIE Lab conversion using standard formulas with intent values
    const f = (t) => {
        // Use intent values as specified in the formulas
        const epsilon = 216.0 / 24389.0;  // ε threshold
        const kappa = 24389.0 / 27.0;     // κ slope coefficient
        
        if (t > epsilon) {
            return Math.cbrt(t);  // cube root for t > ε
        } else {
            return (kappa * t + 16.0) / 116.0;  // linear portion for t ≤ ε
        }
    };

    const xr = X / Number(Xn);
    const yr = Y / Number(Yn);
    const zr = Z / Number(Zn);

    if (traceE308 && DEBUG_SPECTRAL) {
        console.log('[E308-TRACE] Normalized XYZ ratios', { 
            xr: xr.toFixed(6), 
            yr: yr.toFixed(6), 
            zr: zr.toFixed(6)
        });
        console.log('[E308-TRACE] Absolute XYZ (0-100 scale)', { 
            X_abs: (xr * 100).toFixed(2), 
            Y_abs: (yr * 100).toFixed(2), 
            Z_abs: (zr * 100).toFixed(2) 
        });
    }

    const fx = f(xr);
    const fy = f(yr);
    const fz = f(zr);

    if (traceE308 && DEBUG_SPECTRAL) {
        console.log('[E308-TRACE] f() transforms', { 
            fx: fx.toFixed(6), 
            fy: fy.toFixed(6), 
            fz: fz.toFixed(6) 
        });
    }

    const L = 116.0 * fy - 16.0;
    const a = 500.0 * (fx - fy);
    const b = 200.0 * (fy - fz);

    if (traceE308 || forceDebug) {
        console.log('[E308-DEBUG] Final Lab values calculation:', { 
            L: L.toFixed(4), 
            a: a.toFixed(4), 
            b: b.toFixed(4),
            isFinite: {
                L: Number.isFinite(L),
                a: Number.isFinite(a),
                b: Number.isFinite(b)
            },
            whitePointUsed: { Xn, Yn, Zn },
            ratios: { xr: xr.toFixed(6), yr: yr.toFixed(6), zr: zr.toFixed(6) }
        });
    }
    
    if (DEBUG_SPECTRAL) sdebug.info('E308: Final Lab', { L: Number(L.toFixed(2)), a: Number(a.toFixed(2)), b: Number(b.toFixed(2)) });

    if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) {
        if (forceDebug) {
            console.error('[E308-DEBUG] Invalid Lab values in ASTM E308', {
                L, a, b,
                rawXYZ: { X, Y, Z },
                whitePoint: { Xn, Yn, Zn },
                ratios: { xr, yr, zr }
            });
        }
        return { L: 0, a: 0, b: 0 };
    }

    return { L, a, b };
}


export function labToHex(L_in, a_in, b_in, illuminantKey = 'D50') {
  const L = L_in ?? 0;
  const a = a_in ?? 0;
  const b = b_in ?? 0;

  const whitePoint = WHITE_POINTS[illuminantKey];
  if (!whitePoint) {
    if (DEBUG_SPECTRAL) console.error('Invalid illuminant key for Lab to Hex conversion');
    return '#000000';
  }
  const { X: Xn, Y: Yn, Z: Zn } = whitePoint;

  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const delta = 6 / 29;
  
  const x_ratio = fx > delta ? Math.pow(fx, 3) : 3 * Math.pow(delta, 2) * (fx - 4/29);
  const y_ratio = L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3;
  const z_ratio = fz > delta ? Math.pow(fz, 3) : 3 * Math.pow(delta, 2) * (fz - 4/29);

  let X = x_ratio * Xn;
  let Y = y_ratio * Yn;
  let Z = z_ratio * Zn;

  const M = [
    [ 3.2404542, -1.5371385, -0.4985314],
    [-0.9692660,  1.8760108,  0.0415560],
    [ 0.0556434, -0.2040259,  1.0572252]
  ];

  const R_linear = (M[0][0] * X + M[0][1] * Y + M[0][2] * Z) / 100;
  const G_linear = (M[1][0] * X + M[1][1] * Y + M[1][2] * Z) / 100;
  const B_linear = (M[2][0] * X + M[2][1] * Y + M[2][2] * Z) / 100;

  const gammaCorrect = (c) => {
    const v = c < 0 ? 0 : c;
    return v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
  };

  const R = Math.round(Math.max(0, Math.min(255, gammaCorrect(R_linear) * 255)));
  const G = Math.round(Math.max(0, Math.min(255, gammaCorrect(G_linear) * 255)));
  const B = Math.round(Math.max(0, Math.min(255, gammaCorrect(B_linear) * 255)));

  const toHex = (c) => ('0' + c.toString(16)).slice(-2);

  return `#${toHex(R)}${toHex(G)}${toHex(B)}`.toUpperCase();
}

// Calculate Chroma (C*) and Hue angle (h*) from LAB values
export function labToChromaHue(L, a, b) {
  if (a === undefined || b === undefined || a === null || b === null) {
    return { C: 0, h: 0 };
  }
  // Calculate Chroma: C* = √(a² + b²)
  const C = Math.sqrt(a * a + b * b);
  // Calculate Hue angle: h* = atan2(b, a) in degrees
  let h = Math.atan2(b, a) * (180 / Math.PI);
  // Ensure hue is in range [0, 360)
  if (h < 0) {
    h += 360;
  }
  return { C, h };
}

// Bradford chromatic adaptation matrix
const BRADFORD_M = [
  [ 0.8951,  0.2664, -0.1614],
  [-0.7502,  1.7135,  0.0367],
  [ 0.0389, -0.0685,  1.0296]
];

const BRADFORD_M_INV = [
  [ 0.9869929, -0.1470543,  0.1599627],
  [ 0.4323053,  0.5183603,  0.0492912],
  [-0.0085287,  0.0400428,  0.9684867]
];

// Convert Lab from one illuminant to another using chromatic adaptation
export function labChromaticAdaptation(L, a, b, sourceIlluminant, targetIlluminant) {
  if (sourceIlluminant === targetIlluminant) {
    return { L, a, b };
  }

  const sourceWP = WHITE_POINTS[sourceIlluminant] || WHITE_POINTS['D50'];
  const targetWP = WHITE_POINTS[targetIlluminant] || WHITE_POINTS['D65'];

  // Convert Lab to XYZ using source illuminant
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const delta = 6 / 29;
  
  const x_ratio = fx > delta ? Math.pow(fx, 3) : 3 * Math.pow(delta, 2) * (fx - 4/29);
  const y_ratio = L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3;
  const z_ratio = fz > delta ? Math.pow(fz, 3) : 3 * Math.pow(delta, 2) * (fz - 4/29);

  const X = x_ratio * sourceWP.X;
  const Y = y_ratio * sourceWP.Y;
  const Z = z_ratio * sourceWP.Z;

  // Apply Bradford chromatic adaptation
  // Convert XYZ to cone response domain
  const rho_s = BRADFORD_M[0][0] * X + BRADFORD_M[0][1] * Y + BRADFORD_M[0][2] * Z;
  const gamma_s = BRADFORD_M[1][0] * X + BRADFORD_M[1][1] * Y + BRADFORD_M[1][2] * Z;
  const beta_s = BRADFORD_M[2][0] * X + BRADFORD_M[2][1] * Y + BRADFORD_M[2][2] * Z;

  // Get cone responses for white points
  const rho_ws = BRADFORD_M[0][0] * sourceWP.X + BRADFORD_M[0][1] * sourceWP.Y + BRADFORD_M[0][2] * sourceWP.Z;
  const gamma_ws = BRADFORD_M[1][0] * sourceWP.X + BRADFORD_M[1][1] * sourceWP.Y + BRADFORD_M[1][2] * sourceWP.Z;
  const beta_ws = BRADFORD_M[2][0] * sourceWP.X + BRADFORD_M[2][1] * sourceWP.Y + BRADFORD_M[2][2] * sourceWP.Z;

  const rho_wd = BRADFORD_M[0][0] * targetWP.X + BRADFORD_M[0][1] * targetWP.Y + BRADFORD_M[0][2] * targetWP.Z;
  const gamma_wd = BRADFORD_M[1][0] * targetWP.X + BRADFORD_M[1][1] * targetWP.Y + BRADFORD_M[1][2] * targetWP.Z;
  const beta_wd = BRADFORD_M[2][0] * targetWP.X + BRADFORD_M[2][1] * targetWP.Y + BRADFORD_M[2][2] * targetWP.Z;

  // Apply adaptation
  const rho_d = rho_s * (rho_wd / rho_ws);
  const gamma_d = gamma_s * (gamma_wd / gamma_ws);
  const beta_d = beta_s * (beta_wd / beta_ws);

  // Convert back to XYZ
  const X_adapted = BRADFORD_M_INV[0][0] * rho_d + BRADFORD_M_INV[0][1] * gamma_d + BRADFORD_M_INV[0][2] * beta_d;
  const Y_adapted = BRADFORD_M_INV[1][0] * rho_d + BRADFORD_M_INV[1][1] * gamma_d + BRADFORD_M_INV[1][2] * beta_d;
  const Z_adapted = BRADFORD_M_INV[2][0] * rho_d + BRADFORD_M_INV[2][1] * gamma_d + BRADFORD_M_INV[2][2] * beta_d;

  // Convert adapted XYZ back to Lab using target illuminant
  const xr = X_adapted / targetWP.X;
  const yr = Y_adapted / targetWP.Y;
  const zr = Z_adapted / targetWP.Z;

  const fx_new = xr > Math.pow(delta, 3) ? Math.pow(xr, 1/3) : (xr / (3 * Math.pow(delta, 2)) + 4/29);
  const fy_new = yr > Math.pow(delta, 3) ? Math.pow(yr, 1/3) : (yr / (3 * Math.pow(delta, 2)) + 4/29);
  const fz_new = zr > Math.pow(delta, 3) ? Math.pow(zr, 1/3) : (zr / (3 * Math.pow(delta, 2)) + 4/29);

  const L_adapted = 116 * fy_new - 16;
  const a_adapted = 500 * (fx_new - fy_new);
  const b_adapted = 200 * (fy_new - fz_new);

  return { L: L_adapted, a: a_adapted, b: b_adapted };
}

// Convert Lab to Hex with D65 standardization
export function labToHexD65(L, a, b, sourceIlluminant = 'D50') {
  // Always adapt to D65 before converting to hex
  const adaptedLab = labChromaticAdaptation(L, a, b, sourceIlluminant, 'D65');
  return labToHex(adaptedLab.L, adaptedLab.a, adaptedLab.b, 'D65');
}

// Approximate HEX (sRGB) to CIE Lab conversion
// Note: Uses sRGB D65 to XYZ matrix and computes Lab using the provided illuminant white point (default D50)
// Get display hex color for UI components using organization defaults
// Uses spectral data with org defaults (same logic as appearance block), with fallbacks
export function getDisplayHexWithOrgDefaults(color, orgDefaults, astmTables = null) {
  if (!color) return '#E5E7EB';
  
  // Get organization defaults with fallbacks
  const illuminant = orgDefaults?.default_illuminant || 'D50';
  const observer = orgDefaults?.default_observer || '2';
  const tableNumber = orgDefaults?.default_astm_table || '5';
  
  // Priority 1: Use spectral data with org defaults (same as appearance block)
  if (color.spectral_data && astmTables?.length > 0) {
    try {
      // Find matching ASTM table for illuminant/observer/table combination
      const weightingTable = astmTables.filter(row => 
        row.illuminant_name === illuminant && 
        String(row.observer) === String(observer) &&
        String(row.table_number) === String(tableNumber)
      );

      if (weightingTable?.length > 0) {
        const lab = spectralToLabASTME308(color.spectral_data, weightingTable);
        if (lab && typeof lab.L === 'number' && typeof lab.a === 'number' && typeof lab.b === 'number') {
          return labToHexD65(lab.L, lab.a, lab.b, illuminant);
        }
      }
    } catch (error) {
      console.warn('Error calculating hex from spectral data with org defaults:', error);
    }
  }
  
  // Priority 2: Use stored Lab values with actual Lab illuminant (not org default)
  if (color.lab_l !== undefined && color.lab_a !== undefined && color.lab_b !== undefined &&
      typeof color.lab_l === 'number' && typeof color.lab_a === 'number' && typeof color.lab_b === 'number' &&
      !isNaN(color.lab_l) && !isNaN(color.lab_a) && !isNaN(color.lab_b)) {
    
    try {
      // Use the color's actual Lab illuminant, not the org default
      const sourceIlluminant = color.lab_illuminant || 'D50';
      return labToHexD65(color.lab_l, color.lab_a, color.lab_b, sourceIlluminant);
    } catch (error) {
      console.warn('Error converting stored Lab to hex with actual illuminant:', error);
    }
  }
  
  // Priority 3: Fallback to stored hex value
  return color.hex || '#E5E7EB';
}

// Get display hex color for UI components (legacy function for D50 Lab)
// Uses D50 Lab values when available, falls back to stored hex
// For ink-based colors, prioritizes ink condition color over color's own hex
export function getDisplayHex(color) {
  if (!color) return '#E5E7EB';
  
  // For ink-based colors, first try to use the ink condition's color if available
  if (color.from_ink_condition_id && color.ink_condition?.color_hex) {
    return color.ink_condition.color_hex;
  }
  
  // If ink condition data isn't loaded but we have the ID, the color's hex should be synced
  
  // Check if we have valid D50 Lab values
  if (typeof color.lab_l === 'number' && 
      typeof color.lab_a === 'number' && 
      typeof color.lab_b === 'number' &&
      !isNaN(color.lab_l) && !isNaN(color.lab_a) && !isNaN(color.lab_b) &&
      color.lab_illuminant === 'D50') {
    
    try {
      // Convert D50 Lab to hex using D50 white point
      return labToHex(color.lab_l, color.lab_a, color.lab_b, 'D50');
    } catch (error) {
      console.warn('Error converting D50 Lab to hex:', error);
    }
  }
  
  // Fallback to existing hex value if it's valid
  if (color.hex && typeof color.hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color.hex)) {
    return color.hex;
  }
  
  // Final fallback
  return '#E5E7EB';
}

// Approximate HEX (sRGB) to CIE Lab conversion
// Note: Uses sRGB D65 to XYZ matrix and computes Lab using the provided illuminant white point (default D50)
export function hexToLab(hex, illuminantKey = 'D50') {
  if (!hex) return { L: 0, a: 0, b: 0 };

  const whitePoint = WHITE_POINTS[illuminantKey];
  if (!whitePoint) {
    console.error('Invalid illuminant key for Hex to Lab conversion');
    return { L: 0, a: 0, b: 0 };
  }
  const { X: Xn, Y: Yn, Z: Zn } = whitePoint;

  const parseHex = (h) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return { r, g, b };
  };

  const rgb = parseHex(hex);
  if (Number.isNaN(rgb.r) || Number.isNaN(rgb.g) || Number.isNaN(rgb.b)) return { L: 0, a: 0, b: 0 };

  // Normalize to 0..1
  let R = rgb.r / 255;
  let G = rgb.g / 255;
  let B = rgb.b / 255;

  // Inverse gamma correction (sRGB)
  const invGamma = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  R = invGamma(R);
  G = invGamma(G);
  B = invGamma(B);

  // sRGB D65 linear RGB to XYZ (scale to 0..100)
  const invM = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041],
  ];

  let X = (invM[0][0] * R + invM[0][1] * G + invM[0][2] * B) * 100;
  let Y = (invM[1][0] * R + invM[1][1] * G + invM[1][2] * B) * 100;
  let Z = (invM[2][0] * R + invM[2][1] * G + invM[2][2] * B) * 100;

  const f = (t) => (t > Math.pow(6 / 29, 3) ? Math.cbrt(t) : (1 / 3) * Math.pow(29 / 6, 2) * t + 4 / 29);

  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return { L, a, b };
}

// Helper function to compute stored hex value consistently from spectral/Lab data
// Enhanced color calculation with flexible data access patterns
/**
/**
 * Helper function to extract Lab values from various object formats
 * @param {Object} color - Color object that may contain Lab values in various formats
 * @returns {Object|null} Object with { L, a, b } or null if no valid Lab values found
 */
function getLabValuesForObject(color) {
  if (!color) return null;
  
  // Try lab object first
  if (color.lab && typeof color.lab === 'object') {
    const L = color.lab.L ?? color.lab.l;
    const a = color.lab.a ?? color.lab.A;
    const b = color.lab.b ?? color.lab.B;
    if (typeof L === 'number' && typeof a === 'number' && typeof b === 'number' &&
        !isNaN(L) && !isNaN(a) && !isNaN(b)) {
      return { L, a, b };
    }
  }
  
  // Try separate lab_l, lab_a, lab_b fields
  if (color.lab_l !== undefined && color.lab_a !== undefined && color.lab_b !== undefined &&
      typeof color.lab_l === 'number' && typeof color.lab_a === 'number' && typeof color.lab_b === 'number' &&
      !isNaN(color.lab_l) && !isNaN(color.lab_a) && !isNaN(color.lab_b)) {
    return { L: color.lab_l, a: color.lab_a, b: color.lab_b };
  }
  
  // Try direct L, a, b fields
  if (color.L !== undefined && color.a !== undefined && color.b !== undefined &&
      typeof color.L === 'number' && typeof color.a === 'number' && typeof color.b === 'number' &&
      !isNaN(color.L) && !isNaN(color.a) && !isNaN(color.b)) {
    return { L: color.L, a: color.a, b: color.b };
  }
  
  return null;
}

/**
 * Compute the default display color hex using organization defaults or dynamic measurement controls.
 * This function uses the organization's default illuminant, observer, and ASTM table
 * to compute a consistent display color from spectral data or Lab values.
 * 
 * @param {Object} color - The color object (with spectral_data, lab, or hex)
 * @param {Object} orgDefaults - Organization defaults (default_illuminant, default_observer, default_astm_table)
 * @param {Array} astmTables - ASTM E308 weighting tables for spectral calculations
 * @param {string} activeDataMode - For ink-based colors: 'imported' or 'adapted'
 * @param {Object} spectralDataOverride - Optional pre-selected spectral data to use instead of auto-detection
 * @param {Object} measurementControls - Optional dynamic measurement controls to override org defaults
 * @returns {Object} Object with hex color string and lab values: { hex: string, lab: { L, a, b } | null }
 */
export function computeDefaultDisplayColor(color, orgDefaults, astmTables = null, activeDataMode = 'imported', spectralDataOverride = null, measurementControls = {}) {
  // Normalization helpers for ASTM table matching
  const normalizeObserver = (v) => String(v || '').replace(/[^0-9]/g, '');
  const normalizeIlluminant = (v) => String(v || '').toUpperCase().trim();
  
  // Early validation
  if (!color || typeof color !== 'object') {
    console.warn('[computeDefaultDisplayColor] Invalid color object');
    return { hex: '#E5E7EB', lab: null };
  }
  
  // Enhanced debug logging
  const spectralData = spectralDataOverride || getSpectralDataForObject(color, activeDataMode, measurementControls);
  console.log('computeDefaultDisplayColor:', {
    colorType: color.constructor?.name, 
    hasSpectralData: !!spectralData,
    hasSpectral: !!color.spectral_data,
    hasSpectralDataCamel: !!color.spectralData,
    hasSpectralString: !!color.spectral_string,
    hasSubstrateTints: !!(color.substrateTints || color.tints),
    hasLab: !!(color.lab || (color.lab_l !== undefined)),
    activeDataMode,
    spectralDataOverride: !!spectralDataOverride,
    hasMeasurementControls: !!Object.keys(measurementControls).length,
    detectedPath: spectralData ? 'spectral' : (color.lab || color.lab_l !== undefined) ? 'lab' : 'stored-hex'
  });
  
  // Get illuminant, observer, and table from measurement controls OR org defaults
  const illuminant = measurementControls?.illuminant || orgDefaults?.default_illuminant || 'D50';
  const observer = measurementControls?.observer || orgDefaults?.default_observer || '2';
  const tableNumber = measurementControls?.table || orgDefaults?.default_astm_table || '5';
  
  // Enhanced illuminant detection - check measurement_settings first
  const sourceIlluminant = color.measurement_settings?.illuminant || 
                          color.lab_illuminant || 
                          'D50';
  
  // Priority 1: Use spectral data with org defaults (only if we have ASTM tables)
  if (spectralData && astmTables && Array.isArray(astmTables) && astmTables.length > 0) {
    try {
      // Find matching ASTM table with normalized observer/illuminant comparison
      const weightingTable = astmTables.filter(row => 
        normalizeIlluminant(row.illuminant_name) === normalizeIlluminant(illuminant) && 
        normalizeObserver(row.observer) === normalizeObserver(observer) &&
        String(row.table_number) === String(tableNumber)
      );

      if (weightingTable?.length > 0) {
        const lab = spectralToLabASTME308(spectralData, weightingTable);
        if (lab && typeof lab.L === 'number' && typeof lab.a === 'number' && typeof lab.b === 'number') {
          console.log('computeDefaultDisplayColor: Using spectral path', { lab, sourceIlluminant: illuminant });
          const hex = labToHexD65(lab.L, lab.a, lab.b, illuminant);
          return { hex, lab };
        }
      } else {
        console.warn('[computeDefaultDisplayColor] No matching ASTM table found for:', { illuminant, observer, tableNumber });
      }
    } catch (error) {
      console.warn('Error calculating hex from spectral data for storage:', error);
    }
  } else if (spectralData && (!astmTables || !Array.isArray(astmTables) || astmTables.length === 0)) {
    console.warn('[computeDefaultDisplayColor] Spectral data present but no ASTM tables available');
  }
  
  // Priority 2: Use stored Lab values - flexible access pattern
  const labValues = getLabValuesForObject(color);
  if (labValues) {
    try {
      console.log('computeDefaultDisplayColor: Using Lab path', { labValues, sourceIlluminant });
      const hex = labToHexD65(labValues.L, labValues.a, labValues.b, sourceIlluminant);
      return { hex, lab: labValues };
    } catch (error) {
      console.warn('Error converting stored Lab to hex for storage:', error);
    }
  }
  
  // Priority 3: Fallback to existing stored hex (no Lab available)
  const fallbackHex = color.hex || color.color_hex || '#E5E7EB';
  return { hex: fallbackHex, lab: null };
}

// Helper function to get spectral data based on object type and mode
function getSpectralDataForObject(color, activeDataMode, measurementControls = {}) {
  const measurements = Array.isArray(color?.measurements) ? color.measurements : [];
  const adaptedTints = normalizeInkTints(color?.adapted_tints);
  const importedTints = normalizeInkTints(color?.imported_tints);
  
  // Choose the appropriate tints array based on activeDataMode
  const activeTints = activeDataMode === 'adapted' ? adaptedTints : importedTints;
  
  // Determine what we have in the active tints array
  const has100 = activeTints.some(t => getTintPercentage(t) === 100);
  const hasZero = activeTints.some(t => getTintPercentage(t) === 0);
  const hasNonZero = activeTints.some(t => getTintPercentage(t) > 0);

  // Priority 1: If has 100% solid tint, use it (ink condition solid)
  if (has100) {
    // Find all 100% tint candidates
    const solid100Candidates = activeTints.filter(t => getTintPercentage(t) === 100);
    
    // If measurementControls.mode is specified, prefer mode-matched measurement
    if (measurementControls?.mode && solid100Candidates.length > 0) {
      const modeNorm = normalizeMode(measurementControls.mode);
      for (const tint of solid100Candidates) {
        const tintMeasurements = Array.isArray(tint.measurements) ? tint.measurements : [];
        const modeMatchedMeasurement = tintMeasurements.find(m => {
          const mMode = getModeFromMeasurement(m);
          return normalizeMode(mMode) === modeNorm;
        });
        if (modeMatchedMeasurement) {
          const spectral = safeSpectralData(modeMatchedMeasurement);
          if (spectral && Object.keys(spectral).length > 0) {
            console.log('getSpectralDataForObject: Using mode-matched 100% solid tint spectral', {
              mode: modeNorm,
              dataMode: activeDataMode
            });
            return spectral;
          }
        }
      }
    }
    
    // Fallback: Use any spectral data from 100% tint
    for (const tint of solid100Candidates) {
      const spectral = safeSpectralData(tint);
      if (spectral && Object.keys(spectral).length > 0) {
        console.log('getSpectralDataForObject: Using 100% solid tint spectral data', {
          tintPercentage: 100,
          dataMode: activeDataMode
        });
        return spectral;
      }
    }
  }

  // Priority 2: If has 0% substrate (ONLY if no non-zero tints exist)
  // This prevents incorrect fallback to substrate when 100% solid exists
  if (hasZero && !hasNonZero) {
    const zeroTints = activeTints.filter(t => getTintPercentage(t) === 0);
    for (const tint of zeroTints) {
      const spectral = safeSpectralData(tint);
      if (spectral && Object.keys(spectral).length > 0) {
        console.log('getSpectralDataForObject: Using 0% substrate spectral (no non-zero tints)', {
          dataMode: activeDataMode,
          reason: 'substrate-only'
        });
        return spectral;
      }
    }
  }

  // Priority 3: Check color.measurements for mode-aware selection
  if (measurementControls?.mode && measurements.length > 0) {
    const modeNorm = normalizeMode(measurementControls.mode);
    const modeMatchedMeasurement = measurements.find(m => {
      const mMode = getModeFromMeasurement(m);
      return normalizeMode(mMode) === modeNorm;
    });
    if (modeMatchedMeasurement) {
      const spectral = safeSpectralData(modeMatchedMeasurement);
      if (spectral && Object.keys(spectral).length > 0) {
        console.log('getSpectralDataForObject: Using mode-matched measurement spectral', {
          mode: modeNorm
        });
        return spectral;
      }
    }
  }

  // Priority 4: Direct spectral_data field on color object
  if (color?.spectral_data && typeof color.spectral_data === 'object' && Object.keys(color.spectral_data).length > 0) {
    return color.spectral_data;
  }

  // Priority 5: CXF format - spectralData field
  if (color?.spectralData && typeof color.spectralData === 'object' && Object.keys(color.spectralData).length > 0) {
    return color.spectralData;
  }

  // Priority 6: CXF format - spectral_string (parse if needed)
  if (color?.spectral_string) {
    try {
      const parsed = typeof color.spectral_string === 'string' ? JSON.parse(color.spectral_string) : color.spectral_string;
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }

  // Priority 7: CXF format - substrateTints array (substrate condition)
  if (color?.substrateTints && Array.isArray(color.substrateTints) && color.substrateTints.length > 0) {
    const normalizedSubTints = normalizeInkTints(color.substrateTints);
    const zeroTints = normalizedSubTints.filter(t => getTintPercentage(t) === 0);
    for (const tint of zeroTints) {
      const spectral = safeSpectralData(tint);
      if (spectral && Object.keys(spectral).length > 0) {
        return spectral;
      }
    }
  }

  // Priority 8: Print condition substrate spectral (from printConditionSubstrateSpectral param)
  if (measurementControls?.printConditionSubstrateSpectral && typeof measurementControls.printConditionSubstrateSpectral === 'object') {
    const spectral = measurementControls.printConditionSubstrateSpectral;
    if (Object.keys(spectral).length > 0) {
      return spectral;
    }
  }

  return null;
}
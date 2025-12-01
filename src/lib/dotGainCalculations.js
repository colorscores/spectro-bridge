// Dot gain calculation utilities for ink characterization
import { spectralToLabASTME308 } from '@/lib/colorUtils';

/**
 * Diagnostic helper to log spectral data format
 */
export const logSpectralDataDiagnostic = (wedgeData, label = '') => {
  if (!wedgeData || !Array.isArray(wedgeData)) return;
  
  const sample = wedgeData.find(w => w.spectralData);
  if (!sample) {
    console.log(`🔍 ${label} No spectral data found in wedges`);
    return;
  }
  
  const spectralKeys = Object.keys(sample.spectralData).slice(0, 10);
  const spectralValues = Object.values(sample.spectralData).slice(0, 10);
  
  console.log(`🔍 ${label} Spectral data format:`, {
    sampleKeys: spectralKeys,
    sampleValues: spectralValues,
    keyTypes: spectralKeys.map(k => typeof k),
    valueTypes: spectralValues.map(v => typeof v),
    hasNmSuffix: spectralKeys.some(k => String(k).includes('nm')),
    numericalKeys: spectralKeys.map(k => parseInt(String(k).replace('nm', ''))).filter(n => !isNaN(n))
  });
};

/**
 * Calculate density range for channel selection using maximum density range method
 * @param {Object} substrateSpectral - Substrate (0%) spectral data
 * @param {Object} solidSpectral - Solid (100%) spectral data
 * @param {Object} iso53WeightingFunctions - ISO 5-3 weighting functions
 * @returns {Object} - Density ranges for all channels
 */
export const calculateDensityRangeForChannelSelection = (substrateSpectral, solidSpectral, iso53WeightingFunctions) => {
  const channels = ['red', 'green', 'blue', 'visual'];
  const results = {};
    
  if (!substrateSpectral || !solidSpectral || !iso53WeightingFunctions) {
    console.warn('⚠️ Missing data for density range calculation, falling back to spectral analysis');
    return null;
  }
  
  // Normalize spectral data
  const normalizedSubstrate = detectAndNormalizeSpectralData(substrateSpectral);
  const normalizedSolid = detectAndNormalizeSpectralData(solidSpectral);
  
  if (Object.keys(normalizedSubstrate).length === 0 || Object.keys(normalizedSolid).length === 0) {
    console.warn('⚠️ Failed to normalize spectral data for density range calculation');
    return null;
  }
  
  channels.forEach(channel => {
    try {
      const substrateDensity = calculateIso53Density(normalizedSubstrate, channel, iso53WeightingFunctions);
      const solidDensity = calculateIso53Density(normalizedSolid, channel, iso53WeightingFunctions);
      const range = solidDensity - substrateDensity;
      
      results[channel] = {
        substrateDensity,
        solidDensity,
        range,
        isValid: substrateDensity !== null && solidDensity !== null && range > 0
      };
      
    } catch (error) {
      console.warn(`❌ Error calculating density range for ${channel} channel:`, error);
      results[channel] = { substrateDensity: null, solidDensity: null, range: 0, isValid: false };
    }
  });
  
  return results;
};

/**
 * Auto-select optimal density channel using maximum density range method
 * @param {string} inkType - Ink type hint (optional)
 * @param {Object} spectralData - Single spectral measurement for fallback analysis
 * @param {Object} substrateSpectral - Substrate (0%) spectral data for range calculation
 * @param {Object} solidSpectral - Solid (100%) spectral data for range calculation
 * @param {Object} iso53WeightingFunctions - ISO 5-3 weighting functions
 * @returns {string} - Selected density channel
 */
export const autoSelectDensityChannel = (inkType = null, spectralData = null, substrateSpectral = null, solidSpectral = null, iso53WeightingFunctions = null) => {

  // METHOD 1: Maximum Density Range (Industry Standard)
  if (substrateSpectral && solidSpectral && iso53WeightingFunctions) {
    const densityRanges = calculateDensityRangeForChannelSelection(substrateSpectral, solidSpectral, iso53WeightingFunctions);
    
    if (densityRanges) {
      // Find channel with maximum density range
      let maxRange = 0;
      let bestChannel = 'visual';
      
      Object.entries(densityRanges).forEach(([channel, data]) => {
        if (data.isValid && data.range > maxRange) {
          maxRange = data.range;
          bestChannel = channel;
        }
      });
      
      if (maxRange > 0) {
        console.log(`✅ Selected ${bestChannel} channel using maximum density range method (range: ${maxRange.toFixed(4)})`);
        return bestChannel;
      }
    }
  }

  // METHOD 2: Ink Type Mapping (Fast Fallback)
  if (inkType) {
    const type = inkType.toLowerCase();
    let selectedChannel = 'visual';
    
    if (type.includes('cyan') || type.includes('c')) selectedChannel = 'red';
    else if (type.includes('magenta') || type.includes('m')) selectedChannel = 'green';
    else if (type.includes('yellow') || type.includes('y')) selectedChannel = 'blue';
    else if (type.includes('black') || type.includes('k')) selectedChannel = 'visual';
    
    if (selectedChannel !== 'visual') {
      console.log(`✅ Selected ${selectedChannel} channel using ink type mapping (${inkType})`);
      return selectedChannel;
    }
  }

  // METHOD 3: Spectral Analysis Fallback (Single Measurement)
  if (spectralData && typeof spectralData === 'object') {
    const wavelengths = Object.keys(spectralData);
    let maxAbsorption = 0;
    let bestChannel = 'visual';

    // Check each channel for maximum absorption
    const channelMappings = {
      red: { range: [600, 700] },    // For cyan inks
      green: { range: [500, 600] },  // For magenta inks  
      blue: { range: [400, 500] },   // For yellow inks
      visual: { range: [400, 700] }  // For black or unknown inks
    };

    Object.entries(channelMappings).forEach(([channelName, channel]) => {
      const channelWavelengths = wavelengths.filter(wl => {
        const wavelength = parseInt(wl.replace('nm', ''));
        return wavelength >= channel.range[0] && wavelength <= channel.range[1];
      });

      if (channelWavelengths.length > 0) {
        const avgReflectance = channelWavelengths.reduce((sum, wl) => {
          return sum + (parseFloat(spectralData[wl]) || 0);
        }, 0) / channelWavelengths.length;

        // Higher absorption (lower reflectance) indicates better channel
        const absorption = 100 - avgReflectance;
        if (absorption > maxAbsorption) {
          maxAbsorption = absorption;
          bestChannel = channelName;
        }
      }
    });

    console.log(`✅ Selected ${bestChannel} channel using spectral analysis fallback (absorption: ${maxAbsorption.toFixed(2)}%)`);
    return bestChannel;
  }

  // METHOD 4: Default Fallback
  console.log('✅ Selected visual channel as default fallback');
  return 'visual';
};

// Import the unified spectral data processing function from ASTM E308 pipeline
function detectAndNormalizeSpectralData(spectralData) {
  if (!spectralData || typeof spectralData !== 'object') {
    console.log('🔍 detectAndNormalizeSpectralData: No spectral data provided');
    return {};
  }

  const result = {};
  let hasPercentageValues = false;
  
  // Sample input data for diagnostics
  const keys = Object.keys(spectralData).slice(0, 5);
  const values = Object.values(spectralData).slice(0, 5);
  
  // Check if we have percentage values (>1.0) - be more conservative
  const allValues = Object.values(spectralData);
  const numericValues = allValues.filter(v => typeof v === 'number' && !isNaN(v) && v >= 0);
  if (numericValues.length > 0) {
    const maxValue = Math.max(...numericValues);
    const avgValue = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
    // Only treat as percentage if max > 1.1 AND average > 1.0 (safer heuristic)
    hasPercentageValues = maxValue > 1.1 && avgValue > 1.0;
  }

  // Process each wavelength
  for (const [wavelength, value] of Object.entries(spectralData)) {
    // FIX: Parse wavelength correctly by removing "nm" suffix
    const wl = parseInt(String(wavelength).replace('nm', ''));
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

/**
 * Calculate optical density from spectral data using ISO 5-3 weighted summation
 * @param {Object|Array} spectralData - Spectral reflectance data
 * @param {string} inkType - Type of ink (Cyan, Magenta, Yellow, Black)
 * @param {string} status - Status type (T or E, defaults to T)
 * @param {Object} iso53WeightingFunctions - ISO 5-3 weighting functions
 * @returns {number} - Calculated density value
 */
export const calculateDensityWithChannel = (spectralData, inkType = null, status = 'T', iso53WeightingFunctions = null) => {
  try {
    // Use the same spectral data processing as ASTM E308
    const normalizedData = detectAndNormalizeSpectralData(spectralData);
    
    if (!normalizedData || Object.keys(normalizedData).length === 0) {
      console.warn('⚠️ No valid spectral data after normalization - returning null instead of 0');
      return null; // Return null to distinguish from "calculated as 0"
    }

    // Auto-select the optimal density channel (no substrate/solid data available here)
    const channel = autoSelectDensityChannel(inkType, normalizedData);
    
    // Calculate density using ISO 5-3 weighted summation if available
    if (iso53WeightingFunctions && iso53WeightingFunctions[channel]) {
      const density = calculateIso53Density(normalizedData, channel, iso53WeightingFunctions);
      return density;
    }
    
    // Fallback to simple averaging for backwards compatibility
    const density = calculateDensity(normalizedData);
    return density;
  } catch (error) {
    console.error('❌ Error calculating density with channel:', error);
    return null; // Return null on error instead of 0
  }
};

/**
 * Calculate density using ISO 5-3 weighted summation formula - using ASTM E308 tailing logic
 * @param {Object} spectralData - Normalized spectral reflectance data (numeric wavelength keys)
 * @param {string} channel - Density channel (red, green, blue, visual)
 * @param {Object} iso53WeightingFunctions - ISO 5-3 weighting functions
 * @returns {number} - Calculated density value
 */
export const calculateIso53Density = (spectralData, channel, iso53WeightingFunctions) => {
  try {    
    const weights = iso53WeightingFunctions[channel];
    if (!weights) {
      console.warn(`❌ No ISO 5-3 weighting function found for channel: ${channel}`);
      console.log(`📊 DEBUG: Available channels:`, Object.keys(iso53WeightingFunctions || {}));
      return 0;
    }

    // Get available wavelengths sorted
    const availableWavelengths = Object.keys(spectralData)
      .map(Number)
      .filter(wl => !isNaN(wl))
      .sort((a, b) => a - b);

    if (availableWavelengths.length === 0) {
      console.warn('❌ No valid wavelength data available');
      return 0;
    }

    const minWl = availableWavelengths[0];
    const maxWl = availableWavelengths[availableWavelengths.length - 1];

    let weightedSum = 0;
    let weightSum = 0;
    let validPoints = 0;
    
    // Apply ISO 5-3 weighted summation over 340-770nm range using ASTM E308 tailing logic
    for (let wavelength = 340; wavelength <= 770; wavelength += 10) {
      const weight = weights[wavelength];
      if (weight !== undefined && weight !== 0) {
        // Use ASTM E308-style tailing logic
        let spectralValue = null;
        let valueSource = '';
        
        if (wavelength < minWl) {
          // Tail the lowest wavelength
          spectralValue = spectralData[minWl];
          valueSource = `tailed from ${minWl}nm`;
        } else if (wavelength > maxWl) {
          // Tail the highest wavelength
          spectralValue = spectralData[maxWl];
          valueSource = `tailed from ${maxWl}nm`;
        } else {
          // Within range - try exact match first
          spectralValue = spectralData[wavelength];
          
          // If no exact match, interpolate
          if (spectralValue === undefined) {
            const lowerWl = availableWavelengths.filter(wl => wl <= wavelength).pop();
            const upperWl = availableWavelengths.filter(wl => wl >= wavelength)[0];
            
            if (lowerWl !== undefined && upperWl !== undefined) {
              if (lowerWl === upperWl) {
                spectralValue = spectralData[lowerWl];
                valueSource = `exact match at ${lowerWl}nm`;
              } else {
                const ratio = (wavelength - lowerWl) / (upperWl - lowerWl);
                spectralValue = spectralData[lowerWl] + ratio * (spectralData[upperWl] - spectralData[lowerWl]);
                valueSource = `interpolated between ${lowerWl}nm-${upperWl}nm`;
              }
            }
          } else {
            valueSource = 'exact match';
          }
        }
        
        if (spectralValue !== null && spectralValue !== undefined && !isNaN(spectralValue)) {
          const contribution = spectralValue * weight;
          weightedSum += contribution;
          weightSum += weight;
          validPoints++;
          
        }
      }
    }
    
    if (weightSum === 0) {
      console.warn('❌ No valid weighted data found for ISO 5-3 density calculation - falling back to basic density');
      const fallbackDensity = calculateDensity(spectralData);
      console.log(`📊 DEBUG: Fallback density: ${fallbackDensity}`);
      return fallbackDensity;
    }
    
    // Calculate weighted average reflectance
    const weightedReflectance = weightedSum / weightSum;
    
    // Convert to density: D = -log10(R)
    const density = weightedReflectance > 0 ? -Math.log10(weightedReflectance) : 0;
    
    return density;
  } catch (error) {
    console.error('❌ Error calculating ISO 5-3 density:', error);
    return 0;
  }
};


/**
 * Calculate density using basic wavelength averaging (legacy function for backward compatibility)
 * @param {Object} spectralData - Normalized spectral reflectance data with numeric wavelength keys
 * @returns {number} - Calculated density value
 */
export const calculateDensity = (spectralData) => {
  try {
    const wavelengths = Object.keys(spectralData)
      .map(Number)
      .filter(wl => !isNaN(wl) && wl >= 400 && wl <= 700)
      .sort((a, b) => a - b);
    
    if (wavelengths.length === 0) {
      console.warn('No valid wavelength data found in range 400-700nm');
      return 0;
    }

    // Calculate average reflectance in the visual range
    const totalReflectance = wavelengths.reduce((sum, wl) => {
      const reflectance = spectralData[wl];
      return sum + (typeof reflectance === 'number' ? reflectance : 0);
    }, 0);
    
    const averageReflectance = totalReflectance / wavelengths.length;
    
    // Convert to density: D = -log10(R)
    return averageReflectance > 0 ? -Math.log10(averageReflectance) : 0;
  } catch (error) {
    console.error('Error calculating basic density:', error);
    return 0;
  }
};

/**
 * Calculate colorimetric tone value (SCTV) according to ISO 20654
 * SCTV = SQRT(((LxSubstrate-LxTint)² + (LySubstrate-LyTint)² + (LzSubstrate-LzTint)²) / 
 *             ((LxSubstrate-LxSolid)² + (LySubstrate-LySolid)² + (LzSubstrate-LzSolid)²)) * 100
 * where: Lx = L + 116*a/500, Ly = L, Lz = L - 116*b/200
 */
export const calculateColorimetricToneValue = (tintLab, substrateLab, solidLab) => {
  if (!tintLab || !substrateLab || !solidLab) {
    console.warn('⚠️ Missing Lab values for SCTV calculation:', {
      hasTint: !!tintLab,
      hasSubstrate: !!substrateLab,
      hasSolid: !!solidLab
    });
    return null;
  }

  // Calculate Lx, Ly, Lz transformations for each Lab value
  const calculateLxLyLz = (lab) => ({
    Lx: lab.L + 116 * lab.a / 500,
    Ly: lab.L,
    Lz: lab.L - 116 * lab.b / 200
  });

  const substrate = calculateLxLyLz(substrateLab);
  const tint = calculateLxLyLz(tintLab);
  const solid = calculateLxLyLz(solidLab);

  console.log('📊 Lx/Ly/Lz transformations:', {
    substrate,
    tint,
    solid
  });

  // Calculate 3D distances
  const numerator = Math.pow(substrate.Lx - tint.Lx, 2) + 
                   Math.pow(substrate.Ly - tint.Ly, 2) + 
                   Math.pow(substrate.Lz - tint.Lz, 2);
                   
  const denominator = Math.pow(substrate.Lx - solid.Lx, 2) + 
                     Math.pow(substrate.Ly - solid.Ly, 2) + 
                     Math.pow(substrate.Lz - solid.Lz, 2);

  // Avoid division by zero
  if (denominator < 0.000001) {
    console.warn('⚠️ Denominator too small for SCTV calculation:', denominator);
    return 0;
  }

  // ISO 20654 SCTV calculation (no clamping - SCTV can exceed 100%)
  const sctv = Math.sqrt(numerator / denominator) * 100;
  
  console.log('✅ SCTV calculation result:', {
    sctv,
    input: 'calculated from Lab values'
  });
  
  return sctv;
};

/**
 * Calculate density-based tone value according to ISO 20654
 * TV = 100 * (Dp - Dt) / (Dp - Ds)
 * where Dp = paper density, Dt = tone density, Ds = solid density
 */
export const calculateDensityToneValue = (toneDensity, paperDensity, solidDensity) => {
  if (toneDensity == null || paperDensity == null || solidDensity == null) {
    return null;
  }

  const denominator = paperDensity - solidDensity;
  if (Math.abs(denominator) < 0.001) {
    return 0;
  }

  const tv = 100 * (paperDensity - toneDensity) / denominator;
  return Math.max(0, Math.min(100, tv));
};

/**
 * Calculate dot gain from density values using proper Murray-Davies equation
 * Murray-Davies (apparent dot area %): ((10^-Dp - 10^-Dt) / (10^-Dp - 10^-Ds)) × 100
 * where Dt = tone density, Dp = paper density, Ds = solid density
 */
export const calculateDotGainFromDensity = (toneDensity, paperDensity, solidDensity) => {
  if (toneDensity == null || paperDensity == null || solidDensity == null) {
    console.warn('⚠️ Missing density values for dot gain calculation');
    return null;
  }

  // Convert densities to transmittance/reflectance values
  const Tt = Math.pow(10, -toneDensity);  // Tone reflectance
  const Tp = Math.pow(10, -paperDensity); // Paper reflectance
  const Ts = Math.pow(10, -solidDensity); // Solid reflectance

  const denominator = Tp - Ts;
  if (Math.abs(denominator) < 0.00001) {
    console.warn('⚠️ Division by zero in dot gain calculation');
    return 0; // Avoid division by zero
  }

  // Murray-Davies equation for measured dot area percentage (no clamping)
  const dotArea = (Tp - Tt) / denominator;
  const result = dotArea * 100;

  return result;
};

/**
 * Calculate tone value increase (TVI) curve from wedge data according to ISO 20654
 */
export const calculateDotGainCurve = (wedgeData, calculationType = 'density', measurementControls, standards, iso53WeightingFunctions = null) => {
  if (!wedgeData || !Array.isArray(wedgeData)) {
    console.warn('calculateDotGainCurve: No valid wedge data provided');
    return [];
  }

  // CRITICAL FIX: Normalize spectral data property names
  // Convert snake_case spectral_data to camelCase spectralData for consistency
  const normalizedWedges = wedgeData.map(wedge => {
    const normalized = { ...wedge };
    
    // Normalize spectral data property names
    if (wedge.spectral_data && !wedge.spectralData) {
      normalized.spectralData = wedge.spectral_data;
      console.log('🔧 Normalized spectral_data to spectralData for wedge:', {
        tint: normalized.tintPercentage ?? normalized.tint ?? 0,
        hasSpectralData: !!normalized.spectralData,
        spectralKeys: normalized.spectralData ? Object.keys(normalized.spectralData).slice(0, 5) : []
      });
    }
    
    return normalized;
  });

  // Sort wedges by tint percentage for proper processing
  const sortedWedges = [...normalizedWedges].sort((a, b) => {
    const aPercent = a.tintPercentage ?? a.tint ?? 0;
    const bPercent = b.tintPercentage ?? b.tint ?? 0;
    return aPercent - bPercent;
  });

  // Enhanced reference finding with multiple strategies
  const findReference = (targetPercent, isSubstrate = false) => {
    // Strategy 1: Exact percentage match
    let ref = sortedWedges.find(w => {
      const percent = w.tintPercentage ?? w.tint ?? 0;
      return Math.abs(percent - targetPercent) < 0.1;
    });
    
    // Strategy 2: For substrate, also check isSubstrate flag
    if (!ref && isSubstrate) {
      ref = sortedWedges.find(w => w.isSubstrate === true);
    }
    
    // Strategy 3: For solid, find highest percentage >= 90%
    if (!ref && targetPercent === 100) {
      const highPercentageWedges = sortedWedges.filter(w => {
        const percent = w.tintPercentage ?? w.tint ?? 0;
        return percent >= 90;
      });
      if (highPercentageWedges.length > 0) {
        ref = highPercentageWedges[highPercentageWedges.length - 1]; // Highest
      }
    }
    
    // Strategy 4: Density-based fallback - find darkest/lightest by optical density
    if (!ref) {
      const wedgesWithDensity = sortedWedges.map(w => {
        const hasSpectral = !!(w.spectralData || w.spectral_data);
        const spectralData = w.spectralData || w.spectral_data;
        const density = spectralData ? calculateDensity(detectAndNormalizeSpectralData(spectralData)) : null;
        
        return {
          ...w,
          density
        };
      }).filter(w => w.density != null);
      
      if (wedgesWithDensity.length > 0) {
        if (isSubstrate || targetPercent === 0) {
          // Find lowest density (lightest/substrate)
          ref = wedgesWithDensity.reduce((lightest, current) => 
            current.density < lightest.density ? current : lightest
          );
        } else if (targetPercent === 100) {
          // Find highest density (darkest/solid)
          ref = wedgesWithDensity.reduce((darkest, current) => 
            current.density > darkest.density ? current : darkest
          );
        }
      }
    }
    
    return ref;
  };

  const substrate = findReference(0, true);
  const solid = findReference(100);

  if (!substrate || !solid) {
    console.warn('Missing substrate or solid reference for tone value calculation', {
      hasSubstrate: !!substrate,
      hasSolid: !!solid,
      availableTints: sortedWedges.map(w => w.tintPercentage ?? w.tint ?? 0)
    });
    return sortedWedges.map((wedge, index) => ({
      input: wedge.tintPercentage ?? wedge.tint ?? 0,
      output: wedge.tintPercentage ?? wedge.tint ?? 0,
      tvi: 0,
      isSelected: false,
      index
    }));
  }

  // Ensure Lab values are available for colorimetric calculations
  const ensureLabValues = (wedge) => {
    if (!wedge) return wedge;
    
    if (wedge.lab && wedge.lab.L !== undefined) {
      return wedge;
    }
    
    // Try to compute Lab from spectral data if we have measurement controls and standards
    if (wedge.spectralData && measurementControls && standards) {
      try {        
        const { illuminant = 'D50', observer = '2', table = '5' } = measurementControls || {};
        const tableNumber = parseInt(String(table), 10);
        let standardsArray = Array.isArray(standards?.astmTables) ? standards.astmTables : [];
        if (standards?.selectedWeightingTable) {
          standardsArray = [...standardsArray, standards.selectedWeightingTable];
        }
        
        let weightingTables = standardsArray.filter(t => 
          t?.illuminant_name === illuminant &&
          t?.observer === observer &&
          String(t?.table_number) === String(tableNumber)
        );

        // Fallback to selectedWeightingTable if no matches
        if ((!weightingTables || weightingTables.length === 0) && standards?.selectedWeightingTable) {
          weightingTables = [standards.selectedWeightingTable];
        }

        if (weightingTables && weightingTables.length > 0) {
          const lab = spectralToLabASTME308(wedge.spectralData, weightingTables);
          
          if (lab && Number.isFinite(lab.L)) {
            return { ...wedge, lab };
          }
        } else {
          console.warn('⚠️ No matching ASTM weighting tables found:', {
            tint: wedge.tintPercentage ?? wedge.tint ?? 0,
            requestedIlluminant: illuminant,
            requestedObserver: observer,
            requestedTable: tableNumber,
            availableTables: standardsArray.map(t => ({
              illuminant: t?.illuminant_name,
              observer: t?.observer,
              table: t?.table_number
            }))
          });
        }
      } catch (error) {
        console.warn('❌ Failed to compute Lab from spectral for wedge:', {
          tint: wedge.tintPercentage ?? wedge.tint ?? 0,
          error: error.message
        });
      }
    } 
    
    return wedge;
  };

  // Enhance references with Lab values if needed
  const enhancedSubstrate = ensureLabValues(substrate);
  const enhancedSolid = ensureLabValues(solid);

  // Auto-select optimal density channel using maximum density range method
  let selectedChannel = 'visual';
  if (calculationType === 'density' && iso53WeightingFunctions && enhancedSubstrate.spectralData && enhancedSolid.spectralData) {
    selectedChannel = autoSelectDensityChannel(
      null, // No ink type hint available here
      null, // No single spectral data for fallback
      enhancedSubstrate.spectralData,
      enhancedSolid.spectralData,
      iso53WeightingFunctions
    );
  }

  return sortedWedges.map((wedge, index) => {
    const input = wedge.tintPercentage ?? wedge.tint ?? 0;
    
    // Special handling for substrate and solid
    if (input === 0) {
      return { input: 0, output: 0, tvi: 0, isSelected: false, index };
    }
    
    if (input === 100) {
      return { input: 100, output: 100, tvi: 0, isSelected: false, index };
    }

    // Enhance current wedge with Lab if needed
    const enhancedWedge = ensureLabValues(wedge);
    let measuredToneValue;

    if (calculationType === 'density') {
      // Use the pre-selected optimal channel for all density calculations in this curve
      const toneDensity = enhancedWedge.spectralData && iso53WeightingFunctions ?
        calculateIso53Density(detectAndNormalizeSpectralData(enhancedWedge.spectralData), selectedChannel, iso53WeightingFunctions) :
        enhancedWedge.spectralData ? calculateDensity(detectAndNormalizeSpectralData(enhancedWedge.spectralData)) : null;
      
      const paperDensity = enhancedSubstrate.spectralData && iso53WeightingFunctions ?
        calculateIso53Density(detectAndNormalizeSpectralData(enhancedSubstrate.spectralData), selectedChannel, iso53WeightingFunctions) :
        enhancedSubstrate.spectralData ? calculateDensity(detectAndNormalizeSpectralData(enhancedSubstrate.spectralData)) : null;
      
      const solidDensity = enhancedSolid.spectralData && iso53WeightingFunctions ?
        calculateIso53Density(detectAndNormalizeSpectralData(enhancedSolid.spectralData), selectedChannel, iso53WeightingFunctions) :
        enhancedSolid.spectralData ? calculateDensity(detectAndNormalizeSpectralData(enhancedSolid.spectralData)) : null;
      
      // Calculate measured dot area using Murray-Davies
      if (toneDensity !== null && paperDensity !== null && solidDensity !== null) {
        measuredToneValue = calculateDotGainFromDensity(toneDensity, paperDensity, solidDensity);
      } else {
        console.warn('⚠️ Missing density values - cannot calculate Murray-Davies', {
          toneDensity, paperDensity, solidDensity
        });
        measuredToneValue = null;
      }
    } else if (calculationType === 'colorimetric') {
      // ISO 20654 colorimetric tone value (CTV)
      measuredToneValue = calculateColorimetricToneValue(enhancedWedge.lab, enhancedSubstrate.lab, enhancedSolid.lab);
      
      console.log('🎯 Colorimetric tone value result:', {
        input,
        measuredToneValue,
        calculationType: 'colorimetric'
      });
    }

    if (measuredToneValue == null) {
      return { input, output: input, tvi: 0, isSelected: false, index };
    }

    // Tone Value Increase (TVI) = Measured - Nominal
    const tvi = measuredToneValue - input;
    
    return {
      input,
      output: measuredToneValue,
      tvi,
      isSelected: false,
      index
    };
  });
};
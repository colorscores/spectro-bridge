/**
 * Two-step substrate adaptation for ink-based colors
 * This ensures consistent adaptation between ink full-add mode and ink-based colors
 */

import { computeAdaptedSpectralRatio, getPureSubstrateSpectral } from './spectralAdaptation';
import { calculateSubstrateDeltaE } from './substrateAdaptationUtils';
import { spectralToLabASTME308, labToHexD65, labToChromaHue } from './colorUtils/colorConversion';

// LRU Cache for spectral adaptation results
class LRUAdaptationCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (this.cache.has(key)) {
      this.hits++;
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio: this.hits / (this.hits + this.misses) || 0
    };
  }
}

const adaptationCache = new LRUAdaptationCache(500);

// Create stable cache key from spectral data
function createCacheKey(importedSubstrateSpectral, importedInkSpectral, selectedSubstrateSpectral, tintPercentage) {
  const keys = [
    JSON.stringify(Object.keys(importedSubstrateSpectral || {}).sort()),
    JSON.stringify(Object.values(importedSubstrateSpectral || {}).slice(0, 5)),
    JSON.stringify(Object.values(importedInkSpectral || {}).slice(0, 5)),
    JSON.stringify(Object.values(selectedSubstrateSpectral || {}).slice(0, 5)),
    tintPercentage
  ];
  return keys.join('|');
}

// Helper: scale detection (moved up for reuse)
function detectScale(spectral) {
  if (!spectral) return 1;
  const vals = Object.values(spectral).map(v => Number(v) || 0);
  if (vals.length === 0) return 1;
  const max = Math.max(...vals);
  // If values exceed 1.5 assume they are 0-100 reflectance (%)
  return max > 1.5 ? 100 : 1;
}

function toNormalized(spectral, scale) {
  if (!spectral) return {};
  const out = {};
  const denom = scale === 100 ? 100 : 1;
  for (const w of Object.keys(spectral)) {
    const v = Number(spectral[w]) || 0;
    // Clamp in normalized space
    out[w] = Math.max(0, Math.min(1, v / denom));
  }
  return out;
}

function fromNormalized(spectral, scale) {
  const out = {};
  const mul = scale === 100 ? 100 : 1;
  for (const w of Object.keys(spectral)) {
    out[w] = Math.max(0, Math.min(mul, spectral[w] * mul));
  }
  return out;
}

/**
 * Calculate wavelength-by-wavelength scalars representing substrate change
 * These scalars can be applied universally to all tints/backgrounds
 * 
 * @param {Object} importedSubstrateSpectral - 0% tint from imported (Substrate background)
 * @param {Object} selectedSubstrateSpectral - Target substrate spectral
 * @returns {Object} Wavelength-to-scalar mapping
 */
export const calculateSubstrateChangeScalars = (
  importedSubstrateSpectral,
  selectedSubstrateSpectral
) => {
  if (!importedSubstrateSpectral || !selectedSubstrateSpectral) {
    return null;
  }

  const scalars = {};
  const wavelengths = Object.keys(importedSubstrateSpectral).filter(
    w => selectedSubstrateSpectral[w] !== undefined
  );

  // Detect scales
  const scaleImported = detectScale(importedSubstrateSpectral);
  const scaleSelected = detectScale(selectedSubstrateSpectral);

  wavelengths.forEach(wavelength => {
    const imported = Number(importedSubstrateSpectral[wavelength]) / scaleImported;
    const selected = Number(selectedSubstrateSpectral[wavelength]) / scaleSelected;
    
    // Scalar = how much the substrate changed at this wavelength
    scalars[wavelength] = imported > 1e-6 ? (selected / imported) : 1.0;
  });

  return scalars;
};

/**
 * Apply pre-calculated substrate scalars to a tint's imported spectral data
 * Uses physics-based mixing with the tint's actual percentage
 * 
 * @param {Object} tintImportedSpectral - The tint's original spectral data
 * @param {Object} substrateScalars - Pre-calculated substrate change scalars
 * @param {Object} selectedSubstrateSpectral - Target substrate (for mixing)
 * @param {number} tintPercentage - The tint's percentage (0-100)
 * @param {Object} options - Mixing options
 * @returns {Object} Adapted spectral data
 */
export const applySubstrateScalarsToTint = (
  tintImportedSpectral,
  substrateScalars,
  selectedSubstrateSpectral,
  tintPercentage,
  options = {}
) => {
  if (!tintImportedSpectral || !substrateScalars || !selectedSubstrateSpectral) {
    return tintImportedSpectral;
  }

  // For 0% tint, return pure selected substrate
  if (tintPercentage === 0) {
    return getPureSubstrateSpectral(selectedSubstrateSpectral);
  }

  // Step 1: Apply scalars to the tint's imported spectral
  const scaleImported = detectScale(tintImportedSpectral);
  const scaleSelected = detectScale(selectedSubstrateSpectral);
  
  const importedNorm = toNormalized(tintImportedSpectral, scaleImported);
  const selectedSubNorm = toNormalized(selectedSubstrateSpectral, scaleSelected);

  const scaledInkNorm = {};
  Object.keys(substrateScalars).forEach(wavelength => {
    const scalar = substrateScalars[wavelength];
    const importedValue = importedNorm[wavelength] ?? 0;
    scaledInkNorm[wavelength] = Math.max(0, Math.min(1, importedValue * scalar));
  });

  // Step 2: Apply physics-based mixing using the tint's percentage
  const maxCoverage = options.maxCoverage ?? 0.95;
  const opticalGain = options.opticalGain ?? 0.15;
  
  const coverage = tintPercentage / 100;
  const effectiveCoverage = Math.min(coverage, maxCoverage);
  const blendWeight = effectiveCoverage + (1 - effectiveCoverage) * opticalGain;

  const finalSpectralNorm = {};
  Object.keys(scaledInkNorm).forEach(wavelength => {
    const substrate = selectedSubNorm[wavelength] ?? 0;
    const ink = scaledInkNorm[wavelength] ?? 0;
    
    finalSpectralNorm[wavelength] = (ink * blendWeight) + (substrate * (1 - blendWeight));
  });

  // Denormalize back to output scale (use imported scale for consistency)
  return fromNormalized(finalSpectralNorm, scaleImported);
};

/**
 * Calculate the spectral difference representing an additional ink layer
 * (e.g., the difference between pure Substrate and Gray/Black backgrounds)
 * 
 * This represents the optical effect of an extra layer of ink beneath the color tints.
 * For example:
 * - Substrate background = pure substrate (no additional layer)
 * - Gray background = substrate + 50% black ink layer
 * - Black background = substrate + 100% black ink layer
 * 
 * @param {Object} baseSubstrateSpectral - Pure substrate spectral (0% tint on "Substrate" background)
 * @param {Object} layeredSubstrateSpectral - Substrate with additional ink layer (0% tint on Gray/Black background)
 * @returns {Object} Spectral difference representing the additional ink layer effect
 */
export const calculateAdditionalInkLayer = (baseSubstrateSpectral, layeredSubstrateSpectral) => {
  if (!baseSubstrateSpectral || !layeredSubstrateSpectral) {
    return null;
  }

  const scaleBase = detectScale(baseSubstrateSpectral);
  const scaleLayered = detectScale(layeredSubstrateSpectral);

  const baseNorm = toNormalized(baseSubstrateSpectral, scaleBase);
  const layeredNorm = toNormalized(layeredSubstrateSpectral, scaleLayered);

  const differenceNorm = {};
  const wavelengths = Object.keys(baseNorm).filter(w => layeredNorm[w] !== undefined);

  wavelengths.forEach(wavelength => {
    const base = baseNorm[wavelength] ?? 0;
    const layered = layeredNorm[wavelength] ?? 0;
    
    // The difference represents the reduction in reflectance caused by the additional ink layer
    // Store as a ratio: how much darker is the layered substrate?
    differenceNorm[wavelength] = base > 1e-6 ? (layered / base) : 1.0;
  });

  return differenceNorm;
};

/**
 * Apply an additional ink layer to adapted spectral data
 * This re-introduces the darkening effect of backgrounds like Gray/Black after substrate adaptation
 * 
 * @param {Object} adaptedSpectral - Already adapted spectral data (on new substrate)
 * @param {Object} inkLayerRatio - Spectral ratio representing the additional ink layer
 * @returns {Object} Spectral data with additional ink layer applied
 */
export const applyAdditionalInkLayer = (adaptedSpectral, inkLayerRatio) => {
  if (!adaptedSpectral || !inkLayerRatio) {
    return adaptedSpectral;
  }

  const scale = detectScale(adaptedSpectral);
  const adaptedNorm = toNormalized(adaptedSpectral, scale);

  const finalNorm = {};
  const wavelengths = Object.keys(adaptedNorm).filter(w => inkLayerRatio[w] !== undefined);

  wavelengths.forEach(wavelength => {
    const adapted = adaptedNorm[wavelength] ?? 0;
    const ratio = inkLayerRatio[wavelength] ?? 1.0;
    
    // Apply the darkening ratio (subtractive mixing - additional ink reduces reflectance)
    finalNorm[wavelength] = Math.max(0, Math.min(1, adapted * ratio));
  });

  return fromNormalized(finalNorm, scale);
};

/**
 * Perform two-step substrate adaptation for ink spectral data
 * Step 1: Adapt ink from imported substrate to selected substrate using ratio calculation
 * Step 2: Apply physics-based mixing with the adapted ink spectral
 * 
 * @param {Object} importedSubstrateSpectral - Original substrate spectral data (0% tint from imported)
 * @param {Object} importedInkSpectral - Original ink spectral data
 * @param {Object} selectedSubstrateSpectral - Target substrate spectral data
 * @param {number} tintPercentage - Tint percentage (0-100)
 * @param {Object} options - Additional options for physics-based mixing
 * @returns {Object} Final adapted spectral data
 */
export const computeTwoStepSubstrateAdaptation = (
  importedSubstrateSpectral, 
  importedInkSpectral, 
  selectedSubstrateSpectral, 
  tintPercentage, 
  options = {}
) => {
  const enableLogging = options.enableLogging ?? false;
  
  // Reduced logging - only log summary at the end
  // enableLogging && console.log('🔬 Two-step adaptation (start):', {
  //   tintPercentage,
  //   hasImportedSubstrate: !!importedSubstrateSpectral,
  //   hasImportedInk: !!importedInkSpectral,
  //   hasSelectedSubstrate: !!selectedSubstrateSpectral,
  //   importedSubstrateSample: importedSubstrateSpectral ? Object.keys(importedSubstrateSpectral).slice(0, 3) : null,
  //   selectedSubstrateSample: selectedSubstrateSpectral ? Object.keys(selectedSubstrateSpectral).slice(0, 3) : null
  // });

  // Debug: Log actual spectral values at key wavelengths
  // if (enableLogging && importedSubstrateSpectral && importedInkSpectral && selectedSubstrateSpectral) {
  //   const debugWavelengths = ['400', '500', '600', '700'];
  //   console.log('🔬 Input spectral values at key wavelengths:', {
  //     wavelengths: debugWavelengths,
  //     importedSubstrate: debugWavelengths.map(w => ({ [w]: importedSubstrateSpectral[w] })),
  //     importedInk: debugWavelengths.map(w => ({ [w]: importedInkSpectral[w] })),
  //     selectedSubstrate: debugWavelengths.map(w => ({ [w]: selectedSubstrateSpectral[w] }))
  //   });
  // }

  // Helpers now extracted to top-level for reuse in new functions

  // For 0% tint, return pure selected substrate
  if (tintPercentage === 0) {
    return getPureSubstrateSpectral(selectedSubstrateSpectral);
  }

  // Validate required data
  if (!importedSubstrateSpectral || !importedInkSpectral || !selectedSubstrateSpectral) {
    return computeAdaptedSpectralRatio(
      selectedSubstrateSpectral, 
      importedInkSpectral, 
      tintPercentage, 
      options
    );
  }

  // Check cache first
  const cacheKey = createCacheKey(importedSubstrateSpectral, importedInkSpectral, selectedSubstrateSpectral, tintPercentage);
  const cached = adaptationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Step 1: Adapt ink spectral from imported substrate to selected substrate using ratio calculation
  const keys = Object.keys(importedInkSpectral).filter(
    wavelength => 
      importedSubstrateSpectral[wavelength] !== undefined && 
      selectedSubstrateSpectral[wavelength] !== undefined
  );

  if (keys.length === 0) {
    console.warn('🔬 No common wavelengths found for ratio adaptation, falling back to single-step');
    return computeAdaptedSpectralRatio(
      selectedSubstrateSpectral, 
      importedInkSpectral, 
      tintPercentage, 
      options
    );
  }

  // Normalize all inputs to 0-1 for stable math
  const scaleImportedSub = detectScale(importedSubstrateSpectral);
  const scaleImportedInk = detectScale(importedInkSpectral);
  const scaleSelectedSub = detectScale(selectedSubstrateSpectral);

  // enableLogging && console.log('🔬 Scale detection:', {
  //   scaleImportedSub,
  //   scaleImportedInk,
  //   scaleSelectedSub,
  //   importedSubMax: Math.max(...Object.values(importedSubstrateSpectral).map(v => Number(v) || 0)),
  //   importedInkMax: Math.max(...Object.values(importedInkSpectral).map(v => Number(v) || 0)),
  //   selectedSubMax: Math.max(...Object.values(selectedSubstrateSpectral).map(v => Number(v) || 0))
  // });

  const importedSubNorm = toNormalized(importedSubstrateSpectral, scaleImportedSub);
  const importedInkNorm = toNormalized(importedInkSpectral, scaleImportedInk);
  const selectedSubNorm = toNormalized(selectedSubstrateSpectral, scaleSelectedSub);

  const adaptedInkNorm = {};
  keys.forEach(wavelength => {
    const sImp = importedSubNorm[wavelength] ?? 0;
    const iImp = importedInkNorm[wavelength] ?? 0;
    const sSel = selectedSubNorm[wavelength] ?? 0;

    // Ratio of ink to substrate on imported substrate; guard near-zero substrate
    const ratio = sImp > 1e-6 ? (iImp / sImp) : iImp; // if substrate ~0, assume ratio ~ ink value
    // Apply ratio to selected substrate, clamp in normalized space
    adaptedInkNorm[wavelength] = Math.max(0, Math.min(1, sSel * ratio));
  });

  // enableLogging && console.log('🔬 Step 1 complete - Ink adapted to new substrate (normalized):', {
  //   scaleImportedSub,
  //   scaleImportedInk,
  //   scaleSelectedSub,
  //   originalInkSample: keys.slice(0, 3).map(w => importedInkNorm[w]),
  //   adaptedInkSample: keys.slice(0, 3).map(w => adaptedInkNorm[w]),
  //   ratioSample: keys.slice(0, 3).map(w => ({
  //     wavelength: w,
  //     importedInkNorm: importedInkNorm[w],
  //     importedSubNorm: importedSubNorm[w],
  //     selectedSubNorm: selectedSubNorm[w],
  //     ratio: (importedSubNorm[w] > 1e-6) ? (importedInkNorm[w] / importedSubNorm[w]) : importedInkNorm[w],
  //     result: adaptedInkNorm[w]
  //   }))
  // });

  // Step 2: Apply physics-based area coverage mixing with the adapted ink spectral in normalized space
  const finalSpectralNorm = computeAdaptedSpectralRatio(
    selectedSubNorm, 
    adaptedInkNorm, 
    tintPercentage, 
    {
      ...options,
      enableLogging: enableLogging
    }
  );

  // enableLogging && console.log('🔬 Step 2 complete - Physics-based mixing (normalized):', {
  //   tintPercentage,
  //   substrateSample: keys.slice(0, 3).map(w => selectedSubNorm[w]),
  //   adaptedInkSample: keys.slice(0, 3).map(w => adaptedInkNorm[w]),
  //   finalSample: keys.slice(0, 3).map(w => finalSpectralNorm[w])
  // });

  // Denormalize to the selected substrate scale for output consistency
  const finalSpectral = fromNormalized(finalSpectralNorm, scaleSelectedSub);

  // Cache the result
  adaptationCache.set(cacheKey, finalSpectral);

  return finalSpectral;
};

/**
 * Calculate deltaE between imported substrate (0% tint) and target substrate spectral
 * Wrapper for calculateSubstrateDeltaE from substrateAdaptationUtils
 */
export function calculateInkSubstrateDeltaE(importedTints, targetSubstrateSpectral, astmTables, orgDefaults) {
  return calculateSubstrateDeltaE(importedTints, targetSubstrateSpectral, astmTables, orgDefaults);
}

/**
 * Determine preferred data mode based on deltaE threshold
 * Returns 'adapted' if deltaE > 1, otherwise 'imported'
 */
export function determinePreferredDataMode(deltaE) {
  if (deltaE === null || deltaE === undefined || isNaN(deltaE)) {
    return 'imported';
  }
  return deltaE > 1 ? 'adapted' : 'imported';
}

/**
 * Compute adapted tints if deltaE indicates mismatch
 * Returns adapted tints array or null if adaptation not needed/possible
 */
export function computeAdaptedTintsIfNeeded(
  importedTints,
  importedSubstrateSpectral, 
  targetSubstrateSpectral,
  deltaE,
  measurementControls = {}
) {
  // Don't adapt if deltaE <= 1
  if (!deltaE || deltaE <= 1) {
    console.log('[computeAdaptedTintsIfNeeded] Delta E <= 1, skipping adaptation');
    return null;
  }
  
  // Validate inputs
  if (!importedTints?.length || !importedSubstrateSpectral || !targetSubstrateSpectral) {
    console.warn('[computeAdaptedTintsIfNeeded] Missing required data:', {
      hasImportedTints: !!importedTints?.length,
      hasImportedSubstrate: !!importedSubstrateSpectral,
      hasTargetSubstrate: !!targetSubstrateSpectral
    });
    return null;
  }
  
  console.log(`[computeAdaptedTintsIfNeeded] Adapting ${importedTints.length} tints from substrate to target`);
  
  // Adapt each tint individually
  const adaptedTints = importedTints.map(tint => {
    const tintPercentage = tint.tintPercentage || tint.tint_percentage || 0;
    // Use safeSpectralData to check measurements array if top-level missing
    const tintSpectral = tint.spectral_data || tint.spectralData || 
      (tint.measurements?.[0]?.spectral_data);
    
    if (!tintSpectral) {
      console.warn(`[computeAdaptedTintsIfNeeded] Skipping tint ${tintPercentage}% - no spectral data`);
      return tint; // Return unchanged if no spectral data
    }
    
    // Use two-step adaptation for this individual tint
    const adaptedSpectral = computeTwoStepSubstrateAdaptation(
      importedSubstrateSpectral,
      tintSpectral,              // Individual tint spectral, NOT array
      targetSubstrateSpectral,
      tintPercentage,
      {
        enableLogging: false,
        maxCoverage: 0.95,
        opticalGain: 1.1
      }
    );
    
    // Calculate Lab/CH from adapted spectral if ASTM tables provided
    let adaptedLab = null;
    let adaptedCh = null;
    let adaptedHex = null;
    
    if (adaptedSpectral && measurementControls.astmTables?.length) {
      try {
        const { illuminant = 'D50', observer = '2', astmTable = '5' } = measurementControls;
        const weightingTable = measurementControls.astmTables.filter(row => 
          row.illuminant_name === illuminant && 
          String(row.observer) === String(observer) && 
          String(row.table_number) === String(astmTable)
        );
        
        if (weightingTable.length > 0) {
          adaptedLab = spectralToLabASTME308(adaptedSpectral, weightingTable);
          if (adaptedLab) {
            adaptedCh = labToChromaHue(adaptedLab.L, adaptedLab.a, adaptedLab.b);
            adaptedHex = labToHexD65(adaptedLab.L, adaptedLab.a, adaptedLab.b);
          }
        }
      } catch (error) {
        console.warn(`[computeAdaptedTintsIfNeeded] Failed to compute Lab for ${tintPercentage}%:`, error);
      }
    }
    
    // Return adapted tint with computed Lab/CH/Hex
    return {
      ...tint,
      spectral_data: adaptedSpectral,
      spectralData: adaptedSpectral,      // Keep both for compatibility
      lab: adaptedLab || tint.lab,
      ch: adaptedCh || tint.ch,
      colorHex: adaptedHex || tint.colorHex,
      tintPercentage: tintPercentage      // Normalize field name
    };
  });
  
  console.log(`[computeAdaptedTintsIfNeeded] Successfully adapted ${adaptedTints.length} tints`);
  return adaptedTints;
}

/**
 * Select which tints array to display based on preferred data mode
 * Returns the appropriate array for wedge display
 */
export function selectTintsForDisplay(importedTints, adaptedTints, preferredDataMode) {
  if (preferredDataMode === 'adapted' && adaptedTints?.length > 0) {
    return adaptedTints;
  }
  return importedTints || [];
}
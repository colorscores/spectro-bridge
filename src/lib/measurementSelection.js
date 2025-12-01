/**
 * Shared utility for selecting the best measurement from available ones
 * Used by both ColorInfoTab and InkBasedColorInfoTab to ensure consistency
 */

export const pickBestMeasurement = (measurements, preferredMode) => {
    if (!measurements || measurements.length === 0) return null;
    
    const normalizeMode = (val) => {
        if (!val) return null;
        const str = String(val);
        const m = str.match(/M[0-3]/i);
        return m ? m[0].toUpperCase() : str.toUpperCase();
    };
    const modeOf = (m) => normalizeMode(m?.mode || m?.assignedMode || m?.measurement_mode || m?.measurementMode);
    const preferred = normalizeMode(preferredMode);

    console.info('pickBestMeasurement: Available measurements:', measurements.map(m => ({ 
        id: m.id, 
        mode: modeOf(m), 
        tint: m.tint_percentage,
        hasSpectral: !!m.spectral_data && Object.keys(m.spectral_data || {}).length > 0,
        hasLab: !!(m.lab?.L && m.lab?.a && m.lab?.b)
    })));
    
    const hasSpectral = (m) => m.spectral_data && Object.keys(m.spectral_data || {}).length > 0;
    const hasLab = (m) => m.lab?.L !== null && m.lab?.a !== null && m.lab?.b !== null;
    const isSolid = (m) => Number(m.tint_percentage) === 100;
    const isZeroTint = (m) => Number(m.tint_percentage) === 0;
    const nonZero = (m) => !isZeroTint(m);

    const preferHighestNonZero = (cands) => {
        const nz = cands.filter(nonZero);
        if (nz.length === 0) return null;
        return nz.reduce((max, m) => (Number(m.tint_percentage || 0) > Number(max.tint_percentage || 0) ? m : max), nz[0]);
    };

    // 1) Spectral + solid (100%) in preferred mode
    let best = measurements.find(m => modeOf(m) === preferred && hasSpectral(m) && isSolid(m));
    if (best) {
        console.info('pickBestMeasurement: Selected preferred mode + spectral + solid 100%', { id: best.id, mode: modeOf(best) });
        return best;
    }
    
    // 2) Spectral + solid (100%) any mode
    best = measurements.find(m => hasSpectral(m) && isSolid(m));
    if (best) {
        console.info('pickBestMeasurement: Selected spectral + solid 100% (any mode)', { id: best.id, mode: modeOf(best) });
        return best;
    }
    
    // 3) Spectral any NON-ZERO tint in preferred mode (prefer highest)
    const spectralPreferred = preferHighestNonZero(measurements.filter(m => modeOf(m) === preferred && hasSpectral(m)));
    if (spectralPreferred) {
        console.info('pickBestMeasurement: Selected preferred mode with spectral (non-zero tint)', { id: spectralPreferred.id, mode: modeOf(spectralPreferred), tint: spectralPreferred.tint_percentage });
        return spectralPreferred;
    }
    
    // 4) Spectral any NON-ZERO tint any mode (prefer highest)
    const spectralAny = preferHighestNonZero(measurements.filter(hasSpectral));
    if (spectralAny) {
        console.info('pickBestMeasurement: Selected any mode with spectral (non-zero tint)', { id: spectralAny.id, mode: modeOf(spectralAny), tint: spectralAny.tint_percentage });
        return spectralAny;
    }
    
    // 5) Lab + solid (100%) in preferred mode
    best = measurements.find(m => modeOf(m) === preferred && hasLab(m) && isSolid(m));
    if (best) {
        console.info('pickBestMeasurement: Selected preferred mode + Lab + solid 100%', { id: best.id, mode: modeOf(best) });
        return best;
    }
    
    // 6) Lab + solid (100%) any mode
    best = measurements.find(m => hasLab(m) && isSolid(m));
    if (best) {
        console.info('pickBestMeasurement: Selected Lab + solid 100% (any mode)', { id: best.id, mode: modeOf(best) });
        return best;
    }
    
    // 7) Lab in preferred mode (non-zero tint preferred)
    const labPreferred = preferHighestNonZero(measurements.filter(m => modeOf(m) === preferred && hasLab(m)));
    if (labPreferred) {
        console.info('pickBestMeasurement: Selected preferred mode with Lab (non-zero tint)', { id: labPreferred.id, mode: modeOf(labPreferred), tint: labPreferred.tint_percentage });
        return labPreferred;
    }
    
    // 8) Any Lab (non-zero tint preferred)
    const labAny = preferHighestNonZero(measurements.filter(hasLab));
    if (labAny) {
        console.info('pickBestMeasurement: Selected any mode with Lab (non-zero tint)', { id: labAny.id, mode: modeOf(labAny), tint: labAny.tint_percentage });
        return labAny;
    }
    
    // 9) As a last resort (should rarely happen), avoid 0% substrate if possible
    const anySpectral = measurements.find(hasSpectral);
    if (anySpectral && isZeroTint(anySpectral)) {
        console.warn('pickBestMeasurement: Only spectral available appears to be 0% (substrate); refusing to select to avoid flash');
    }

    console.warn('pickBestMeasurement: No valid measurements found, returning null');
    return null;
};
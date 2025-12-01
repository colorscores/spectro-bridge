import { getTintPercentage } from '@/lib/tintsUtils';

// Extract a normalized background name from a tint object
export const getBackgroundName = (tint) => {
  const raw = (
    tint?.background ??
    tint?.background_name ??
    tint?.backgroundName ??
    tint?.background_type ??
    tint?.backgroundType ??
    tint?.background?.name ??
    tint?.background?.type ??
    ''
  );
  return String(raw).trim();
};

const isOverBlack = (tint) => {
  const bg = getBackgroundName(tint).toLowerCase();
  return (
    tint?.isOverBlack === true ||
    bg.includes('black') ||
    bg.includes('over black') ||
    bg.includes('process_black') ||
    bg.includes('process black')
  );
};

// Returns { selected, reason, zeroTints, candidates }
export const selectSubstrateZeroTint = (importedTints, options = {}) => {
  // Flatten to an array
  const allTints = Array.isArray(importedTints)
    ? importedTints
    : (Array.isArray(importedTints?.tints) ? importedTints.tints : []);

  const zeroTints = allTints.filter((t) => getTintPercentage(t) === 0);
  if (zeroTints.length === 0) {
    return { selected: null, reason: 'no_0_percent_tints', zeroTints, candidates: [] };
  }

  // 1) Exact 'Substrate'
  const exactSubstrate = zeroTints.filter((t) => getBackgroundName(t).toLowerCase() === 'substrate' && !isOverBlack(t));
  if (exactSubstrate.length) {
    return { selected: exactSubstrate[0], reason: 'exact_substrate', zeroTints, candidates: exactSubstrate };
  }

  // 2) Contains 'substrate'
  const containsSubstrate = zeroTints.filter((t) => getBackgroundName(t).toLowerCase().includes('substrate') && !isOverBlack(t));
  if (containsSubstrate.length) {
    return { selected: containsSubstrate[0], reason: 'contains_substrate', zeroTints, candidates: containsSubstrate };
  }

  // 3) Any non-black background
  const nonBlack = zeroTints.filter((t) => !isOverBlack(t));
  if (nonBlack.length) {
    return { selected: nonBlack[0], reason: 'non_black_fallback', zeroTints, candidates: nonBlack };
  }

  // 4) Last resort: first 0% tint
  return { selected: zeroTints[0], reason: 'first_zero_tint_fallback', zeroTints, candidates: zeroTints };
};

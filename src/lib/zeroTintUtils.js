import { getTintPercentage } from '@/lib/tintsUtils';

// Remove 0% substrate tints from imported_tints while preserving original structure
// Returns { updated, removedCount }
export const removeZeroTints = (importedTints) => {
  if (!importedTints) return { updated: importedTints ?? null, removedCount: 0 };

  const hasZero = (t) => getTintPercentage(t) === 0;

  // Array form
  if (Array.isArray(importedTints)) {
    const filtered = importedTints.filter((t) => !hasZero(t));
    return { updated: filtered, removedCount: importedTints.length - filtered.length };
  }

  // Object with tints property
  if (importedTints && Array.isArray(importedTints.tints)) {
    const filtered = importedTints.tints.filter((t) => !hasZero(t));
    return {
      updated: { ...importedTints, tints: filtered },
      removedCount: importedTints.tints.length - filtered.length,
    };
  }

  return { updated: importedTints, removedCount: 0 };
};

// Lightweight debug helper for Similar Colors investigations
// Enable by adding ?similarDebug=true to the URL (or set window.__SIMILAR_DEBUG__ = true in console)

let cached = null;

export function isSimilarDebugEnabled() {
  if (cached !== null) return cached;
  try {
    if (typeof window === 'undefined') return false;
    if (window.__SIMILAR_DEBUG__ === true) return (cached = true);
    const params = new URLSearchParams(window.location.search || '');
    const flag = params.get('similarDebug') === 'true' || params.get('simdebug') === '1';
    const debugParam = params.get('debug');
    const debugIncludes = typeof debugParam === 'string' && /color|de|similar/i.test(debugParam);
    cached = !!(flag || debugIncludes);
    return cached;
  } catch (_) {
    return (cached = false);
  }
}

export const sdebug = {
  log: (...args) => { if (isSimilarDebugEnabled()) console.log('[SimilarDebug]', ...args); },
  info: (...args) => { if (isSimilarDebugEnabled()) console.info('[SimilarDebug]', ...args); },
  warn: (...args) => { if (isSimilarDebugEnabled()) console.warn('[SimilarDebug]', ...args); },
  error: (...args) => { if (isSimilarDebugEnabled()) console.error('[SimilarDebug]', ...args); },
  time: (label) => { if (isSimilarDebugEnabled()) console.time(`[SimilarDebug] ${label}`); },
  timeEnd: (label) => { if (isSimilarDebugEnabled()) console.timeEnd(`[SimilarDebug] ${label}`); },
};

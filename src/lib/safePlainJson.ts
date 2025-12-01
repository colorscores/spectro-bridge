// Utility functions to prepare data for Supabase JSON columns
// - safePlainJson: deep-clone removing functions, symbols, DOM nodes, and breaking cycles
// - dbSafeTints: strip UI-only fields from tints and return JSON-serializable data

export function safePlainJson(input, seen = new WeakSet()) {
  const t = typeof input;
  if (input === null || t === 'number' || t === 'string' || t === 'boolean') return input;
  if (t === 'function' || t === 'symbol' || t === 'undefined') return undefined;

  // Handle Date
  if (input instanceof Date) return input.toISOString();

  // Avoid DOM nodes or React elements like { $$typeof: Symbol(react.element) }
  if (typeof input === 'object' && (input.nodeType || input.$$typeof)) return undefined;

  if (seen.has(input)) return undefined; // drop circular reference
  seen.add(input);

  if (Array.isArray(input)) {
    const arr = input.map((v) => safePlainJson(v, seen)).filter((v) => v !== undefined);
    return arr;
  }

  // Plain object clone
  const out = {} as any;
  for (const [key, value] of Object.entries(input)) {
    // Drop private/internal keys
    if (key.startsWith('_')) continue;
    const v = safePlainJson(value, seen);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

// Keys used only for UI that should not be stored in DB
export default function noop() {}
export function dbSafeTints(tints) {
  if (!tints) return tints;
  const OMIT_KEYS = new Set([
    'hasSplit', 'splitColor', 'splitColorHex', 'splitSpectralData', 'splitLab', 'splitCh',
    'onClick', 'onChange', 'element', 'ref'
  ]);

  const sanitizeTint = (t) => {
    const clean = {} as any;
    for (const [k, v] of Object.entries(t || {})) {
      if (OMIT_KEYS.has(k)) continue;
      if (k.startsWith('_')) continue;
      // Keep only JSON-serializable values
      const sv = safePlainJson(v);
      if (sv !== undefined) clean[k] = sv;
    }

    // Ensure common fields are plain
    if (clean.lab && typeof clean.lab === 'object') {
      const { L, a, b } = clean.lab;
      clean.lab = { L: Number(L), a: Number(a), b: Number(b) };
    }
    if (clean.ch && typeof clean.ch === 'object') {
      const { C, h } = clean.ch;
      clean.ch = { C: Number(C), h: Number(h) };
    }

    // Normalize spectral fields naming - only convert if we have actual data
    if (clean.spectralData && !clean.spectral_data) {
      clean.spectral_data = clean.spectralData;
    }
    // Only delete spectralData if we successfully created spectral_data
    if (clean.spectral_data) {
      delete clean.spectralData;
    }

    return clean;
  };

  if (Array.isArray(tints)) return tints.map(sanitizeTint);
  // Some imports may include a wrapper object with measurement_settings, etc.
  const out = { ...tints } as any;
  if (Array.isArray(out.tints)) out.tints = out.tints.map(sanitizeTint);
  return safePlainJson(out);
}

// Delta E calculation functions for color difference
// Based on standard formulas for color difference calculations
import { isSimilarDebugEnabled } from '@/lib/similarDebug';
let __deDebugCount = 0;

/**
 * Calculate Delta E 1976 (CIE76)
 * @param {Object} lab1 - First LAB color {L, a, b}
 * @param {Object} lab2 - Second LAB color {L, a, b}
 * @returns {number} - Delta E 76 value
 */
export function deltaE76(lab1, lab2) {
  const deltaL = lab2.L - lab1.L;
  const deltaA = lab2.a - lab1.a;
  const deltaB = lab2.b - lab1.b;
  
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

/**
 * Calculate Delta E CMC (2:1)
 * @param {Object} lab1 - First LAB color {L, a, b}
 * @param {Object} lab2 - Second LAB color {L, a, b}
 * @returns {number} - Delta E CMC value
 */
export function deltaECMCWithParams(lab1, lab2, kL = 2, kC = 1, kH = 1) {
  const L1 = lab1.L;
  const a1 = lab1.a;
  const b1 = lab1.b;
  const L2 = lab2.L;
  const a2 = lab2.a;
  const b2 = lab2.b;
  
  const deltaL = L2 - L1;
  const deltaA = a2 - a1;
  const deltaB = b2 - b1;
  
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const deltaC = C2 - C1;
  
  const deltaH = Math.sqrt(Math.max(0, deltaA * deltaA + deltaB * deltaB - deltaC * deltaC));
  
  const H1 = Math.atan2(b1, a1) * 180 / Math.PI;
  const adjustedH1 = H1 < 0 ? H1 + 360 : H1;
  
  const T = (adjustedH1 >= 164 && adjustedH1 <= 345) 
    ? 0.56 + Math.abs(0.2 * Math.cos((adjustedH1 + 168) * Math.PI / 180))
    : 0.36 + Math.abs(0.4 * Math.cos((adjustedH1 + 35) * Math.PI / 180));
  
  const F = Math.sqrt(Math.pow(C1, 4) / (Math.pow(C1, 4) + 1900));
  
  const SL = L1 < 16 ? 0.511 : 0.040975 * L1 / (1 + 0.01765 * L1);
  const SC = 0.0638 * C1 / (1 + 0.0131 * C1) + 0.638;
  const SH = SC * (F * T + 1 - F);
  
  const deltaE = Math.sqrt(
    Math.pow(deltaL / (kL * SL), 2) +
    Math.pow(deltaC / (kC * SC), 2) +
    Math.pow(deltaH / (kH * SH), 2)
  );
  
  return deltaE;
}

export function deltaECMC(lab1, lab2) {
  return deltaECMCWithParams(lab1, lab2, 2, 1, 1);
}

/**
 * Calculate Delta E 2000 (CIE DE2000)
 * @param {Object} lab1 - First LAB color {L, a, b}
 * @param {Object} lab2 - Second LAB color {L, a, b}
 * @returns {number} - Delta E 2000 value
 */
/**
 * Calculate Delta E 1994 (CIE94)
 * @param {Object} lab1 - First LAB color {L, a, b}
 * @param {Object} lab2 - Second LAB color {L, a, b}
 * @returns {number} - Delta E 94 value
 */
export function deltaE94(lab1, lab2) {
  const L1 = lab1.L;
  const a1 = lab1.a;
  const b1 = lab1.b;
  const L2 = lab2.L;
  const a2 = lab2.a;
  const b2 = lab2.b;
  
  const deltaL = L2 - L1;
  const deltaA = a2 - a1;
  const deltaB = b2 - b1;
  
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const deltaC = C2 - C1;
  
  const deltaH = Math.sqrt(Math.max(0, deltaA * deltaA + deltaB * deltaB - deltaC * deltaC));
  
  const SL = 1;
  const SC = 1 + 0.045 * C1;
  const SH = 1 + 0.015 * C1;
  
  const deltaE = Math.sqrt(
    Math.pow(deltaL / SL, 2) +
    Math.pow(deltaC / SC, 2) +
    Math.pow(deltaH / SH, 2)
  );
  
  return deltaE;
}

export function deltaE2000(lab1, lab2) {
  const L1 = lab1.L;
  const a1 = lab1.a;
  const b1 = lab1.b;
  const L2 = lab2.L;
  const a2 = lab2.a;
  const b2 = lab2.b;
  
  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;
  
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1Prime = a1 * (1 + G);
  const a2Prime = a2 * (1 + G);
  
  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
  const avgCPrime = (C1Prime + C2Prime) / 2;
  
  const h1Prime = Math.atan2(b1, a1Prime) * 180 / Math.PI;
  const h2Prime = Math.atan2(b2, a2Prime) * 180 / Math.PI;
  
  const adjustedH1Prime = h1Prime < 0 ? h1Prime + 360 : h1Prime;
  const adjustedH2Prime = h2Prime < 0 ? h2Prime + 360 : h2Prime;
  
  let deltaHPrime;
  if (Math.abs(adjustedH1Prime - adjustedH2Prime) <= 180) {
    deltaHPrime = adjustedH2Prime - adjustedH1Prime;
  } else if (adjustedH2Prime - adjustedH1Prime > 180) {
    deltaHPrime = adjustedH2Prime - adjustedH1Prime - 360;
  } else {
    deltaHPrime = adjustedH2Prime - adjustedH1Prime + 360;
  }
  
  const avgHPrime = Math.abs(adjustedH1Prime - adjustedH2Prime) <= 180
    ? (adjustedH1Prime + adjustedH2Prime) / 2
    : (adjustedH1Prime + adjustedH2Prime + 360) / 2;
  
  const deltaL = L2 - L1;
  const deltaC = C2Prime - C1Prime;
  const deltaH = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(deltaHPrime * Math.PI / 360);
  
  const T = 1 - 0.17 * Math.cos((avgHPrime - 30) * Math.PI / 180) +
           0.24 * Math.cos(2 * avgHPrime * Math.PI / 180) +
           0.32 * Math.cos((3 * avgHPrime + 6) * Math.PI / 180) -
           0.20 * Math.cos((4 * avgHPrime - 63) * Math.PI / 180);
  
  const SL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const SC = 1 + 0.045 * avgCPrime;
  const SH = 1 + 0.015 * avgCPrime * T;
  
  const RT = -2 * Math.sqrt(Math.pow(avgCPrime, 7) / (Math.pow(avgCPrime, 7) + Math.pow(25, 7))) *
            Math.sin(60 * Math.exp(-Math.pow((avgHPrime - 275) / 25, 2)) * Math.PI / 180);
  
  const deltaE = Math.sqrt(
    Math.pow(deltaL / SL, 2) +
    Math.pow(deltaC / SC, 2) +
    Math.pow(deltaH / SH, 2) +
    RT * (deltaC / SC) * (deltaH / SH)
  );
  
  return deltaE;
}

/**
 * Calculate delta E based on the specified type
 * @param {Object} lab1 - First LAB color {L, a, b}
 * @param {Object} lab2 - Second LAB color {L, a, b}
 * @param {string} type - Type of delta E calculation ('dE76', 'dECMC2:1', 'dE00')
 * @returns {number} - Delta E value
 */
export function calculateDeltaE(lab1, lab2, type = 'dE00') {
  const simDbg = isSimilarDebugEnabled && isSimilarDebugEnabled();
  const safe = (lab) => lab && Number.isFinite(lab.L) && Number.isFinite(lab.a) && Number.isFinite(lab.b);
  if (!safe(lab1) || !safe(lab2)) {
    if (simDbg) {
      console.warn('[dE] Invalid LAB input', { lab1, lab2, type });
    }
  }
  let val;
  switch (type) {
    case 'dE76':
      val = deltaE76(lab1, lab2); break;
    case 'dE94':
      val = deltaE94(lab1, lab2); break;
    case 'dECMC2:1':
      val = deltaECMCWithParams(lab1, lab2, 2, 1, 1); break;
    case 'dECMC1:1':
      val = deltaECMCWithParams(lab1, lab2, 1, 1, 1); break;
    case 'dE00':
    case 'dE2000': // Support legacy naming
      val = deltaE2000(lab1, lab2); break;
    default:
      val = deltaE2000(lab1, lab2);
  }
  if (!Number.isFinite(val)) {
    if (simDbg) {
      console.warn('[dE] Non-finite result', { type, lab1, lab2, val });
    }
  } else if (simDbg && type === 'dE00' && __deDebugCount < 10) {
    __deDebugCount += 1;
    const alt76 = deltaE76(lab1, lab2);
    const alt94 = deltaE94(lab1, lab2);
    console.info('[dE] Compare dE00 vs others', { dE00: val, dE76: alt76, dE94: alt94, lab1, lab2 });
  }
  return val;
}
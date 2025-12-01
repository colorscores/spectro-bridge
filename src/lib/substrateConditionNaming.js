/**
 * Auto-naming utility for substrate conditions
 * Format: [print side], if use white is enabled "with White Ink",
 * if using laminate [Laminate surface quality]+"Laminate", if varnish enabled [Varnish surface quality]+"Varnish",
 * if version provided "Version [version]"
 * Note: Substrate name is NOT included in the generated condition name.
 */

export const generateSubstrateConditionName = (params) => {
  const {
    substrateName,
    printSide,
    useWhiteInk,
    laminateEnabled,
    laminateSurfaceQuality,
    varnishEnabled,
    varnishSurfaceQuality,
    version
  } = params;

  console.log('🏷️ Generating substrate condition name with params:', params);

  if (!printSide) {
    console.log('⚠️ Missing required params for auto-naming:', { printSide });
    return '';
  }

  const sideCap = (() => {
    const v = (printSide || '').toString().trim().toLowerCase();
    if (v === 'surface') return 'Surface';
    if (v === 'reverse') return 'Reverse';
    return (printSide || '').toString().trim().charAt(0).toUpperCase() + (printSide || '').toString().trim().slice(1).toLowerCase();
  })();

  let printSidePart = `${sideCap} print`;
  if (useWhiteInk) {
    printSidePart += ' with White Ink';
    console.log('✅ Added white ink to print side:', printSidePart);
  }
  
  // Build detail parts (laminate/varnish/version)
  const detailParts = [];

  if (laminateEnabled && laminateSurfaceQuality) {
    const quality = laminateSurfaceQuality.charAt(0).toUpperCase() + laminateSurfaceQuality.slice(1);
    detailParts.push(`${quality} Laminate`);
  }

  if (varnishEnabled && varnishSurfaceQuality) {
    const quality = varnishSurfaceQuality.charAt(0).toUpperCase() + varnishSurfaceQuality.slice(1);
    detailParts.push(`${quality} Varnish`);
  }

  if (version != null && String(version).trim()) {
    detailParts.push(`Version ${String(version).trim()}`);
  }

  // Compose final name (no substrate name prefix)
  const finalName = detailParts.length > 0 ? `${printSidePart}, ${detailParts.join(', ')}` : printSidePart;

  console.log('🏷️ Generated substrate condition name:', finalName);
  return finalName;
};
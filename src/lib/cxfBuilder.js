// Enhanced CxF3/CxF-X4 builder with full schema compliance
// Supports both regular CxF3 format and CxF/X-4 with SpotInkCharacterisation

import { labToHex, extractSpectralData } from '@/lib/colorUtils';

export function buildCxf3({ job, references = [], measurementsByColorId = {}, orgDefaults = {}, options = {}, filename = '', description = '' }) {
  return buildCxfInternal({
    job,
    references,
    measurementsByColorId,
    orgDefaults,
    options,
    format: 'CxF3',
    filename,
    description
  });
}

export function buildCxfX4({ job, references = [], measurementsByColorId = {}, orgDefaults = {}, options = {}, inkConditionsData = [], filename = '', description = '' }) {
  return buildCxfInternal({
    job,
    references,
    measurementsByColorId,
    orgDefaults,
    options,
    format: 'CxF-X4',
    inkConditionsData,
    filename,
    description
  });
}

function buildCxfInternal({ job, references = [], measurementsByColorId = {}, orgDefaults = {}, options = {}, format = 'CxF3', inkConditionsData = [], filename = '', description = '' }) {
  const jobId = job?.job_id || 'unknown';
  const defaultMode = orgDefaults?.default_measurement_mode || 'M1';
  const defaultIlluminant = orgDefaults?.default_illuminant || 'D50';
  const defaultObserver = orgDefaults?.default_observer || '2';
  const defaultAstmTable = orgDefaults?.default_astm_table || '5';

  const xmlEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let exportedCount = 0;
  let skippedCount = 0;
  const validationWarnings = [];

  // Generate description based on context
  let finalDescription = description;
  if (!finalDescription) {
    if (filename && filename.includes('color-library')) {
      finalDescription = 'Color library export';
    } else {
      finalDescription = `Color export for job ${jobId}`;
    }
  }

  // Color Specification Collection
  const colorSpecifications = new Map(); // Maps signature -> ColorSpecification XML
  const colorSpecificationMap = new Map(); // Maps csId -> actual signature for consolidation
  const colorimetryIndex = new Map(); // Maps colorimetry signature -> consolidated ID for tristimulus reuse
  const objects = [];

  // ID counters for smart enumeration
  const idCounters = {
    spectralCount: 0,    // R0, R1, R2...
    colorimetricCount: 0 // C0, C1, C2...
  };

  // Process regular color references
  references.forEach((ref, idx) => {
    const result = processColorReference(ref, idx, measurementsByColorId, {
      defaultMode,
      defaultIlluminant,
      defaultObserver,
      defaultAstmTable,
      options,
      xmlEsc,
      colorSpecifications,
      colorSpecificationMap,
      colorimetryIndex,
      validationWarnings,
      idCounters,
      format
    });

    if (result.success) {
      objects.push(result.objectXml);
      exportedCount++;
    } else {
      skippedCount++;
    }
  });

  // Process ink condition data for CxF-X4
  const spotInkCharacterisations = [];
  if (format === 'CxF-X4' && inkConditionsData.length > 0) {
    inkConditionsData.forEach((inkData, sicIndex) => {
      const spotCharResult = processInkConditionForX4(inkData, {
        defaultMode,
        defaultIlluminant,
        defaultObserver,
        defaultAstmTable,
        xmlEsc,
        colorSpecifications,
        colorSpecificationMap,
        colorimetryIndex,
        objects,
        validationWarnings,
        sicIndex: sicIndex + 1 // 1-based indexing
      });

      if (spotCharResult.success) {
        spotInkCharacterisations.push(spotCharResult.characterisationXml);
        exportedCount += spotCharResult.objectCount;
      }
    });
  }

  if (exportedCount === 0) {
    return { xml: '', exportedCount, skippedCount, validationWarnings };
  }

  // Build ColorSpecification collection with defensive deduplication by ID
  const colorSpecEntries = Array.from(colorSpecifications.values());
  const deduplicatedSpecs = new Map();
  
  // Deduplicate by ID to ensure no duplicate ColorSpecification entries
  colorSpecEntries.forEach(entry => {
    const idMatch = entry.xml.match(/Id="([^"]+)"/);
    if (idMatch) {
      const id = idMatch[1];
      if (!deduplicatedSpecs.has(id)) {
        deduplicatedSpecs.set(id, entry.xml);
      }
    }
  });
  
  const colorSpecXml = Array.from(deduplicatedSpecs.values()).filter(spec => spec.trim()).join('\n');

  // Build final XML
  const isX4 = format === 'CxF-X4';
  const namespace = isX4 
    ? 'xmlns:cc="http://colorexchangeformat.com/CxF3-core" xmlns:sic="http://colorexchangeformat.com/CxF3-SpotInkCharacterisation"'
    : 'xmlns:cc="http://colorexchangeformat.com/CxF3-core"';

  const schemaLocation = isX4
    ? 'xsi:schemaLocation="http://colorexchangeformat.com/CxF3-core CxF3_Core.xsd http://colorexchangeformat.com/CxF3-SpotInkCharacterisation CxF3_SpotInkCharacterization.xsd"'
    : 'xsi:schemaLocation="http://colorexchangeformat.com/CxF3-core CxF3_Core.xsd"';

  const timestamp = new Date().toISOString();
  const objectsXml = objects.filter(obj => obj.trim()).join('\n');

  const customResourcesXml = spotInkCharacterisations.length > 0 
    ? `  <cc:CustomResources>\n${spotInkCharacterisations.filter(sic => sic.trim()).join('\n')}\n  </cc:CustomResources>`
    : '';

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<cc:CxF
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  ${namespace}
  ${schemaLocation}>
  <cc:FileInformation>
    <cc:Creator>Kontrol</cc:Creator>
    <cc:CreationDate>${timestamp}</cc:CreationDate>
    <cc:Description>${xmlEsc(finalDescription)}</cc:Description>
  </cc:FileInformation>
  <cc:Resources>
    <cc:ObjectCollection>
${objectsXml}
    </cc:ObjectCollection>
    <cc:ColorSpecificationCollection>
${colorSpecXml}
    </cc:ColorSpecificationCollection>
  </cc:Resources>${customResourcesXml}
</cc:CxF>`;

  return { xml, exportedCount, skippedCount, validationWarnings };
}

function processColorReference(ref, idx, measurementsByColorId, config) {
  const { defaultMode, defaultIlluminant, defaultObserver, defaultAstmTable, options, xmlEsc, colorSpecifications, colorSpecificationMap, colorimetryIndex, validationWarnings, idCounters, format } = config;
  const colorId = ref.color_id;
  const name = ref.name || `Color ${idx + 1}`;
  
  const measData = measurementsByColorId[colorId];
  const lab = ref.reference_lab || ref.lab;
  
  // Extract export options
  const { includeSpectral = true, includeLab = true, selectedLabMode = null } = options;
  
  console.log(`[CxF Builder] Processing "${name}": includeSpectral=${includeSpectral}, includeLab=${includeLab}, selectedLabMode=${selectedLabMode}`);

  // Normalize measurements into consistent per-mode format
  let measurementModes = [];
  let hasSpectralData = false;

  if (measData && typeof measData === 'object') {
    // Detect per-mode format (has mode keys like M1, M2, m1, m2, etc.)
    const modeKeys = Object.keys(measData).filter(key => /^[Mm][0-3]$/.test(key));
    const isPerModeFormat = modeKeys.length > 0;
    
    if (isPerModeFormat) {
      // New per-mode format: { M1: { spectral_data, lab, ... }, M2: { ... } }
      console.log(`[CxF Builder] Processing per-mode data for "${name}": found modes [${modeKeys.join(', ')}]`);
      
      measurementModes = modeKeys
        .map(key => {
          const normalizedMode = key.toUpperCase(); // Normalize m1 -> M1
          const meas = measData[key];
          return meas && (meas.spectral_data || meas.lab) ? { mode: normalizedMode, ...meas } : null;
        })
        .filter(Boolean);
      
      hasSpectralData = measurementModes.some(meas => 
        meas.spectral_data && typeof meas.spectral_data === 'object' && Object.keys(meas.spectral_data).length > 0
      );
      
      console.log(`[CxF Builder] "${name}": ${measurementModes.length} valid modes, hasSpectralData: ${hasSpectralData}`);
    } else {
      // Old single measurement format: { spectral_data, lab, mode?, ... }
      const mode = (measData.mode || defaultMode).toUpperCase();
      measurementModes = [{ mode, ...measData }];
      hasSpectralData = measData.spectral_data && typeof measData.spectral_data === 'object' && Object.keys(measData.spectral_data).length > 0;
      
      console.log(`[CxF Builder] Processing single measurement for "${name}": mode ${mode}, hasSpectralData: ${hasSpectralData}`);
    }
  }
  
  // Smart ID enumeration for CxF3
  let objId, baseCSId;
  if (format === 'CxF3') {
    if (hasSpectralData) {
      objId = `R${idCounters.spectralCount}`;
      baseCSId = `R${idCounters.spectralCount}CS`;
      idCounters.spectralCount++;
    } else {
      objId = `C${idCounters.colorimetricCount}`;
      baseCSId = `C${idCounters.colorimetricCount}CS`;
      idCounters.colorimetricCount++;
    }
  } else {
    // Fallback to original numbering for other formats
    objId = `OBJ-${idx + 1}`;
    baseCSId = `CS-${idx + 1}`;
  }

  // Validate and prepare color values
  const colorValuesXml = [];
  let hasValidData = false;

  // Process spectral data for all modes if includeSpectral is true
  if (includeSpectral) {
    measurementModes.forEach((meas, modeIdx) => {
      const mode = meas.mode || defaultMode;
      const csId = measurementModes.length > 1 ? `${baseCSId}_${mode}` : baseCSId;
      
      console.log(`[CxF Builder] Processing spectral data for mode ${mode} for "${name}" (csId: ${csId})`);

      // Create color specification for this mode if not exists (with consolidation)
      const specConfig = {
        illuminant: defaultIlluminant,
        observer: defaultObserver,
        astmTable: defaultAstmTable,
        mode,
        startWL: getSpectralStartWL(meas),
        increment: getSpectralIncrement(meas)
      };
      const signature = getColorSpecificationSignature(specConfig);
      
      let consolidatedId;
      if (!colorSpecifications.has(signature)) {
        // First time seeing this signature - use current csId as the consolidated ID
        consolidatedId = csId;
        const colorSpecXml = buildColorSpecification(consolidatedId, specConfig, true);
        colorSpecifications.set(signature, { xml: colorSpecXml, id: consolidatedId });
        
        // Update colorimetryIndex for tristimulus signature
        const colorimetrySignature = getColorimetrySignature(specConfig);
        colorimetryIndex.set(colorimetrySignature, consolidatedId);
        
        console.log(`[CxF Builder] Created ColorSpecification ${consolidatedId} for mode ${mode} (signature: ${signature})`);
      } else {
        // Reuse existing consolidated ID
        consolidatedId = colorSpecifications.get(signature).id;
        console.log(`[CxF Builder] Reusing ColorSpecification ${consolidatedId} for mode ${mode} (signature: ${signature})`);
      }
      colorSpecificationMap.set(csId, consolidatedId);

      // Process spectral data if available
      if (meas.spectral_data && typeof meas.spectral_data === 'object' && Object.keys(meas.spectral_data).length > 0) {
        const spectralResult = processSpectralData(meas, `${name}_${mode}`, consolidatedId, validationWarnings);
        if (spectralResult.success) {
          colorValuesXml.push(spectralResult.xml);
          hasValidData = true;
          console.log(`[CxF Builder] Added spectral data for "${name}" mode ${mode}`);
        }
      }
    });
  }

  // Process Lab data - only ONE Lab value per color, based on selectedLabMode or first available
  if (includeLab) {
    let labMeasurement = null;
    let labCsId = null;

    // If selectedLabMode is specified, use that mode's Lab data
    if (selectedLabMode) {
      const selectedMeas = measurementModes.find(meas => (meas.mode || defaultMode).toUpperCase() === selectedLabMode.toUpperCase());
      if (selectedMeas?.lab && typeof selectedMeas.lab.L === 'number' && typeof selectedMeas.lab.a === 'number' && typeof selectedMeas.lab.b === 'number') {
        labMeasurement = selectedMeas.lab;
        const originalLabCsId = measurementModes.length > 1 ? `${baseCSId}_${selectedLabMode}` : baseCSId;
        labCsId = colorSpecificationMap.get(originalLabCsId) || originalLabCsId;
        console.log(`[CxF Builder] Using Lab data from selected mode ${selectedLabMode} for "${name}"`);
      }
    }
    
    // Fallback to first available Lab measurement
    if (!labMeasurement) {
      for (const meas of measurementModes) {
        if (meas.lab && typeof meas.lab.L === 'number' && typeof meas.lab.a === 'number' && typeof meas.lab.b === 'number') {
          labMeasurement = meas.lab;
          const mode = meas.mode || defaultMode;
          const originalLabCsId = measurementModes.length > 1 ? `${baseCSId}_${mode}` : baseCSId;
          labCsId = colorSpecificationMap.get(originalLabCsId) || originalLabCsId;
          console.log(`[CxF Builder] Using Lab data from first available mode ${mode} for "${name}"`);
          break;
        }
      }
    }

    // Add Lab data if found
    if (labMeasurement && validateLabValues(labMeasurement, validationWarnings)) {
      // Check colorimetryIndex first to see if we can reuse an existing spec
      const colorimetrySignature = getColorimetrySignature({
        illuminant: defaultIlluminant,
        observer: defaultObserver,
        astmTable: defaultAstmTable
      });
      
      let finalLabCsId = labCsId;
      if (colorimetryIndex.has(colorimetrySignature)) {
        // Reuse existing ColorSpecification ID that matches colorimetry
        finalLabCsId = colorimetryIndex.get(colorimetrySignature);
        console.log(`[CxF Builder] Reusing existing ColorSpecification ${finalLabCsId} for Lab data (colorimetry match)`);
      } else {
        // Create new tristimulus-only ColorSpecification
        const tristimulusOnlyConfig = {
          illuminant: defaultIlluminant,          observer: defaultObserver,
          astmTable: defaultAstmTable
        };
        const tristimulusSignature = `TRI_${colorimetrySignature}`;
        
        if (!colorSpecifications.has(tristimulusSignature)) {
          // Create tristimulus-only ColorSpecification (no MeasurementSpec)
          const colorSpecXml = buildColorSpecification(labCsId, tristimulusOnlyConfig, false);
          colorSpecifications.set(tristimulusSignature, { xml: colorSpecXml, id: labCsId });
          colorimetryIndex.set(colorimetrySignature, labCsId);
          console.log(`[CxF Builder] Created tristimulus-only ColorSpecification ${labCsId} for Lab data`);
        }
        colorSpecificationMap.set(labCsId, labCsId);
      }
      
      const labXml = `      <cc:ColorCIELab ColorSpecification="${finalLabCsId}">
        <cc:L>${labMeasurement.L}</cc:L>
        <cc:A>${labMeasurement.a}</cc:A>
        <cc:B>${labMeasurement.b}</cc:B>
      </cc:ColorCIELab>`;
      colorValuesXml.push(labXml);
      hasValidData = true;
      console.log(`[CxF Builder] Added Lab data for "${name}" using ColorSpecification ${finalLabCsId}`);
    }
  }
  
  console.log(`[CxF Builder] "${name}": Generated ${colorValuesXml.length} ColorValues entries, hasValidData: ${hasValidData}`);

  // Process reference Lab data as fallback if includeLab is true and no measurement Lab was processed
  if (includeLab && !hasValidData && lab && typeof lab.L === 'number' && typeof lab.a === 'number' && typeof lab.b === 'number') {
    if (validateLabValues(lab, validationWarnings)) {
      // Check colorimetryIndex first to see if we can reuse an existing spec
      const colorimetrySignature = getColorimetrySignature({
        illuminant: defaultIlluminant,
        observer: defaultObserver,
        astmTable: defaultAstmTable
      });
      
      let finalCsId = baseCSId;
      if (colorimetryIndex.has(colorimetrySignature)) {
        // Reuse existing ColorSpecification ID that matches colorimetry
        finalCsId = colorimetryIndex.get(colorimetrySignature);
        console.log(`[CxF Builder] Reusing existing ColorSpecification ${finalCsId} for reference Lab data (colorimetry match)`);
      } else {
        // Create new tristimulus-only ColorSpecification
        const tristimulusOnlyConfig = {
          illuminant: defaultIlluminant,
          observer: defaultObserver,
          astmTable: defaultAstmTable
        };
        const tristimulusSignature = `TRI_${colorimetrySignature}`;
        
        if (!colorSpecifications.has(tristimulusSignature)) {
          // Create tristimulus-only ColorSpecification (no MeasurementSpec)
          const colorSpecXml = buildColorSpecification(baseCSId, tristimulusOnlyConfig, false);
          colorSpecifications.set(tristimulusSignature, { xml: colorSpecXml, id: baseCSId });
          colorimetryIndex.set(colorimetrySignature, baseCSId);
          console.log(`[CxF Builder] Created tristimulus-only ColorSpecification ${baseCSId} for reference Lab data`);
        }
        colorSpecificationMap.set(baseCSId, baseCSId);
      }
      
      const labXml = `      <cc:ColorCIELab ColorSpecification="${finalCsId}">
        <cc:L>${lab.L}</cc:L>
        <cc:A>${lab.a}</cc:A>
        <cc:B>${lab.b}</cc:B>
      </cc:ColorCIELab>`;
      colorValuesXml.push(labXml);
      hasValidData = true;
      console.log(`[CxF Builder] Added reference Lab data for "${name}" using ColorSpecification ${finalCsId}`);
    }
  }

  if (!hasValidData) {
    return { success: false };
  }

  const timestamp = new Date().toISOString();
  const objectXml = `      <cc:Object ObjectType="Standard" Id="${objId}" Name="${xmlEsc(name)}">
        <cc:CreationDate>${timestamp}</cc:CreationDate>
        <cc:ColorValues>
${colorValuesXml.filter(cv => cv.trim()).join('\n')}
        </cc:ColorValues>
      </cc:Object>`;

  return { success: true, objectXml };
}

function processInkConditionForX4(inkData, config) {
  const { defaultMode, defaultIlluminant, defaultObserver, defaultAstmTable, xmlEsc, colorSpecifications, colorSpecificationMap, objects, validationWarnings, sicIndex, options = {} } = config;
  
  if (!inkData.imported_tints || !Array.isArray(inkData.imported_tints) || inkData.imported_tints.length === 0) {
    return { success: false };
  }

  const spotInkName = inkData.name || 'Spot Ink';
  const tints = inkData.imported_tints;
  const measurementSets = [];
  let objectCount = 0;

  // Format SIC index with zero padding (01, 02, 03...)
  const sicPrefix = sicIndex.toString().padStart(2, '0');

  // Group tints by background name to create separate MeasurementSets for each background
  const tintsByBackground = new Map();
  
  tints.forEach(tint => {
    const backgroundName = tint.backgroundName || (tint.tintPercentage === 0 ? 'Substrate' : 'Tint');
    if (!tintsByBackground.has(backgroundName)) {
      tintsByBackground.set(backgroundName, []);
    }
    tintsByBackground.get(backgroundName).push(tint);
  });

  // Process each background group separately
  for (const [backgroundName, backgroundTints] of tintsByBackground) {
    const backgroundResult = processTintGroup(backgroundTints, backgroundName, spotInkName, {
      ...config,
      sicPrefix,
      options
    });
    if (backgroundResult.success) {
      objects.push(...backgroundResult.objects);
      measurementSets.push(backgroundResult.measurementSet);
      objectCount += backgroundResult.objects.length;
    }
  }

  if (measurementSets.length === 0) {
    return { success: false };
  }

  const characterisationXml = `    <sic:SpotInkCharacterisation SpotInkName="${xmlEsc(spotInkName)}" PrintProcess="OffsetLithography" SubstrateType="Coated Paper" SubstrateName="Standard">
${measurementSets.filter(ms => ms.trim()).join('\n')}
    </sic:SpotInkCharacterisation>`;

  return { success: true, characterisationXml, objectCount };
}

function processTintGroup(tints, groupType, spotInkName, config) {
  const { xmlEsc, colorSpecifications, colorSpecificationMap, colorimetryIndex, sicPrefix, options = {} } = config;
  const { includeSpectral = true, includeLab = true } = options;
  const objects = [];
  const measurements = [];

  tints.forEach((tint, idx) => {
    // Smart ID enumeration for CxF/X-4: sicIndex_tintIndex (e.g., 01_1, 01_2, 01_3)
    const objId = `${sicPrefix}_${idx + 1}`;
    let csId = `CS-${objId}`;
    const objectType = groupType === 'Substrate' ? 'Substrate' : 'Tint';
    const tintPercentage = tint.tintPercentage || 0;

    // Build color values
    const colorValuesXml = [];
    let hasValidData = false;

    // Process spectral data (only if includeSpectral is true)
    const spectralData = extractSpectralData(tint, `tint ${objId}`);
    if (includeSpectral && spectralData) {
      const spectralXml = buildSpectralXml(spectralData, `${objId}CS`, csId);
      if (spectralXml) {
        colorValuesXml.push(spectralXml);
        hasValidData = true;
      }
    }

    // Process Lab data (only if includeLab is true)
    if (includeLab && tint.lab && validateLabValues(tint.lab, [])) {
      const labXml = `      <cc:ColorCIELab ColorSpecification="${csId}">
        <cc:L>${tint.lab.L}</cc:L>
        <cc:A>${tint.lab.a}</cc:A>
        <cc:B>${tint.lab.b}</cc:B>
      </cc:ColorCIELab>`;
      colorValuesXml.push(labXml);
      hasValidData = true;
    }

    if (!hasValidData) return;

    // Check for existing ColorSpecification with matching colorimetry (upgrade logic)
    const colorimetrySignature = getColorimetrySignature(config);
    const signature = getColorSpecificationSignature(config);
    let existingCsId = null;
    
    if (colorimetryIndex.has(colorimetrySignature)) {
      existingCsId = colorimetryIndex.get(colorimetrySignature);
      
      // Check if existing ColorSpec needs upgrading (is tristimulus-only)
      const existingEntry = Array.from(colorSpecifications.values()).find(entry => entry.id === existingCsId);
      if (existingEntry && !existingEntry.xml.includes('<cc:MeasurementSpec>')) {
        // Upgrade existing tristimulus-only ColorSpec to include MeasurementSpec
        const upgradedColorSpecXml = buildColorSpecification(existingCsId, config, true);
        existingEntry.xml = upgradedColorSpecXml;
        console.log(`[CxF Builder] Upgraded ColorSpecification ${existingCsId} to include MeasurementSpec`);
      }
      
      // Reuse existing ColorSpec ID
      csId = existingCsId;
      colorSpecificationMap.set(csId, existingCsId);
      console.log(`[CxF Builder] Reusing existing ColorSpecification ${existingCsId} for ink condition`);
    } else {
      // Create new ColorSpecification
      if (!colorSpecifications.has(signature)) {
        const colorSpecXml = buildColorSpecification(csId, config, true);
        colorSpecifications.set(signature, { xml: colorSpecXml, id: csId });
        colorimetryIndex.set(colorimetrySignature, csId);
        console.log(`[CxF Builder] Created new ColorSpecification ${csId} for ink condition`);
      }
      colorSpecificationMap.set(csId, colorSpecifications.get(signature).id);
    }

    // Create device color values (spot color percentage)
    const deviceColorXml = `        <cc:DeviceColorValues>
          <cc:ColorCustom Name="${xmlEsc(spotInkName)}" ColorSpecification="${csId}">
            <cc:SpotColor>
              <cc:Name>${xmlEsc(spotInkName)}</cc:Name>
              <cc:Percentage>${tintPercentage}</cc:Percentage>
            </cc:SpotColor>
          </cc:ColorCustom>
        </cc:DeviceColorValues>`;

    const timestamp = new Date().toISOString();
    const objectXml = `      <cc:Object ObjectType="${objectType}" Id="${objId}" Name="${xmlEsc(spotInkName)}">
        <cc:CreationDate>${timestamp}</cc:CreationDate>
        <cc:ColorValues>
${colorValuesXml.filter(cv => cv.trim()).join('\n')}
        </cc:ColorValues>
${deviceColorXml}
      </cc:Object>`;

    objects.push(objectXml);
    measurements.push(`        <sic:Measurement TintLevel="${tintPercentage}" ObjectRef="${objId}" ReflectanceSpectrumNameRef="${csId}" />`);
  });

  const measurementSet = `      <sic:MeasurementSet Background="${groupType}">
${measurements.filter(m => m.trim()).join('\n')}
      </sic:MeasurementSet>`;

  return { success: objects.length > 0, objects, measurementSet };
}

function processSpectralData(meas, name, csId, validationWarnings) {
  const spectral = meas.spectral_data;
  const sortedWls = Object.keys(spectral).map(Number).sort((a, b) => a - b);
  
  if (sortedWls.length === 0) {
    return { success: false };
  }

  // Auto-normalize if values appear to be on 0-100 scale
  const maxValue = Math.max(...sortedWls.map(wl => spectral[wl]));
  if (maxValue > 1.1) {
    console.log(`[CxF Builder] Auto-normalizing spectral data for "${name}" (max value: ${maxValue})`);
    sortedWls.forEach(wl => {
      spectral[wl] = spectral[wl] / 100;
    });
  }

  const startWL = sortedWls[0];
  const increment = sortedWls.length > 1 ? (sortedWls[1] - sortedWls[0]) : 10;

  // Validate wavelength range
  if (startWL < 360 || startWL > 400) {
    validationWarnings.push(`Color "${name}": StartWL ${startWL}nm outside recommended range (360-400nm)`);
  }

  // Validate increment
  const validIncrements = [1, 2, 5, 10, 20];
  if (!validIncrements.includes(increment)) {
    validationWarnings.push(`Color "${name}": Increment ${increment}nm not standard (recommended: 1,2,5,10,20nm)`);
  }

  const values = sortedWls.map(wl => spectral[wl]).join(' ');
  const xml = `      <cc:ReflectanceSpectrum ColorSpecification="${csId}" Name="${name}CS" StartWL="${startWL}" Increment="${increment}">
        ${values}
      </cc:ReflectanceSpectrum>`;

  return { success: true, xml };
}

function buildSpectralXml(spectralData, name, csId) {
  if (!spectralData || typeof spectralData !== 'object') return null;

  const sortedWls = Object.keys(spectralData).map(Number).sort((a, b) => a - b);
  if (sortedWls.length === 0) return null;

  // Auto-normalize if values appear to be on 0-100 scale
  const maxValue = Math.max(...sortedWls.map(wl => spectralData[wl]));
  if (maxValue > 1.1) {
    sortedWls.forEach(wl => {
      spectralData[wl] = spectralData[wl] / 100;
    });
  }

  const startWL = sortedWls[0];
  const increment = sortedWls.length > 1 ? (sortedWls[1] - sortedWls[0]) : 10;
  const values = sortedWls.map(wl => spectralData[wl]).join(' ');

  return `      <cc:ReflectanceSpectrum ColorSpecification="${csId}" Name="${name}" StartWL="${startWL}" Increment="${increment}">
        ${values}
      </cc:ReflectanceSpectrum>`;
}

function buildColorSpecification(csId, config, includeMeasurementSpec = true) {
  const { illuminant = 'D50', observer = '2', astmTable = '5', mode = 'M1', startWL = 380, increment = 10 } = config;

  const observerEnum = observer === '2' ? '2_Degree' : '10_Degree';
  const astmMethod = astmTable === '5' ? 'E308_Table5' : 'E308_Table6';

  let measurementSpecXml = '';
  if (includeMeasurementSpec) {
    const deviceIllumination = mapModeToDeviceIllumination(mode);
    measurementSpecXml = `
        <cc:MeasurementSpec>
          <cc:MeasurementType>Spectrum_Reflectance</cc:MeasurementType>
          <cc:GeometryChoice>${['M0', 'M1', 'M2', 'M3'].includes(mode) ? `<cc:SingleAngle><cc:SingleAngleConfiguration>Annular</cc:SingleAngleConfiguration><cc:IlluminationAngle>45</cc:IlluminationAngle><cc:MeasurementAngle>0.0</cc:MeasurementAngle></cc:SingleAngle>` : `<cc:SphereGeometry><cc:SphereGeometryConfiguration>Specular_Excluded</cc:SphereGeometryConfiguration></cc:SphereGeometry>`}</cc:GeometryChoice>
          <cc:WavelengthRange StartWL="${startWL}" Increment="${increment}"/>
          <cc:Device>
            <cc:DeviceIllumination>${deviceIllumination}</cc:DeviceIllumination>
          </cc:Device>
        </cc:MeasurementSpec>`;
  }

  return `      <cc:ColorSpecification Id="${csId}">
        <cc:TristimulusSpec>
          <cc:Illuminant>${illuminant}</cc:Illuminant>
          <cc:Observer>${observerEnum}</cc:Observer>
          <cc:Method>${astmMethod}</cc:Method>
        </cc:TristimulusSpec>${measurementSpecXml}
      </cc:ColorSpecification>`;
}

function validateLabValues(lab, validationWarnings) {
  if (typeof lab.L !== 'number' || typeof lab.a !== 'number' || typeof lab.b !== 'number') {
    return false;
  }

  if (lab.L < 0) {
    validationWarnings.push(`Invalid Lab L* value: ${lab.L} (must be ≥ 0)`);
    return false;
  }

  // Reasonable range checks
  if (lab.L > 100) validationWarnings.push(`Lab L* value ${lab.L} exceeds typical range (0-100)`);
  if (Math.abs(lab.a) > 150) validationWarnings.push(`Lab a* value ${lab.a} exceeds typical range (-150 to +150)`);
  if (Math.abs(lab.b) > 150) validationWarnings.push(`Lab b* value ${lab.b} exceeds typical range (-150 to +150)`);

  return true;
}

function mapModeToDeviceIllumination(mode) {
  const modeMap = {
    'M0': 'M0_Incandescent',
    'M1': 'M1_Daylight',
    'M2': 'M2_UVExcluded',
    'M3': 'M3_Polarized'
  };
  return modeMap[mode] || 'M1_Daylight';
}

function getSpectralStartWL(meas) {
  if (!meas?.spectral_data) return 380;
  const wls = Object.keys(meas.spectral_data).map(Number);
  return wls.length > 0 ? Math.min(...wls) : 380;
}

function getSpectralIncrement(meas) {
  if (!meas?.spectral_data) return 10;
  const sortedWls = Object.keys(meas.spectral_data).map(Number).sort((a, b) => a - b);
  return sortedWls.length > 1 ? (sortedWls[1] - sortedWls[0]) : 10;
}

// Create a signature for ColorSpecification consolidation
function getColorSpecificationSignature(config) {
  const { illuminant = 'D50', observer = '2', astmTable = '5', mode = 'M1', startWL = 380, increment = 10 } = config;
  return `${illuminant}_${observer}_${astmTable}_${mode}_${startWL}_${increment}`;
}

// Create a colorimetry-only signature (ignores mode/wavelength for tristimulus matching)
function getColorimetrySignature(config) {
  const { illuminant = 'D50', observer = '2', astmTable = '5' } = config;
  return `${illuminant}_${observer}_${astmTable}`;
}

// Legacy function for backward compatibility
export function buildCxF3({ job, references = [], measurementsByColorId = {}, orgDefaults = {} }) {
  console.warn('buildCxF3 is deprecated. Use buildCxf3 instead.');
  return buildCxf3({ job, references, measurementsByColorId, orgDefaults });
}
import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import { labToHex, spectralToLabASTME308, getDisplayHexWithOrgDefaults, computeDefaultDisplayColor } from '@/lib/colorUtils';
import { debug } from '@/lib/debugUtils';

/**
 * Unified CxF file parser that handles all CxF parsing scenarios
 * Supports CxF/X-4, CxF/X-4a, and CxF/X-4b spot color characterization
 * Works consistently regardless of where it's called from
 */
export class CxfParser {
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      trimValues: true,
      ignoreNameSpace: false,
      parseAttributeValue: true,
      parseTrueNumberOnly: false
    });
  }

  /**
   * Parse CxF XML content and return color objects
   * Supports CxF/X-4, CxF/X-4a, and CxF/X-4b variants
   * @param {string} xmlData - Raw XML content from CxF file
   * @param {Object} options - Optional parameters for enhanced parsing
   * @param {Array} options.astmTables - ASTM E308 tables for spectral conversion
   * @param {Object} options.orgDefaults - Organization defaults for illuminant/observer
   * @param {Function} options.onProgress - Callback for progress updates
   * @returns {Array} Array of parsed color objects
   */
  parse(xmlData, options = {}) {
    // Store options for use in parsing methods
    this.parsingOptions = {
      astmTables: options.astmTables || [],
      orgDefaults: options.orgDefaults || {},
      onProgress: options.onProgress || null
    };
    
    // Emit initial progress
    this.emitProgress({ stage: 'reading', progress: 10 });
    
    try {
      const jsonObj = this.parser.parse(xmlData);
      
    console.log('=== CXF PARSER DEBUG ===');
    console.log('Root keys:', Object.keys(jsonObj));
    console.log('Full JSON structure (first 8000 chars):', JSON.stringify(jsonObj, null, 2).substring(0, 8000));
    
    // Special check for the exact structure from your sample
    if (jsonObj['cc:CxF'] && jsonObj['cc:CxF']['cc:CustomResources']) {
      console.log('=== FOUND CUSTOM RESOURCES IN YOUR SAMPLE FORMAT ===');
      console.log('CustomResources content:', JSON.stringify(jsonObj['cc:CxF']['cc:CustomResources'], null, 2));
    }
      
      // Store full parsed object for ObjectRef lookups
      this.fullParsedObject = jsonObj;
      
      // Detect CxF/X-4 variant and handle accordingly
      const cxfVariant = this.detectCxfVariant(jsonObj);
      console.log('=== CXF VARIANT DETECTION ===');
      console.log('Detected CxF variant:', cxfVariant);
      
      // Emit parsing started
      this.emitProgress({ stage: 'parsing', progress: 30 });
      
      // Find color objects in various possible locations
      const colorObjects = this.findColorObjects(jsonObj);
      
      // Find and parse ColorSpecifications for deviceillumination lookup
      const colorSpecifications = this.findColorSpecifications(jsonObj);
      console.log('=== COLOR SPECIFICATIONS FOUND ===');
      console.log('ColorSpecifications found:', colorSpecifications ? colorSpecifications.length : 0);
      if (colorSpecifications && colorSpecifications.length > 0) {
        console.log('First ColorSpecification sample:', JSON.stringify(colorSpecifications[0], null, 2).substring(0, 500));
        // Create lookup map
        this.colorSpecificationMap = this.createColorSpecificationMap(colorSpecifications);
        console.log('ColorSpecification lookup map keys:', Object.keys(this.colorSpecificationMap));
      } else {
        this.colorSpecificationMap = {};
      }
      console.log('=== OBJECTS FOUND ===');
      console.log('Color objects found:', colorObjects ? colorObjects.length : 0);
      if (colorObjects && colorObjects.length > 0) {
        console.log('First object sample:', JSON.stringify(colorObjects[0], null, 2).substring(0, 1000));
      }
      
      if (!colorObjects || colorObjects.length === 0) {
        console.error('=== NO OBJECTS DEBUG ===');
        console.log('Checking for any Object-like keys in the structure...');
        this.debugSearchForObjects(jsonObj);
        
        // Try to find ANYTHING that might be a color object
        console.log('=== EXHAUSTIVE SEARCH FOR ANY COLOR DATA ===');
        this.exhaustiveSearchForColorData(jsonObj);
        
        // Graceful fallback: return empty result instead of throwing
        return {
          colors: [],
          needsModeSelection: false
        };
      }

      // Parse each color object with variant context
      const totalObjects = colorObjects.length;
      const parsedColors = colorObjects.map((colorObj, index) => {
      console.log(`=== PARSING OBJECT ${index + 1} ===`);
      console.log('Object keys:', Object.keys(colorObj));
      console.log('Object sample:', JSON.stringify(colorObj, null, 2).substring(0, 500));
      
      // Emit progress for parsing stage
      const parsingProgress = 30 + Math.floor((index / totalObjects) * 40); // 30-70% range
      this.emitProgress({ 
        stage: 'parsing', 
        progress: parsingProgress,
        processed: index + 1,
        total: totalObjects
      });
      
      const parsed = this.parseColorObject(colorObj, index, cxfVariant);
      console.log('Parsed result:', parsed ? 'SUCCESS' : 'FAILED');
      if (parsed) {
        console.log('Parsed object details:', {
          name: parsed.name,
          objectType: parsed.objectType,
          isSpotColor: parsed.isSpotColor,
          spotInkName: parsed.spotInkName,
          tintPercentage: parsed.tintPercentage,
          hex: parsed.hex || parsed.colorHex,
          hasSpectral: !!(parsed.spectral_data || (parsed.measurements && parsed.measurements[0]?.spectral_data))
        });
      } else {
        console.log('PARSING FAILED for object:', colorObj['@_Name'] || 'Unknown');
      }
      return parsed;
      });
      
      const validColors = parsedColors.filter(Boolean);
      
      // Track colors that need mode selection (have spectral data but no mode)
      const needsModeSelection = validColors.some(color => {
        const hasSpectralData = color.spectralData || 
                               (color.measurements && color.measurements.some(m => m.spectral_data));
        const hasNoMode = !color.measurementMode || color.measurementMode === null;
        return hasSpectralData && hasNoMode;
      });
      
      console.log('=== PARSING COMPLETE ===');
      console.log('Parsed colors count:', validColors.length);
      console.log('Needs mode selection:', needsModeSelection);
      
      // Emit complete
      this.emitProgress({ stage: 'complete', progress: 100 });
      
      return {
        colors: validColors,
        needsModeSelection
      };
    } catch (error) {
      console.error('=== CXF PARSING ERROR ===', error);
      this.emitProgress({ stage: 'error', progress: 0 });
      throw new Error(`Error parsing CxF file: ${error.message}`);
    }
  }

  /**
   * Emit progress update if callback is provided
   */
  emitProgress(progressData) {
    if (this.parsingOptions?.onProgress && typeof this.parsingOptions.onProgress === 'function') {
      this.parsingOptions.onProgress(progressData);
    }
  }

  /**
   * Detect CxF/X variant (4, 4a, or 4b) based on file structure
   * @param {Object} jsonObj - Parsed JSON object
   * @returns {string} Detected variant ('CxF/X-4', 'CxF/X-4a', 'CxF/X-4b', or 'CxF3')
   */
  detectCxfVariant(jsonObj) {
    console.log('=== DETECTING CXF VARIANT ===');
    
    // Check for SpotInkCharacterisation data - this is the ONLY reliable CxF/X-4 indicator
    // Must have both CustomResources AND actual SpotInkCharacterisation objects
    if (jsonObj['cc:CxF'] && jsonObj['cc:CxF']['cc:CustomResources']) {
      const customResources = jsonObj['cc:CxF']['cc:CustomResources'];
      const spotInkNode =
        customResources['sic:SpotInkCharacterisation'] ||
        customResources['sic:SpotInkCharacterization'] ||
        customResources.SpotInkCharacterisation ||
        customResources.SpotInkCharacterization;
      if (spotInkNode) {
        console.log('Found SpotInkCharacterisation/Characterization in CustomResources - this is CxF/X-4 format');
        
        // Look for black substrate measurements to distinguish between variants
        const hasBlackSubstrate = this.hasBlackSubstrateMeasurements(jsonObj);
        const tintCount = this.countTintMeasurements(jsonObj);
        
        console.log('Black substrate:', hasBlackSubstrate, 'Tint count:', tintCount);
        
        let variant;
        if (hasBlackSubstrate) {
          variant = 'CxF/X-4'; // Full variant with black substrate
        } else if (tintCount >= 3) {
          variant = 'CxF/X-4a'; // Multiple tints on white substrate
        } else {
          variant = 'CxF/X-4b'; // Single solid measurement
        }
        
        console.log('=== CXF/X-4 DETECTED ===', variant);
        return variant;
      }
    }
    
    // Check for CxF3 indicators
    const xmlString = JSON.stringify(jsonObj, null, 2);
    if (xmlString.includes('CxF3') || xmlString.includes('CxF xmlns')) {
      console.log('=== CXF3 DETECTED ===');
      return 'CxF3';
    }
    
    // Default to CxF3 for legacy format (including CxF3 files with CustomResources but no SpotInkCharacterisation)
    console.log('=== DEFAULTING TO CXF3 ===');
    return 'CxF3';
  }

  /**
   * Check if the file contains black substrate measurements
   */
  hasBlackSubstrateMeasurements(jsonObj) {
    const xmlString = JSON.stringify(jsonObj, null, 2).toLowerCase();
    return xmlString.includes('black') && 
           (xmlString.includes('substrate') || xmlString.includes('backing'));
  }

  /**
   * Count the number of tint measurements in the file
   */
  countTintMeasurements(jsonObj) {
    const colorObjects = this.findColorObjects(jsonObj);
    if (!colorObjects) return 0;
    
    // Count unique tint percentages
    const tintPercentages = new Set();
    
    colorObjects.forEach(obj => {
      const name = obj["@_Name"] || '';
      const tintMatch = name.match(/(\d+)%?/);
      if (tintMatch) {
        tintPercentages.add(parseInt(tintMatch[1]));
      }
      
      // Also check for substrate/paper measurements (0%)
      if (name.toLowerCase().includes('substrate') || 
          name.toLowerCase().includes('paper') ||
          name.toLowerCase().includes('backing')) {
        tintPercentages.add(0);
      }
    });
    
    return tintPercentages.size;
  }

  /**
   * Find color objects in the parsed JSON structure
   * Handles various namespaces and structures
   */
  findColorObjects(jsonObj) {
    // First check for SpotInkCharacterisation in CustomResources for CxF/X-4
    console.log('=== SEARCHING FOR CUSTOM RESOURCES ===');
    
    // First, let's see what's directly under cc:CxF
    const cxfRoot = this.getNestedProperty(jsonObj, 'cc:CxF');
    if (cxfRoot) {
      console.log('cc:CxF root keys:', Object.keys(cxfRoot));
      
      // Check if CustomResources exists
      if (cxfRoot['cc:CustomResources']) {
        console.log('Found cc:CustomResources!');
        console.log('CustomResources content:', JSON.stringify(cxfRoot['cc:CustomResources'], null, 2));
        
        // Check for SpotInkCharacterisation/Characterization
        const customRes = cxfRoot['cc:CustomResources'];
        const spotInkDataNode =
          customRes['sic:SpotInkCharacterisation'] ||
          customRes['sic:SpotInkCharacterization'] ||
          customRes.SpotInkCharacterisation ||
          customRes.SpotInkCharacterization;
        if (spotInkDataNode) {
          console.log('Found SpotInkCharacterisation/Characterization in CustomResources!');
          const spotInkArray = Array.isArray(spotInkDataNode) ? spotInkDataNode : [spotInkDataNode];
          console.log(`Found ${spotInkArray.length} SpotInkCharacterisation/Characterization objects`);
          return spotInkArray;
        }
      }
    }
    
    const customResourcesPaths = [
      'cc:CxF.cc:CustomResources.sic:SpotInkCharacterisation',
      'cc:CxF.cc:CustomResources.sic:SpotInkCharacterization',
      'CxF.CustomResources.SpotInkCharacterisation', 
      'CxF.CustomResources.SpotInkCharacterization',
      'CustomResources.SpotInkCharacterisation',
      'CustomResources.SpotInkCharacterization',
      'cc:CustomResources.sic:SpotInkCharacterisation',
      'cc:CustomResources.sic:SpotInkCharacterization',
      'cc:CxF.cc:CustomResources',
      'CxF.CustomResources',
      'CustomResources',
      'cc:CustomResources'
    ];
    
    for (const path of customResourcesPaths) {
      const customResources = this.getNestedProperty(jsonObj, path);
      console.log(`Checking path "${path}":`, customResources ? 'FOUND' : 'NOT FOUND');
      
      if (customResources) {
        console.log(`Found CustomResources at path: ${path}`);
        console.log('CustomResources keys:', Object.keys(customResources));
        console.log('CustomResources sample:', JSON.stringify(customResources, null, 2).substring(0, 1000));
        
        // Look for SpotInkCharacterisation within the found CustomResources
        let spotInkData = null;
        if (customResources['sic:SpotInkCharacterisation']) {
          spotInkData = customResources['sic:SpotInkCharacterisation'];
          console.log('Found sic:SpotInkCharacterisation');
        } else if (customResources['sic:SpotInkCharacterization']) {
          spotInkData = customResources['sic:SpotInkCharacterization'];
          console.log('Found sic:SpotInkCharacterization');
        } else if (customResources.SpotInkCharacterisation) {
          spotInkData = customResources.SpotInkCharacterisation;
          console.log('Found SpotInkCharacterisation');
        } else if (customResources.SpotInkCharacterization) {
          spotInkData = customResources.SpotInkCharacterization;
          console.log('Found SpotInkCharacterization');
        } else if (customResources['@_SpotInkName'] || customResources.SpotInkName) {
          // Maybe the customResources IS the SpotInkCharacterisation
          spotInkData = customResources;
          console.log('CustomResources appears to be SpotInkCharacterisation/Characterization');
        }
        
        if (spotInkData) {
          console.log(`Found SpotInkCharacterisation data:`, JSON.stringify(spotInkData, null, 2).substring(0, 1000));
          const spotInkArray = Array.isArray(spotInkData) ? spotInkData : [spotInkData];
          console.log(`Found ${spotInkArray.length} SpotInkCharacterisation objects`);
          return spotInkArray;
        }
      }
    }

    console.log('=== FALLING BACK TO REGULAR OBJECTS ===');
    
    // Check all possible locations where objects might be
    const possiblePaths = [
      'cc:CxF.cc:Resources.cc:ObjectCollection.cc:Object', // Full path for CxF format
      'CxF.Resources.ObjectCollection.Object', // Alternative namespace
      'CxF.ObjectCollection.Object', // Simpler path
      'Resources.ObjectCollection.Object', // Without CxF prefix
      'ObjectCollection.Object', // Direct access
      'CXF.Object',
      'Object', 
      'Resources.Object',
      'ColorExchange.Object',
      'cc:CXF.cc:Object',
      'cc:Object',
      // Additional paths for different CxF3 variants
      'CxF.Object',
      'cc:CxF.Object',
      'CxF.Resources.Object'
    ];

    for (const path of possiblePaths) {
      const objects = this.getNestedProperty(jsonObj, path);
      if (objects) {
        const objectArray = Array.isArray(objects) ? objects : [objects];
        console.log(`Found ${objectArray.length} regular objects at path: ${path}`);
        
        // Check if these objects contain spot color information
        const hasSpotColorInfo = objectArray.some(obj => {
          const deviceColorValues = obj['cc:DeviceColorValues'] || obj.DeviceColorValues;
          if (deviceColorValues) {
            const colorCustom = deviceColorValues['cc:ColorCustom'] || deviceColorValues.ColorCustom;
            if (colorCustom) {
              const spotColor = colorCustom['cc:SpotColor'] || colorCustom.SpotColor;
              return !!spotColor;
            }
          }
          return false;
        });
        
        if (hasSpotColorInfo) {
          console.log('Objects contain spot color information in DeviceColorValues');
        }
        
        console.log(`=== PROCESSING ${objectArray.length} OBJECTS FROM PATH: ${path} ===`);
        return objectArray;
      }
    }

    // Also check for arrays at root level
    if (Array.isArray(jsonObj['cc:Object'])) {
      console.log(`Found ${jsonObj['cc:Object'].length} objects at root cc:Object`);
      return jsonObj['cc:Object'];
    }

    // Additional fallback: search for any property that contains an array of objects
    console.log('=== SEARCHING FOR ANY ARRAY OF OBJECTS ===');
    const foundArrays = this.findArraysInStructure(jsonObj);
    if (foundArrays.length > 0) {
      console.log(`Found ${foundArrays.length} potential object arrays`);
      for (const arrayPath of foundArrays) {
        const array = this.getNestedProperty(jsonObj, arrayPath);
        if (array && Array.isArray(array) && array.length > 0) {
          // Check if first item looks like a color object
          const firstItem = array[0];
          if (firstItem && typeof firstItem === 'object' && 
              (firstItem['@_Name'] || firstItem.Name || firstItem['@_Id'] || firstItem.Id)) {
            console.log(`Using array at path: ${arrayPath} with ${array.length} items`);
            return array;
          }
        }
      }
    }

    return null;
  }

  /**
   * Find ColorSpecification objects in the parsed JSON structure
   */
  findColorSpecifications(jsonObj) {
    // Check possible locations for ColorSpecifications
    const possiblePaths = [
      'cc:CxF.cc:Resources.cc:ColorSpecificationCollection.cc:ColorSpecification',
      'CxF.Resources.ColorSpecificationCollection.ColorSpecification',
      'Resources.ColorSpecificationCollection.ColorSpecification',
      'cc:ColorSpecification',
      'CXF.ColorSpecification',
      'ColorSpecification',
      'Resources.ColorSpecification',
      'ColorExchange.ColorSpecification',
      'cc:CXF.cc:ColorSpecification',
      // Additional paths for different CxF variants
      'CxF.ColorSpecificationCollection.ColorSpecification',
      'cc:CxF.cc:ColorSpecificationCollection.cc:ColorSpecification',
      'ColorSpecificationCollection.ColorSpecification',
      'cc:Resources.cc:ColorSpecification',
      'CxF.Resources.ColorSpecification',
      // Direct paths without collections
      'cc:CxF.cc:ColorSpecification',
      'CxF.ColorSpecification'
    ];

    for (const path of possiblePaths) {
      const specifications = this.getNestedProperty(jsonObj, path);
      if (specifications) {
        const specArray = Array.isArray(specifications) ? specifications : [specifications];
        console.log(`Found ${specArray.length} ColorSpecifications at path: ${path}`);
        return specArray;
      }
    }

    // If no ColorSpecifications found via direct paths, try exhaustive search
    console.log('No ColorSpecifications found via direct paths, trying exhaustive search...');
    const exhaustiveSpecs = this.exhaustiveSearchForColorSpecifications(jsonObj);
    if (exhaustiveSpecs && exhaustiveSpecs.length > 0) {
      console.log(`Found ${exhaustiveSpecs.length} ColorSpecifications via exhaustive search`);
      return exhaustiveSpecs;
    }

    console.log('No ColorSpecifications found anywhere in the CxF file');
    return null;
  }

  /**
   * Exhaustive search for ColorSpecification objects anywhere in the structure
   */
  exhaustiveSearchForColorSpecifications(obj, path = '', depth = 0, found = []) {
    if (depth > 10 || !obj || typeof obj !== 'object') return found;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if this might be a ColorSpecification object
      if (typeof value === 'object' && value !== null) {
        // Look for ColorSpecification indicators
        if (key.toLowerCase().includes('colorspecification') || 
            (value["@_Id"] && this.hasColorSpecificationContent(value))) {
          console.log(`Found potential ColorSpecification at ${currentPath}`);
          found.push(value);
        }
        
        // Also check if this is an array of ColorSpecifications
        if (Array.isArray(value)) {
          value.forEach(item => {
            if (typeof item === 'object' && item !== null && this.hasColorSpecificationContent(item)) {
              console.log(`Found ColorSpecification in array at ${currentPath}`);
              found.push(item);
            }
          });
        }
        
        // Recurse into nested objects
        if (!Array.isArray(value)) {
          this.exhaustiveSearchForColorSpecifications(value, currentPath, depth + 1, found);
        }
      }
    }
    
    return found;
  }

  /**
   * Check if an object has ColorSpecification-like content
   */
  hasColorSpecificationContent(obj) {
    if (!obj || typeof obj !== 'object') return false;
    
    // Look for typical ColorSpecification fields
    const indicators = [
      '@_Id', '@_id', 'Id', 'id',
      '@_deviceillumination', '@_DeviceIllumination',
      'deviceillumination', 'DeviceIllumination',
      'MeasurementSpec', 'DeviceCondition'
    ];
    
    return indicators.some(indicator => obj.hasOwnProperty(indicator));
  }

  /**
   * Create a lookup map of ColorSpecification ID to ColorSpecification object
   */
  createColorSpecificationMap(colorSpecifications) {
    const map = {};
    colorSpecifications.forEach(spec => {
      const id = spec["@_Id"] || spec["@_id"] || spec.Id || spec.id;
      if (id) {
        map[id] = spec;
      }
    });
    return map;
  }

  /**
   * Find arrays in the JSON structure that might contain color objects
   */
  findArraysInStructure(obj, path = '', depth = 0, foundArrays = []) {
    if (depth > 5) return foundArrays; // Prevent infinite recursion

    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        const value = obj[key];
        
        // Check if this is an array with objects
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          console.log(`Found array at ${currentPath} with ${value.length} items`);
          foundArrays.push(currentPath);
        }
        
        // Recurse into objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          this.findArraysInStructure(value, currentPath, depth + 1, foundArrays);
        }
      });
    }
    
    return foundArrays;
  }

  /**
   * Exhaustive search for any color-related data in the CxF file
   */
  exhaustiveSearchForColorData(obj, path = '', depth = 0) {
    if (depth > 6) return; // Prevent infinite recursion

    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        const value = obj[key];
        
        // Log any key that might contain color data
        if (key.toLowerCase().includes('color') || 
            key.toLowerCase().includes('spot') || 
            key.toLowerCase().includes('ink') ||
            key.toLowerCase().includes('measurement') ||
            key.toLowerCase().includes('spectrum') ||
            key.toLowerCase().includes('characteris')) {
          console.log(`🔍 Found potential color data key "${key}" at ${currentPath}:`, typeof value);
          
          // Show first level of structure for objects/arrays
          if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
              console.log(`   Array with ${value.length} items, first item:`, 
                value.length > 0 ? Object.keys(value[0] || {}) : 'empty');
            } else {
              console.log(`   Object keys:`, Object.keys(value));
            }
          }
        }
        
        // Recurse into objects
        if (typeof value === 'object' && value !== null) {
          this.exhaustiveSearchForColorData(value, currentPath, depth + 1);
        }
      });
    }
  }

  /**
   * Debug method to search for any Object-like keys in the structure
   */
  debugSearchForObjects(obj, path = '', depth = 0) {
    if (depth > 5) return; // Prevent infinite recursion

    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Log any key that contains 'Object' or might be relevant
        if (key.toLowerCase().includes('object') || 
            key === 'Object' || 
            key === 'cc:Object' || 
            key.includes('Color') ||
            Array.isArray(obj[key])) {
          const value = obj[key];
          const count = Array.isArray(value) ? value.length : (value ? 1 : 0);
          console.log(`Debug found key "${key}" at ${currentPath}: ${typeof value} (${count} items)`);
          
          // If it's an array, show sample of first item
          if (Array.isArray(value) && value.length > 0) {
            console.log(`Sample of first item:`, JSON.stringify(value[0], null, 2).substring(0, 300));
          }
        }
        
        // Recurse into objects
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.debugSearchForObjects(obj[key], currentPath, depth + 1);
        }
      });
    }
  }

  /**
   * Get nested property from object using dot notation
   */
  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Parse a single color object with CxF/X variant context
   * @param {Object} colorObj - Color object to parse
   * @param {number} index - Object index
   * @param {string} cxfVariant - Detected CxF variant
   */
  parseColorObject(colorObj, index, cxfVariant = 'CxF3') {
    // For CxF/X-4 variants, ONLY process SpotInkCharacterisation objects
    // Regular objects in CxF/X-4 are just referenced data, not colors themselves
    if (cxfVariant.startsWith('CxF/X-4')) {
      const spotInkName = colorObj['@_SpotInkName'] || colorObj.SpotInkName;
      const measurementSet = colorObj['sic:MeasurementSet'] || colorObj.MeasurementSet;
      const isSpotInkCharacterisation = spotInkName || measurementSet;
      
      if (!isSpotInkCharacterisation) {
        console.log(`Skipping regular object in CxF/X-4: ${colorObj['@_Name'] || 'Unknown'}`);
        return null; // Skip regular objects in CxF/X-4
      }
      
      // This is a SpotInkCharacterisation object - use SpotInkName
      const name = spotInkName || `Unnamed Spot Ink ${index + 1}`;
      const objectType = 'SpotInkCharacterisation';
      const id = uuidv4();
      
      console.log('=== PARSING SPOT INK CHARACTERISATION (CxF/X-4) ===');
      console.log('SpotInkName from file:', spotInkName);
      console.log('Name being used:', name);
      
      // Parse MeasurementSet data
      return this.parseSpotInkCharacterisation(colorObj, name, objectType, id, cxfVariant);
    }
    
    // For CxF3 and other formats, continue with original logic
    const spotInkName = colorObj['@_SpotInkName'] || colorObj.SpotInkName;
    const measurementSet = colorObj['sic:MeasurementSet'] || colorObj.MeasurementSet;
    const isSpotInkCharacterisation = spotInkName || measurementSet;
    
    let name, objectType, id;
    
    if (isSpotInkCharacterisation) {
      // For SpotInkCharacterisation: use SpotInkName as the color name
      name = spotInkName || `Unnamed Spot Ink ${index + 1}`;
      objectType = 'SpotInkCharacterisation';
      id = uuidv4();
      
      console.log('=== PARSING SPOT INK CHARACTERISATION ===');
      console.log('SpotInkName:', name);
      
      // Parse MeasurementSet data
      return this.parseSpotInkCharacterisation(colorObj, name, objectType, id, cxfVariant);
    } else {
      // Standard color object parsing
      name = colorObj["@_Name"] || `Unnamed Color ${index + 1}`;
      objectType = colorObj["@_ObjectType"] || 'Standard';
      id = uuidv4();
      
      // Check if this is a spot color via DeviceColorValues
      const deviceColorValues = colorObj['cc:DeviceColorValues'] || colorObj.DeviceColorValues;
      if (deviceColorValues) {
        const colorCustom = deviceColorValues['cc:ColorCustom'] || deviceColorValues.ColorCustom;
        if (colorCustom) {
          const spotColor = colorCustom['cc:SpotColor'] || colorCustom.SpotColor;
          if (spotColor) {
            // This is a spot color - extract the ink name and percentage
            const spotInkName = spotColor['cc:Name'] || spotColor.Name || colorCustom['@_Name'];
            const percentage = parseInt(spotColor['cc:Percentage'] || spotColor.Percentage || 0);
            
            console.log(`Found spot color in DeviceColorValues: ink="${spotInkName}", percentage=${percentage}%`);
            
            // Override name to use the spot ink name + percentage if available
            if (spotInkName) {
              name = percentage > 0 ? `${spotInkName} ${percentage}%` : spotInkName;
            }
            
            // Parse the regular color data but with spot color context
            const colorValues = colorObj?.ColorValues || colorObj?.['cc:ColorValues'];
            if (colorValues) {
              const colorData = this.parseColorData(colorValues, name, objectType, id, cxfVariant);
              if (colorData) {
                // Add spot color metadata
                return {
                  ...colorData,
                  isSpotColor: true,
                  spotInkName,
                  tintPercentage: percentage,
                  isSubstrate: percentage === 0,
                  substrateType: percentage === 0 ? 'white' : null,
                  measurementMode: colorData.printMode ?? (colorData.measurements ? (colorData.measurements[0]?.mode ?? null) : null)
                };
              }
            }
          }
        }
      }
    }
    
    // Enhanced parsing for CxF/X-4 variants
    const spotColorInfo = this.parseSpotColorInfo(colorObj, cxfVariant);
    const tintInfo = this.parseTintInfo(name, cxfVariant);
    
    // Handle both namespaced (cc:) and non-namespaced formats
    const colorValues = colorObj?.ColorValues || colorObj?.['cc:ColorValues'];
    
    if (!colorValues) {
      console.warn(`No ColorValues found for object: ${name}`);
      return this.parseOldFormatColor(colorObj, name, objectType, id);
    }

    return this.parseColorData(colorValues, name, objectType, id, cxfVariant);
  }

  /**
   * Parse color data from ColorValues section
   */
  parseColorData(colorValues, name, objectType, id, cxfVariant) {

    // Try to parse ReflectanceSpectrum first (most detailed)
    const reflectanceData = this.parseReflectanceSpectrum(colorValues);
    if (reflectanceData) {
      // If we have multiple measurements from different print modes, use them all
      const measurements = reflectanceData.measurements || [{
        mode: reflectanceData.printMode ?? null,
        spectral_data: reflectanceData.spectralData,
        lab: reflectanceData.lab
      }];
      
      // Ensure colorHex is calculated if missing and LAB is not the known placeholder
      if (!reflectanceData.colorHex && reflectanceData.lab) {
        const isPlaceholder = reflectanceData.lab && reflectanceData.lab.L === 50 && reflectanceData.lab.a === 0 && reflectanceData.lab.b === 0;
        if (!isPlaceholder) {
          reflectanceData.colorHex = labToHex(reflectanceData.lab.L, reflectanceData.lab.a, reflectanceData.lab.b);
        }
      }
      
    return {
        id,
        name,
        objectType,
        cxfVariant,
        isSpotColor: false,
        spotInkName: null,
        tintPercentage: null,
        measurementMode: reflectanceData.printMode ?? (measurements[0]?.mode ?? null),
        ...reflectanceData,
        measurements
      };
    }

    // Fall back to ColorCIELab
    const labData = this.parseColorCIELab(colorValues);
    if (labData) {
      // Ensure colorHex is calculated if missing
      if (!labData.colorHex && labData.lab) {
        labData.colorHex = labToHex(labData.lab.L, labData.lab.a, labData.lab.b);
      }
      
      return {
        id,
        name,
        objectType,
        cxfVariant,
        measurementMode: labData.printMode ?? null,
        ...labData,
        measurements: [{
          mode: labData.printMode ?? null,
          spectral_data: null,
          lab: labData.lab
        }]
      };
    }

    // Try ColorSRGB
    const srgbData = this.parseColorSRGB(colorValues);
    if (srgbData) {
      // Ensure colorHex is calculated if missing
      if (!srgbData.colorHex && srgbData.lab) {
        srgbData.colorHex = labToHex(srgbData.lab.L, srgbData.lab.a, srgbData.lab.b);
      }
      
      return {
        id,
        name,
        objectType,
        cxfVariant,
        ...srgbData,
        measurements: [{
          mode: objectType.includes('M0') ? 'M0' : null,
          spectral_data: null,
          lab: srgbData.lab
        }]
      };
    }

    console.warn(`Could not parse color data for object: ${name}`);
    return null;
  }

  /**
   * Parse spot color information for CxF/X-4 variants
   */
  parseSpotColorInfo(colorObj, cxfVariant) {
    const info = {
      isSpotColor: false,
      inkType: null,
      substrate: null,
      printingProcess: null
    };

    // Enhanced parsing for CxF/X-4 variants
    if (cxfVariant.startsWith('CxF/X-4')) {
      info.isSpotColor = true;
      
      // Look for spot color specific information
      const deviceCondition = colorObj.DeviceCondition || colorObj['cc:DeviceCondition'];
      if (deviceCondition) {
        info.substrate = deviceCondition['@_Substrate'] || deviceCondition.Substrate;
        info.printingProcess = deviceCondition['@_PrintingProcess'] || deviceCondition.PrintingProcess;
      }
      
      // Parse ink information
      const inkInfo = colorObj.ColorantData || colorObj['cc:ColorantData'];
      if (inkInfo) {
        info.inkType = inkInfo['@_Type'] || inkInfo.Type || 'SpotColor';
      }
    }

    return info;
  }

  /**
   * Parse tint information from color name
   */
  parseTintInfo(name, cxfVariant) {
    const info = {
      tintPercentage: null,
      isSubstrate: false,
      substrateType: null
    };

    // Parse tint percentage from name
    const tintMatch = name.match(/(\d+)%/);
    if (tintMatch) {
      info.tintPercentage = parseInt(tintMatch[1]);
    }

    // Check for substrate/backing indicators
    const lowerName = name.toLowerCase();
    if (lowerName.includes('substrate') || 
        lowerName.includes('paper') || 
        lowerName.includes('backing') ||
        info.tintPercentage === 0) {
      info.isSubstrate = true;
      
      // Determine substrate type
      if (lowerName.includes('black')) {
        info.substrateType = 'black';
      } else if (lowerName.includes('white')) {
        info.substrateType = 'white';
      } else {
        info.substrateType = 'white'; // Default for CxF/X-4a and 4b
      }
    }

    // Set default tint for solid colors if not specified
    if (info.tintPercentage === null && !info.isSubstrate && cxfVariant.startsWith('CxF/X-4')) {
      info.tintPercentage = 100; // Assume solid if no percentage specified
    }

    return info;
  }

  /**
   * Parse ReflectanceSpectrum data - handle multiple spectra for different print modes
   */
  parseReflectanceSpectrum(colorValues) {
    const reflectanceSpectrums = colorValues.ReflectanceSpectrum || colorValues['cc:ReflectanceSpectrum'];
    if (!reflectanceSpectrums) return null;

    // Handle multiple ReflectanceSpectrum entries - parse all of them
    let spectrumArray;
    if (Array.isArray(reflectanceSpectrums)) {
      spectrumArray = reflectanceSpectrums;
    } else {
      spectrumArray = [reflectanceSpectrums];
    }

    console.log(`Found ${spectrumArray.length} ReflectanceSpectrum entries`);

    const measurements = [];
    let primaryResult = null;

    // Map ColorSpecification to print modes based on common CxF conventions
    const colorSpecToPrintMode = {
      'CS0': 'M0',  // Typically M0 (no UV filter)
      'CS1': 'M1',  // Typically M1 (UV included, D65/10°)
      'CS2': 'M2',  // Typically M2 (UV excluded, D65/10°)
      'CS3': 'M3'   // Typically M3 (polarized, if available)
    };

    for (let i = 0; i < spectrumArray.length; i++) {
      const reflectanceSpectrum = spectrumArray[i];
      console.log(`Processing spectrum ${i + 1}:`, JSON.stringify(reflectanceSpectrum, null, 2).substring(0, 300));

      // Get ColorSpecification ID and look up the actual ColorSpecification
      const colorSpecId = reflectanceSpectrum["@_ColorSpecification"];
      const printMode = this.getPrintModeFromColorSpecification(colorSpecId);
      
      console.log(`ColorSpecification ID: ${colorSpecId} -> PrintMode: ${printMode}`);

      // Handle direct text content or #text property
      const spectralString = typeof reflectanceSpectrum === 'string' ? reflectanceSpectrum : 
                            (reflectanceSpectrum["#text"] || reflectanceSpectrum);
      
      if (!spectralString || typeof spectralString !== 'string') continue;

      const spectralValues = spectralString.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
      
      if (spectralValues.length === 0) continue;

      // Get StartWL and Increment attributes
      const startWL = reflectanceSpectrum["@_StartWL"] || 380;
      const increment = reflectanceSpectrum["@_Increment"] || 10;
      
      // Convert spectral values to wavelength-indexed object
      const spectralData = {};
      spectralValues.forEach((value, j) => {
        const wavelength = startWL + (j * increment);
        spectralData[wavelength] = value;
      });

      // Don't create placeholder Lab values for spectral data
      // Let the display logic handle spectral computation
      
      console.log(`Parsed spectrum ${i + 1}: ${spectralValues.length} values, startWL: ${startWL}, increment: ${increment}, printMode: ${printMode}`);
      
      // Add measurement for this print mode - allow null modes
      const finalMode = printMode ?? null;
      console.log(`Final mode for spectrum ${i + 1}: ${finalMode} (was: ${printMode})`);
      
      measurements.push({
        mode: finalMode,
        spectral_data: spectralData
      });

      // Use the first measurement as primary result
      if (!primaryResult) {
        // Store only raw data - let display components calculate hex dynamically
        primaryResult = {
          colorHex: null, // Don't compute hex during import
          lab: null, // Don't compute Lab during import (unless present in file)
          spectralData,
          printMode
        };
      }
    }

    if (primaryResult && measurements.length > 0) {
      primaryResult.measurements = measurements;
      console.log(`Returning ${measurements.length} measurements with modes:`, measurements.map(m => m.mode));
      return primaryResult;
    }

    return null;
  }

  /**
   * Parse ColorCIELab data
   */
  parseColorCIELab(colorValues) {
    const colorCIELabs = colorValues.ColorCIELab || colorValues['cc:ColorCIELab'];
    if (!colorCIELabs) return null;

    // Handle multiple ColorCIELab entries - use the first one or prefer CS3
    let colorCIELab;
    if (Array.isArray(colorCIELabs)) {
      colorCIELab = colorCIELabs.find(lab => lab["@_ColorSpecification"] === "CS3") || colorCIELabs[0];
    } else {
      colorCIELab = colorCIELabs;
    }

    // Extract print mode from deviceillumination
    const printMode = this.extractPrintMode(colorCIELab);

    // Handle nested L, A, B elements or direct text content
    const L = this.parseColorValue(colorCIELab.L);
    const A = this.parseColorValue(colorCIELab.A);
    const B = this.parseColorValue(colorCIELab.B);
    
    if (isNaN(L) || isNaN(A) || isNaN(B)) return null;

    // Calculate hex from LAB values
    const colorHex = labToHex(L, A, B);
    const lab = { L, a: A, b: B };
    
    console.log(`Parsed ColorCIELab: L:${L} a:${A} b:${B}, printMode: ${printMode}`);
    
    return {
      colorHex,
      lab,
      spectralData: null,
      labDisplay: `L:${L.toFixed(1)} a:${A.toFixed(1)} b:${B.toFixed(1)}`,
      printMode
    };
  }

  /**
   * Parse ColorSRGB data
   */
  parseColorSRGB(colorValues) {
    const colorSRGBs = colorValues.ColorSRGB || colorValues['cc:ColorSRGB'];
    if (!colorSRGBs) return null;

    // Handle multiple ColorSRGB entries - use the first one
    let colorSRGB;
    if (Array.isArray(colorSRGBs)) {
      colorSRGB = colorSRGBs[0];
    } else {
      colorSRGB = colorSRGBs;
    }

    // Handle nested R, G, B elements
    const R = this.parseColorValue(colorSRGB.R);
    const G = this.parseColorValue(colorSRGB.G);
    const B = this.parseColorValue(colorSRGB.B);
    
    if (isNaN(R) || isNaN(G) || isNaN(B)) return null;

    const colorHex = `#${Math.round(R).toString(16).padStart(2, '0')}${Math.round(G).toString(16).padStart(2, '0')}${Math.round(B).toString(16).padStart(2, '0')}`;
    
    console.log(`Parsed ColorSRGB: R:${R} G:${G} B:${B}`);
    
    return {
      colorHex,
      lab: null, // Would need conversion from RGB to LAB
      spectralData: null,
      labDisplay: `RGB(${Math.round(R)}, ${Math.round(G)}, ${Math.round(B)})`
    };
  }

  /**
   * Parse HTML color from DeviceColorValues
   */
  parseHTMLColor(colorObj) {
    const deviceColorValues = colorObj.DeviceColorValues || colorObj['cc:DeviceColorValues'];
    if (!deviceColorValues) return null;

    const colorHTML = deviceColorValues.ColorHTML || deviceColorValues['cc:ColorHTML'];
    if (!colorHTML) return null;

    const html = colorHTML["@_HTML"];
    if (html) {
      return `#${html}`;
    }

    return null;
  }

  /**
   * Helper to parse color values (handles nested elements or direct text)
   */
  parseColorValue(value) {
    if (typeof value === 'string' || typeof value === 'number') {
      return parseFloat(value);
    }
    if (value && value["#text"]) {
      return parseFloat(value["#text"]);
    }
    return parseFloat(value);
  }

  /**
   * Get print mode from ColorSpecification using the ID lookup
   * Enhanced with comprehensive fallback logic to prevent null modes
   */
  getPrintModeFromColorSpecification(colorSpecId) {
    if (!colorSpecId) {
      console.log(`No colorSpecId provided, using smart fallback`);
      return this.getSmartFallbackMode();
    }

    // Try fast path via lookup map
    const colorSpecFromMap = this.colorSpecificationMap ? this.colorSpecificationMap[colorSpecId] : null;
    if (colorSpecFromMap) {
      console.log(`Found ColorSpecification for ID ${colorSpecId} in map`);
      const mode = this.extractPrintMode(colorSpecFromMap);
      if (mode) return mode;
    }

    // Fallback: search full parsed object by ID
    console.log(`ColorSpecification with ID ${colorSpecId} not in map, falling back to search`);
    const colorSpec = this.findColorSpecificationById(colorSpecId);
    if (colorSpec) {
      const mode = this.extractPrintMode(colorSpec);
      if (mode) return mode;
    }

    // Try to infer from ColorSpecification ID patterns
    const inferredMode = this.inferModeFromColorSpecId(colorSpecId);
    if (inferredMode) {
      console.log(`Inferred mode ${inferredMode} from ColorSpecification ID pattern: ${colorSpecId}`);
      return inferredMode;
    }

    console.log(`No measurement mode detected for ColorSpecification ID ${colorSpecId}, returning null`);
    return null; // Allow null modes for unspecified measurement conditions
  }

  /**
   * Smart fallback mode selection to prevent null modes
   */
  getSmartFallbackMode() {
    // Check if we have any successfully parsed modes from other spectra
    const existingModes = this.getExistingModesFromFile();
    
    if (existingModes.length > 0) {
      console.log(`Using existing mode from file: ${existingModes[0]}`);
      return existingModes[0];
    }
    
    // Return null instead of defaulting to M1 - let spectral data exist without a mode
    console.log(`No existing modes found, returning null (no mode)`);
    return null;
  }

  /**
   * Get modes that have been successfully parsed from other spectra in the same file
   */
  getExistingModesFromFile() {
    // This could be enhanced to track modes as they're parsed
    // For now, return empty array to use the default fallback
    return [];
  }

  /**
   * Try to infer print mode from ColorSpecification ID patterns - ENHANCED for CS_1-CS_4 pattern
   */
  inferModeFromColorSpecId(colorSpecId) {
    if (!colorSpecId || typeof colorSpecId !== 'string') return null;
    
    const id = colorSpecId.toUpperCase();
    
    // Common patterns in CxF files - only return if explicitly found
    if (id.includes('M0') || id.includes('UV_IN') || id.includes('UVIN')) return 'M0';
    if (id.includes('M1') || id.includes('UV_EX') || id.includes('UVEX')) return 'M1';
    if (id.includes('M2') || id.includes('UV_OUT') || id.includes('UVOUT')) return 'M2';
    if (id.includes('M3') || id.includes('POL') || id.includes('POLARIZED')) return 'M3';
    
    // ENHANCED: Check for CS_X patterns (very common in CxF/X-4 files like the user's sample)
    if (id === 'CS_1') return 'M0'; // CS_1 typically maps to M0_Incandescent
    if (id === 'CS_2') return 'M1'; // CS_2 typically maps to M1_Daylight  
    if (id === 'CS_3') return 'M2'; // CS_3 typically maps to M2_UVExcluded
    if (id === 'CS_4') return 'M3'; // CS_4 typically maps to M3_Polarized
    
    // Check for CS patterns (common in some CxF variants)
    if (id === 'CS0' || id === 'CS000' || id === 'CS001') return 'M0';
    if (id === 'CS1' || id === 'CS001' || id === 'CS002') return 'M1';
    if (id === 'CS2' || id === 'CS002' || id === 'CS003') return 'M2';
    if (id === 'CS3' || id === 'CS003' || id === 'CS004') return 'M3';
    
    // Check for zero-padded CS patterns specifically for large CxF files
    if (id.match(/^CS00[1-4]$/)) {
      const num = parseInt(id.replace('CS00', ''));
      return `M${num - 1}`; // CS001 -> M0, CS002 -> M1, etc.
    }
    
    return null; // Return null if no pattern is found
  }



  /**
   * Extract print mode from deviceillumination field
   */
  extractPrintMode(colorSpecObject) {
    if (!colorSpecObject) {
      console.log('No colorSpecObject provided for print mode extraction');
      return null;
    }
    
    console.log('=== PRINT MODE EXTRACTION DEBUG ===');
    console.log('All keys in colorSpecObject:', Object.keys(colorSpecObject));
    console.log('ColorSpecObject full structure:', JSON.stringify(colorSpecObject, null, 2));
    
    // Look for deviceillumination in various possible locations and formats
    // First check top level attributes (including namespaced variants)
    const deviceIllumination = colorSpecObject["@_deviceillumination"] || 
                              colorSpecObject["@_DeviceIllumination"] ||
                              colorSpecObject["@_deviceIllumination"] ||
                              colorSpecObject.deviceillumination ||
                              colorSpecObject.DeviceIllumination ||
                              colorSpecObject.deviceIllumination ||
                              colorSpecObject["@_DeviceCondition"] ||
                              colorSpecObject["@_devicecondition"] ||
                              colorSpecObject.DeviceCondition ||
                              colorSpecObject.devicecondition ||
                              // Check for CxF3 namespaced attributes
                              colorSpecObject["@_sic:DeviceIllumination"] ||
                              colorSpecObject["@_sic:deviceIllumination"] ||
                              colorSpecObject["sic:DeviceIllumination"] ||
                              colorSpecObject["sic:deviceIllumination"] ||
                              colorSpecObject["@_cxf:DeviceIllumination"] ||
                              colorSpecObject["@_cxf:deviceIllumination"] ||
                              colorSpecObject["cxf:DeviceIllumination"] ||
                              colorSpecObject["cxf:deviceIllumination"];

    // Also check nested structures like MeasurementSpec
    const measurementSpec = colorSpecObject.MeasurementSpec || 
                           colorSpecObject["sic:MeasurementSpec"] || 
                           colorSpecObject["cxf:MeasurementSpec"] ||
                           colorSpecObject["cc:MeasurementSpec"];
    let nestedDeviceIllumination = null;
    
    if (measurementSpec) {
      // First check direct properties on MeasurementSpec
      nestedDeviceIllumination = measurementSpec["@_deviceillumination"] ||
                                measurementSpec["@_DeviceIllumination"] ||
                                measurementSpec.deviceillumination ||
                                measurementSpec.DeviceIllumination ||
                                measurementSpec.DeviceCondition ||
                                measurementSpec.devicecondition ||
                                // Namespaced variants in nested structures
                                measurementSpec["@_sic:DeviceIllumination"] ||
                                measurementSpec["@_sic:deviceIllumination"] ||
                                measurementSpec["sic:DeviceIllumination"] ||
                                measurementSpec["sic:deviceIllumination"] ||
                                measurementSpec["@_cxf:DeviceIllumination"] ||
                                measurementSpec["@_cxf:deviceIllumination"] ||
                                measurementSpec["cxf:DeviceIllumination"] ||
                                measurementSpec["cxf:deviceIllumination"];
      
      // If not found, check for nested Device.DeviceIllumination
      if (!nestedDeviceIllumination) {
        const device = measurementSpec.Device || 
                      measurementSpec["sic:Device"] || 
                      measurementSpec["cxf:Device"] ||
                      measurementSpec["cc:Device"];
        if (device) {
          nestedDeviceIllumination = device.DeviceIllumination ||
                                   device["@_DeviceIllumination"] ||
                                   device.deviceillumination ||
                                   device["@_deviceillumination"] ||
                                   device["sic:DeviceIllumination"] ||
                                   device["cxf:DeviceIllumination"] ||
                                   device["cc:DeviceIllumination"] ||
                                   device["@_sic:DeviceIllumination"] ||
                                   device["@_cxf:DeviceIllumination"] ||
                                   device["@_cc:DeviceIllumination"];
        }
      }
    }
    
    const finalDeviceIllumination = deviceIllumination || nestedDeviceIllumination;
    
    console.log('Found deviceIllumination (top level):', deviceIllumination);
    console.log('Found deviceIllumination (nested):', nestedDeviceIllumination);
    console.log('Final deviceIllumination value:', finalDeviceIllumination, 'type:', typeof finalDeviceIllumination);
    
    if (!finalDeviceIllumination) {
      // Try to search recursively through the entire object for any field containing illumination or device
      console.log('Searching recursively for deviceillumination-like fields...');
      const foundField = this.searchForDeviceIllumination(colorSpecObject);
      if (foundField) {
        console.log('Found deviceillumination field recursively:', foundField);
        return this.extractModeFromString(foundField);
      }
      
      console.log('No deviceIllumination found anywhere, returning null');
      return null;
    }
    
    return this.extractModeFromString(finalDeviceIllumination);
  }

  /**
   * Recursively search for deviceillumination-like fields
   */
  searchForDeviceIllumination(obj, path = '', depth = 0) {
    if (depth > 10 || !obj || typeof obj !== 'object') return null;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if this key or value might contain deviceillumination info
      if (typeof key === 'string' && (
        key.toLowerCase().includes('device') || 
        key.toLowerCase().includes('illumination') ||
        key.toLowerCase().includes('condition') ||
        // Handle namespaced keys
        key.includes(':device') ||
        key.includes(':illumination') ||
        key.includes(':condition')
      )) {
        console.log(`Found potential field at ${currentPath}:`, key, '=', value);
        if (typeof value === 'string' && this.containsPrintMode(value)) {
          return value;
        }
      }
      
      // If value is string and contains print mode indicators
      if (typeof value === 'string' && this.containsPrintMode(value)) {
        console.log(`Found print mode in value at ${currentPath}:`, value);
        return value;
      }
      
      // Check nested object values like {"#text": "M0"}
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Check for #text property which often contains the actual value
        if (value["#text"] && typeof value["#text"] === 'string' && this.containsPrintMode(value["#text"])) {
          console.log(`Found print mode in nested #text at ${currentPath}:`, value["#text"]);
          return value["#text"];
        }
        
        // Also check other potential text-containing properties
        for (const [textKey, textValue] of Object.entries(value)) {
          if (typeof textValue === 'string' && this.containsPrintMode(textValue)) {
            console.log(`Found print mode in nested property ${textKey} at ${currentPath}:`, textValue);
            return textValue;
          }
        }
        
        // Recurse into objects
        const found = this.searchForDeviceIllumination(value, currentPath, depth + 1);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * Check if a string contains print mode indicators
   */
  containsPrintMode(str) {
    if (typeof str !== 'string') return false;
    const upperStr = str.toUpperCase();
    return ['M0', 'M1', 'M2', 'M3'].some(mode => upperStr.includes(mode));
  }

  /**
   * Extract print mode from a string value
   */
  extractModeFromString(deviceIlluminationStr) {
    if (!deviceIlluminationStr) {
      console.log('No deviceIlluminationStr provided, returning null');
      return null;
    }
    
    const upperStr = String(deviceIlluminationStr).toUpperCase();
    console.log('=== EXTRACTING MODE FROM STRING ===');
    console.log('Original deviceIlluminationStr:', deviceIlluminationStr);
    console.log('Uppercase string for parsing:', upperStr);
    
    // Check if the deviceillumination string contains any of the print modes
    const printModes = ['M0', 'M1', 'M2', 'M3'];
    for (const mode of printModes) {
      if (upperStr.includes(mode)) {
        console.log(`✓ Found print mode ${mode} in string: ${upperStr}`);
        return mode;
      }
    }
    
    // Enhanced: Check for numeric indicators (0, 1, 2, 3 → M0, M1, M2, M3)
    const numericMatch = upperStr.match(/\b([0-3])\b/);
    if (numericMatch) {
      const mode = `M${numericMatch[1]}`;
      console.log(`✓ Found numeric mode indicator ${numericMatch[1]}, converting to ${mode}`);
      return mode;
    }
    
    // Enhanced: Check for common illumination keywords and map to modes
    const illuminationMappings = {
      'D50': 'M1',
      'D65': 'M1', 
      'A': 'M1',
      'UV_INCLUDED': 'M1',
      'UV_EXCLUDED': 'M2',
      'POLARIZED': 'M3',
      'POLARISED': 'M3',
      'NO_FILTER': 'M0',
      'FILTER': 'M2'
    };
    
    for (const [keyword, mode] of Object.entries(illuminationMappings)) {
      if (upperStr.includes(keyword)) {
        console.log(`✓ Found illumination keyword ${keyword}, mapping to mode ${mode}`);
        return mode;
      }
    }
    
    console.log(`✗ No print mode found in string: ${upperStr}, returning null`);
    return null;
  }

  /**
   * Parse SpotInkCharacterisation objects from CustomResources
   */
  parseSpotInkCharacterisation(colorObj, name, objectType, id, cxfVariant) {
    console.log('=== PARSING SPOT INK CHARACTERISATION ===');
    console.log('SpotInkName:', name);
    
    // Get MeasurementSet array - handle namespaced structure
    let measurementSets = colorObj['sic:MeasurementSet'] || colorObj.MeasurementSet;
    
    if (!measurementSets) {
      console.warn('No MeasurementSet found in SpotInkCharacterisation');
      return null;
    }
    
    // Ensure it's an array
    if (!Array.isArray(measurementSets)) {
      measurementSets = [measurementSets];
    }

    console.log(`Found ${measurementSets.length} MeasurementSet(s)`);
    
    // Group measurements by their actual background name
    const measurementsByBackground = {};
    const availableBackgrounds = new Set();
    
    measurementSets.forEach((measurementSet, index) => {
      console.log(`Processing MeasurementSet ${index + 1}:`, JSON.stringify(measurementSet, null, 2).substring(0, 500));
      
      // Extract background from multiple possible locations
      const background = measurementSet['@_Background'] || 
                        measurementSet.Background?.['#text'] || 
                        measurementSet.Background || 
                        'Substrate';
      debug.info('[CxF Backgrounds] Background extracted from MeasurementSet', index + 1, {
        rawBackground: measurementSet['@_Background'],
        backgroundField: measurementSet.Background,
        finalBackground: background
      });
      availableBackgrounds.add(background);
      
      // Initialize array for this background if needed
      if (!measurementsByBackground[background]) {
        measurementsByBackground[background] = [];
      }
      
      // Get Measurement entries - handle namespaced structure
      let measurements = measurementSet['sic:Measurement'] || measurementSet.Measurement;
      if (!measurements) {
        console.warn(`No Measurement entries found in MeasurementSet ${index + 1}`);
        return;
      }
      
      // Ensure it's an array
      if (!Array.isArray(measurements)) {
        measurements = [measurements];
      }
      
      console.log(`Found ${measurements.length} Measurement entries in MeasurementSet with Background: ${background}`);
      
      measurements.forEach(measurement => {
        const tintLevel = parseInt(measurement['@_TintLevel'] || measurement.TintLevel) || 0;
        const objectRef = measurement['@_ObjectRef'] || measurement.ObjectRef;
        const reflectanceSpectrumNameRef = measurement['@_ReflectanceSpectrumNameRef'] || measurement.ReflectanceSpectrumNameRef;
        
        console.log(`  Measurement: TintLevel=${tintLevel}, ObjectRef=${objectRef}, ReflectanceSpectrumNameRef=${reflectanceSpectrumNameRef}`);
        
        measurementsByBackground[background].push({
          background,
          backgroundName: background,
          tintLevel,
          objectRef,
          reflectanceSpectrumNameRef,
          measurementSet
        });
      });
    });
    
    console.log(`Measurements grouped by background:`, 
      Object.entries(measurementsByBackground).map(([bg, items]) => `${bg}: ${items.length}`).join(', ')
    );
    
    // Build tint collections for each background
    const tintsByBackground = {};
    for (const [backgroundName, measurements] of Object.entries(measurementsByBackground)) {
      tintsByBackground[backgroundName] = this.buildTintCollection(measurements, name);
      console.log(`Built ${tintsByBackground[backgroundName].length} tints for background: ${backgroundName}`);
    }
    
    // Maintain backward compatibility
    const substrateTints = tintsByBackground['Substrate'] || [];
    
    // Find primary color (100% tint on substrate)
    const primaryTint = substrateTints.find(tint => tint.tintPercentage === 100) || 
                       substrateTints.find(tint => tint.tintPercentage > 0) ||
                       substrateTints[0];
    
    // NEW: Get measurement mode from primary tint's measurements (now we have all modes)
    let measurementMode = null;
    if (primaryTint && primaryTint.measurements && primaryTint.measurements.length > 0) {
      // Prefer M1, then M0, then any available mode
      const modePriority = ['M1', 'M0', 'M2', 'M3'];
      for (const preferredMode of modePriority) {
        const measurement = primaryTint.measurements.find(m => m.mode === preferredMode);
        if (measurement) {
          measurementMode = preferredMode;
          console.log(`Selected measurement mode ${measurementMode} for SpotInkCharacterisation`);
          break;
        }
      }
      
      // Fallback to first available mode
      if (!measurementMode && primaryTint.measurements.length > 0) {
        measurementMode = primaryTint.measurements[0].mode;
        console.log(`Using fallback measurement mode ${measurementMode} for SpotInkCharacterisation`);
      }
    }
    console.log(`Final measurement mode for SpotInkCharacterisation: ${measurementMode}`);
    
    // Return structured data for CxF/X-4 ink characterisation
    return {
      id,
      name,
      objectType,
      cxfVariant,
      isSpotColor: true,
      spotInkName: name,
      tintPercentage: primaryTint ? primaryTint.tintPercentage : null,
      measurementMode,
      colorHex: primaryTint ? primaryTint.colorHex : '#f3f4f6',
      lab: primaryTint ? primaryTint.lab : null,
      labDisplay: primaryTint ? primaryTint.labDisplay : 'No data',
      spectralData: primaryTint ? primaryTint.spectralData : null,
      
      // N-background support
      tintsByBackground,
      availableBackgrounds: Array.from(availableBackgrounds),
      
      // Backward compatibility
      tints: substrateTints,
      substrateTints,
      
      // Include all measurements from primary tint for multi-mode support
      measurements: primaryTint && primaryTint.measurements ? primaryTint.measurements : [],
      
      // Enhanced measurement metadata
      spectralDataByMode: primaryTint && primaryTint.measurements ? 
        primaryTint.measurements.reduce((acc, m) => {
          acc[m.mode] = m.spectral_data;
          return acc;
        }, {}) : {},
      measurement_settings: {
        available_modes: primaryTint && primaryTint.measurements ? 
          primaryTint.measurements.map(m => m.mode) : [],
        available_backgrounds: Array.from(availableBackgrounds),
        start_wl: primaryTint && primaryTint.measurements && primaryTint.measurements[0] ? 
          (primaryTint.measurements[0].start_wl || 380) : 380,
        increment: primaryTint && primaryTint.measurements && primaryTint.measurements[0] ? 
          (primaryTint.measurements[0].increment || 10) : 10
      }
    };
  }

  /**
   * Build tint collection from measurement data - Now extracts all measurement modes
   */
  buildTintCollection(measurements, inkName) {
    const tints = [];
    
    measurements.forEach(measurement => {
      const { tintLevel, objectRef, measurementSet } = measurement;
      
      console.log(`=== BUILDING TINT: ${inkName} ${tintLevel}% (ObjectRef: ${objectRef}) ===`);
      
      // NEW: Extract all measurements (M0, M1, M2, M3) from the ObjectRef
      const allMeasurements = this.extractAllMeasurementsFromObjectRef(objectRef);
      console.log(`Found ${allMeasurements.length} measurements for ${objectRef}:`, allMeasurements.map(m => m.mode));
      
      // Select primary measurement (prefer M1 > M0 > M2 > M3)
      let primaryMeasurement = null;
      const modePriority = ['M1', 'M0', 'M2', 'M3'];
      for (const preferredMode of modePriority) {
        primaryMeasurement = allMeasurements.find(m => m.mode === preferredMode);
        if (primaryMeasurement) {
          console.log(`Selected primary mode ${preferredMode} for ${objectRef}`);
          break;
        }
      }
      
      // Fallback to first available measurement if no preferred mode found
      if (!primaryMeasurement && allMeasurements.length > 0) {
        primaryMeasurement = allMeasurements[0];
        console.log(`Using fallback mode ${primaryMeasurement.mode} for ${objectRef}`);
      }
      
      // Calculate display values from primary measurement
      let colorHex = null;
      let labDisplay = 'No data';
      let lab = null;
      let spectralData = null;
      
      if (primaryMeasurement) {
        lab = primaryMeasurement.lab;
        spectralData = primaryMeasurement.spectral_data;
        
        // Compute LAB from spectral data if needed and ASTM tables are available
        if (!lab && spectralData && this.parsingOptions?.astmTables?.length > 0) {
          try {
            const orgDefaults = this.parsingOptions.orgDefaults || {};
            const illuminant = orgDefaults.default_illuminant || 'D50';
            const observer = orgDefaults.default_observer || '2';
            const tableNumber = orgDefaults.default_astm_table || '5';
            
            // Find matching ASTM table
            const weightingTable = this.parsingOptions.astmTables.find(table => 
              table.illuminant_name === illuminant && 
              table.observer === observer && 
              table.table_number.toString() === tableNumber.toString()
            );
            
            if (weightingTable) {
              lab = spectralToLabASTME308(spectralData, weightingTable);
              console.log(`[CXF-TINT] Computed LAB from spectral for ${inkName} ${tintLevel}%: L=${lab?.L.toFixed(1)} a=${lab?.a.toFixed(1)} b=${lab?.b.toFixed(1)}`);
            }
          } catch (error) {
            console.warn(`[CXF-TINT] Failed to compute LAB from spectral for ${inkName} ${tintLevel}%:`, error);
          }
        }
        
        // Generate hex color from LAB (avoid placeholder Lab values)
        const isPlaceholder = lab && lab.L === 50 && lab.a === 0 && lab.b === 0;
        if (lab && !isPlaceholder) {
          try {
            const orgDefaults = this.parsingOptions.orgDefaults || {};
            const illuminant = orgDefaults.default_illuminant || 'D50';
            colorHex = labToHex(lab.L, lab.a, lab.b, illuminant);
          } catch (error) {
            console.warn(`[CXF-TINT] Failed to convert LAB to hex for ${inkName} ${tintLevel}%:`, error);
          }
        }
        
        // Set display text
        if (lab && !isPlaceholder) {
          labDisplay = `L:${lab.L.toFixed(1)} a:${lab.a.toFixed(1)} b:${lab.b.toFixed(1)}`;
        } else if (spectralData) {
          const spectralCount = Object.keys(spectralData).length;
          labDisplay = `${spectralCount} spectral points`;
        }
      }
      
      tints.push({
        id: uuidv4(),
        name: `${inkName} ${tintLevel}%`,
        tintPercentage: tintLevel,
        objectRef,
        colorHex,
        lab,
        spectralData,
        labDisplay,
        measurements: allMeasurements, // Use all measurements, not just primary
        backgroundName: measurement.backgroundName || measurement.background || 'Substrate'
      });
    });
    
    // Sort by tint percentage
    tints.sort((a, b) => a.tintPercentage - b.tintPercentage);
    
    debug.info('[CxF Backgrounds] Built tints for', inkName, {
      tintCount: tints.length,
      tintBackgrounds: tints.map(t => ({ tint: t.tintPercentage, backgroundName: t.backgroundName })),
      uniqueBackgrounds: [...new Set(tints.map(t => t.backgroundName))].filter(Boolean)
    });
    return tints;
  }

   /**
    * NEW: Extract all measurements (M0, M1, M2, M3) from ObjectRef
    */
   extractAllMeasurementsFromObjectRef(objectRef) {
     if (!objectRef || !this.fullParsedObject) {
       console.log(`No objectRef (${objectRef}) or fullParsedObject available`);
       return [];
     }

     console.log(`=== EXTRACTING ALL MEASUREMENTS FROM OBJECTREF: ${objectRef} ===`);
     
     // Find the referenced object
     const targetObject = this.findObjectById(objectRef);
     if (!targetObject) {
       console.warn(`Object with ID ${objectRef} not found`);
       return [];
     }

     const colorValues = targetObject.ColorValues || targetObject['cc:ColorValues'];
     if (!colorValues) {
       console.warn(`No ColorValues found in object ${objectRef}`);
       return [];
     }

     const reflectanceSpectrums = colorValues.ReflectanceSpectrum || colorValues['cc:ReflectanceSpectrum'];
     if (!reflectanceSpectrums) {
       console.warn(`No ReflectanceSpectrum found in object ${objectRef}`);
       return [];
     }

     // Ensure we have an array of spectra
     const spectrumArray = Array.isArray(reflectanceSpectrums) ? reflectanceSpectrums : [reflectanceSpectrums];
     console.log(`Found ${spectrumArray.length} ReflectanceSpectrum entries in object ${objectRef}`);

     const measurements = [];

     spectrumArray.forEach((spectrum, index) => {
       console.log(`Processing spectrum ${index + 1} for object ${objectRef}`);
       
       // Extract ColorSpecification reference
       const colorSpecId = spectrum["@_ColorSpecification"];
       console.log(`  ColorSpecification ID: ${colorSpecId}`);
       
       // Resolve ColorSpecification ID to measurement mode
       let mode = null;
       if (colorSpecId && this.colorSpecificationMap && this.colorSpecificationMap[colorSpecId]) {
         const colorSpec = this.colorSpecificationMap[colorSpecId];
         mode = this.extractPrintMode(colorSpec);
         console.log(`  Resolved mode from ColorSpecification: ${mode}`);
       }
       
       // Fallback to inferring mode from ColorSpecification ID pattern
       if (!mode) {
         mode = this.inferModeFromColorSpecId(colorSpecId);
         console.log(`  Inferred mode from ID pattern: ${mode}`);
       }
       
       // Extract spectral data
       const spectralString = typeof spectrum === 'string' ? spectrum : (spectrum["#text"] || spectrum);
       if (!spectralString || typeof spectralString !== 'string') {
         console.warn(`  No spectral data found in spectrum ${index + 1}`);
         return;
       }

       const spectralValues = spectralString.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
       if (spectralValues.length === 0) {
         console.warn(`  Invalid spectral data in spectrum ${index + 1}`);
         return;
       }

       // Get StartWL and Increment attributes
       const startWL = spectrum["@_StartWL"] || 380;
       const increment = spectrum["@_Increment"] || 10;
       
       // Convert spectral values to wavelength-indexed object
       const spectralData = {};
       spectralValues.forEach((value, j) => {
         const wavelength = startWL + (j * increment);
         spectralData[wavelength] = value;
       });

        // Skip immediate Lab calculation - will be done on-demand in UI with proper ASTM cache
        let lab = null;
        
        console.log(`  Successfully processed spectrum ${index + 1}: ${spectralValues.length} values, mode: ${mode}`);
        
        measurements.push({
          mode: mode ?? null, // Allow null mode for unspecified measurement conditions
          spectral_data: spectralData,
          lab: lab, // Include computed Lab values
          start_wl: startWL,
          increment: increment
        });
     });

     console.log(`Extracted ${measurements.length} measurements from object ${objectRef}`);
    return measurements;
  }

  /**
   * DEPRECATED: No longer used for immediate Lab calculations
   * Lab calculations now done on-demand in UI with proper ASTM cache validation
   */
  getDefaultAstmTable() {
    // DEPRECATED: No longer used for immediate Lab calculations
    console.warn('getDefaultAstmTable() is deprecated - Lab calculations now done on-demand in UI');
    return null;
  }
  /**
   * Apply default measurement mode to colors that don't have one specified
   */
  applyDefaultMeasurementMode(colors, defaultMode) {
    if (!defaultMode || !colors) return colors;
    
    return colors.map(color => {
      if (!color.measurements || color.measurements.length === 0) {
        return color;
      }
      
      const updatedMeasurements = color.measurements.map(measurement => {
        if (!measurement.mode || measurement.mode === null) {
          return { ...measurement, mode: defaultMode };
        }
        return measurement;
      });
      
      return { ...color, measurements: updatedMeasurements };
    });
  }

  /**
   * Legacy helper for backwards compatibility with old CxF/3 format
   */
  parseLegacyCxF3ColorObject(colorObject, objectType, id) {
    const { ObjectId, Name, Color } = colorObject;
    
    if (!Color) {
      console.warn(`Color object ${ObjectId || id} has no Color data`);
      return null;
    }

    const name = Name ? (Name["#text"] || Name) : (ObjectId || `Color ${id}`);
    const lab = Color.Lab || Color.LAB;
    
    if (!lab) {
      console.warn(`Color object ${name} has no Lab color data`);
      return null;
    }

    // Parse spectral measurements if available
    const measurements = [];
    if (Color.ReflectanceSpectrum) {
      const spectrum = Color.ReflectanceSpectrum;
      const spectralString = spectrum["#text"] || spectrum;
      
      if (spectralString && typeof spectralString === 'string') {
        const spectralValues = spectralString.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
        
        if (spectralValues.length > 0) {
          const startWL = spectrum["@_StartWL"] || 380;
          const increment = spectrum["@_Increment"] || 10;
          
          const spectralData = {};
          spectralValues.forEach((value, i) => {
            const wavelength = startWL + (i * increment);
            spectralData[wavelength] = value;
          });
          
          measurements.push({
            mode: null, // Legacy format doesn't specify measurement conditions
            spectral_data: spectralData,
            start_wl: startWL,
            increment: increment
          });
        }
      }
    }

    // Convert Lab to hex for display
    const L = parseFloat(lab["@_L"]);
    const a = parseFloat(lab["@_a"]);
    const b = parseFloat(lab["@_b"]);
    
    // Simple Lab to RGB conversion for hex display
    let hex = "000000";
    try {
      // This is a simplified conversion - in practice you'd want proper Lab->XYZ->RGB
      const r = Math.max(0, Math.min(255, Math.round((L + a * 1.5) * 2.55)));
      const g = Math.max(0, Math.min(255, Math.round((L - a * 0.5 - b * 0.3) * 2.55)));
      const blue = Math.max(0, Math.min(255, Math.round((L - b * 2) * 2.55)));
      
      hex = ((r << 16) | (g << 8) | blue).toString(16).padStart(6, '0');
    } catch (error) {
      console.warn(`Failed to convert Lab to hex for ${name}:`, error);
    }

    return {
      id,
      name,
      objectType,
      cxfVariant: 'CxF3', // Old format
      colorHex: `#${hex}`,
      lab: { L: lab["@_L"], a: lab["@_a"], b: lab["@_b"] },
      labDisplay: `L:${lab["@_L"].toFixed(1)} a:${lab["@_a"].toFixed(1)} b:${lab["@_b"].toFixed(1)}`,
      measurements,
    };
  }

  /**
   * Find an object by ID in the parsed CxF structure
   * @param {string} targetId - The ID to search for
   * @returns {Object|null} - The found object or null
   */
  findObjectById(targetId) {
    if (!this.fullParsedObject || !targetId) return null;
    
    console.log('Searching for object with ID:', targetId);
    
    // Search in ObjectCollection first
    const possiblePaths = [
      'cc:CxF.cc:Resources.cc:ObjectCollection.cc:Object',
      'CxF.Resources.ObjectCollection.Object',
      'Resources.ObjectCollection.Object',
      'ObjectCollection.Object',
      'cc:CxF.cc:Object',
      'CxF.Object',
      'Object'
    ];
    
    for (const path of possiblePaths) {
      const objects = this.getNestedProperty(this.fullParsedObject, path);
      if (objects) {
        const objectArray = Array.isArray(objects) ? objects : [objects];
        const found = objectArray.find(obj => 
          obj['@_Id'] === targetId || 
          obj['@_ObjectId'] === targetId ||
          obj.Id === targetId ||
          obj.ObjectId === targetId
        );
        if (found) {
          console.log('Found object by ID at path:', path);
          return found;
        }
      }
    }
    
    // Fallback: deep search through the entire structure
    console.log('Performing deep search for object ID:', targetId);
    return this.deepSearchForObjectById(this.fullParsedObject, targetId);
  }

  /**
   * Find a ColorSpecification by ID in the parsed CxF structure
   * @param {string} targetId - The ID to search for
   * @returns {Object|null} - The found ColorSpecification or null
   */
  findColorSpecificationById(targetId) {
    if (!this.fullParsedObject || !targetId) return null;
    
    console.log('Searching for ColorSpecification with ID:', targetId);
    
    // Check our cached map first
    if (this.colorSpecificationMap && this.colorSpecificationMap[targetId]) {
      console.log('Found ColorSpecification in cached map');
      return this.colorSpecificationMap[targetId];
    }
    
    // Search in ColorSpecificationCollection
    const possiblePaths = [
      'cc:CxF.cc:Resources.cc:ColorSpecificationCollection.cc:ColorSpecification',
      'CxF.Resources.ColorSpecificationCollection.ColorSpecification',
      'Resources.ColorSpecificationCollection.ColorSpecification',
      'ColorSpecificationCollection.ColorSpecification',
      'cc:CxF.cc:ColorSpecification',
      'CxF.ColorSpecification',
      'ColorSpecification'
    ];
    
    for (const path of possiblePaths) {
      const specs = this.getNestedProperty(this.fullParsedObject, path);
      if (specs) {
        const specArray = Array.isArray(specs) ? specs : [specs];
        const found = specArray.find(spec => 
          spec['@_Id'] === targetId || 
          spec.Id === targetId
        );
        if (found) {
          console.log('Found ColorSpecification by ID at path:', path);
          return found;
        }
      }
    }
    
    // Fallback: deep search through the entire structure
    console.log('Performing deep search for ColorSpecification ID:', targetId);
    return this.deepSearchForColorSpecificationById(this.fullParsedObject, targetId);
  }

  /**
   * Deep search for object by ID throughout the structure
   * @param {Object} obj - Object to search in
   * @param {string} targetId - ID to find
   * @param {number} depth - Current search depth
   * @returns {Object|null} - Found object or null
   */
  deepSearchForObjectById(obj, targetId, depth = 0) {
    if (depth > 10 || !obj || typeof obj !== 'object') return null;
    
    // Check if this object has the target ID
    if (obj['@_Id'] === targetId || obj['@_ObjectId'] === targetId || 
        obj.Id === targetId || obj.ObjectId === targetId) {
      return obj;
    }
    
    // Search in child objects
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const result = this.deepSearchForObjectById(value, targetId, depth + 1);
        if (result) return result;
      }
    }
    
    return null;
  }

  /**
   * Deep search for ColorSpecification by ID throughout the structure
   * @param {Object} obj - Object to search in
   * @param {string} targetId - ID to find
   * @param {number} depth - Current search depth
   * @returns {Object|null} - Found ColorSpecification or null
   */
  deepSearchForColorSpecificationById(obj, targetId, depth = 0) {
    if (depth > 10 || !obj || typeof obj !== 'object') return null;
    
    // Check if this is a ColorSpecification with the target ID
    if ((obj['@_Id'] === targetId || obj.Id === targetId) && 
        this.hasColorSpecificationContent(obj)) {
      return obj;
    }
    
    // Search in child objects
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const result = this.deepSearchForColorSpecificationById(value, targetId, depth + 1);
        if (result) return result;
      }
    }
    
    return null;
  }
}

// Export singleton instance
export const cxfParser = new CxfParser();
// Matrix Export/Import Utility for Match Status System
// This utility allows exporting the status and button matrices to CSV/JSON
// for review and editing in Excel, then importing changes back

import { STATUS_MATRIX, BUTTON_MATRIX } from './matchStatusUtils.jsx';

// Metadata for the export
const EXPORT_METADATA = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  description: 'Match Status and Button Matrices Export',
  warning: 'Modifying these matrices affects the entire color matching workflow. Test thoroughly after importing changes.'
};

// Export all matrices to a structured format
export const exportMatrices = () => {
  try {
    console.log('🔍 Starting matrix export...');
    console.log('STATUS_MATRIX:', STATUS_MATRIX);
    console.log('BUTTON_MATRIX:', BUTTON_MATRIX);
    
    const exportData = {
      metadata: EXPORT_METADATA,
      
      // Status Matrix - display properties for each state and role
      statusMatrix: flattenStatusMatrix(),
      
      // Card Button Matrix - buttons available on match cards
      cardButtonMatrix: flattenButtonMatrix('card'),
      
      // Header Button Matrix - buttons available in the matching header
      headerButtonMatrix: flattenButtonMatrix('header'),
    
    // Role Mapping - how database roles map to matrix roles
    roleMapping: [
      { databaseRole: 'requestor', matrixRole: 'requestor', description: 'Organization that created the match request' },
      { databaseRole: 'receiver', matrixRole: 'shared-with', description: 'Original recipient of the match request' },
      { databaseRole: 'router', matrixRole: 'shared-with', description: 'Organization that routes the match to another' },
      { databaseRole: 'routed-to', matrixRole: 'routed-to', description: 'Organization that receives a routed match' }
    ],
    
    // State Normalization Rules
    normalizationRules: [
      { 
        condition: 'measurementState === "empty" && isRouted && userRole === "requestor"',
        result: 'in-progress',
        description: 'Requestor sees "In Progress" when match is routed but empty'
      },
      {
        condition: 'measurementState === "empty" && isRouted && userRole === "shared-with"',
        result: 'routed',
        description: 'Shared-with sees "Routed" when they have routed an empty match'
      },
      {
        condition: 'measurementState === "empty" && isRouted && userRole === "routed-to"',
        result: 'empty',
        description: 'Routed-to sees "New" for empty matches they received'
      }
    ]
  };
  
  console.log('✅ Matrix export completed successfully');
  return exportData;
  
  } catch (error) {
    console.error('❌ Matrix export failed:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Matrix export failed: ${error.message}`);
  }
};

// Export to CSV format (multiple tables)
export const exportToCSV = () => {
  const data = exportMatrices();
  
  // Status Matrix - convert to flat array for CSV
  const statusMatrixCSV = convertToCSV(flattenStatusMatrix().map(row => ([
    row.state,
    row.role,
    row.displayText,
    row.color,
    row.iconName,
    row.description
  ])));
  
  // Role Mapping CSV
  const roleMappingCSV = convertToCSV(data.roleMapping.map(row => ([
    row.databaseRole,
    row.matrixRole,
    row.description
  ])));
  
  // Button Matrices - flatten each button configuration
  const cardButtonsCSV = convertToCSV(flattenButtonMatrix('card').map(row => ([
    row.state,
    row.role,
    row.buttonType,
    row.label,
    row.variant,
    row.description
  ])));
  
  const headerButtonsCSV = convertToCSV(flattenButtonMatrix('header').map(row => ([
    row.state,
    row.role,
    row.buttonType,
    row.label,
    row.variant,
    row.description
  ])));
  
  return {
    statusMatrix: statusMatrixCSV,
    cardButtons: cardButtonsCSV,
    headerButtons: headerButtonsCSV,
    roleMapping: roleMappingCSV
  };
};

// Download matrices as CSV files
export const downloadMatricesAsCSV = () => {
  const csvFiles = exportToCSV();
  
  // Download CSV files with headers
  downloadCSV('State,Role,Display Text,Icon,Color,Description\n' + csvFiles.statusMatrix, 'status-matrix.csv');
  downloadCSV('State,Role,Button Type,Label,Variant,Description\n' + csvFiles.cardButtons, 'card-button-matrix.csv');
  downloadCSV('State,Role,Button Type,Label,Variant,Description\n' + csvFiles.headerButtons, 'header-button-matrix.csv');
  downloadCSV('Database Role,Matrix Role,Description\n' + csvFiles.roleMapping, 'role-mapping.csv');
  
  // Also download the complete JSON export
  const jsonData = exportMatrices();
  downloadJSON(jsonData, 'match-matrices-complete.json');
};

// Import matrices from JSON (for programmatic updates)
export const importMatrices = (importData) => {
  try {
    // Validate the import structure
    validateImportData(importData);
    
    // Convert back to matrix format - role-specific structure
    const newStatusMatrix = {};
    importData.statusMatrix.forEach(item => {
      if (!newStatusMatrix[item.state]) {
        newStatusMatrix[item.state] = {};
      }
      newStatusMatrix[item.state][item.role] = {
        text: item.displayText,
        color: item.color,
        icon: createIconComponent(item.iconName)
      };
    });
    
    const newButtonMatrix = {
      card: {},
      header: {}
    };
    
    // Reconstruct button matrices from flat data (now role-specific)
    ['card', 'header'].forEach(buttonType => {
      const buttonData = importData[`${buttonType}ButtonMatrix`];
      if (buttonData && Array.isArray(buttonData)) {
        buttonData.forEach(buttonConfig => {
          if (!newButtonMatrix[buttonType][buttonConfig.state]) {
            newButtonMatrix[buttonType][buttonConfig.state] = {
              'requestor': [],
              'shared-with': [],
              'routed-to': [],
              'default': []
            };
          }
          
          const role = buttonConfig.role || 'default';
          newButtonMatrix[buttonType][buttonConfig.state][role].push({
            type: buttonConfig.buttonType,
            label: buttonConfig.label,
            variant: buttonConfig.variant
          });
        });
      }
    });
    
    return {
      statusMatrix: newStatusMatrix,
      buttonMatrix: newButtonMatrix,
      metadata: importData.metadata
    };
  } catch (error) {
    console.error('Import failed:', error);
    throw new Error(`Matrix import failed: ${error.message}`);
  }
};

// Helper Functions

function flattenStatusMatrix() {
  try {
    console.log('🔍 Flattening STATUS_MATRIX...');
    const flattened = [];
    
    // Validate STATUS_MATRIX exists and is an object
    if (!STATUS_MATRIX || typeof STATUS_MATRIX !== 'object') {
      throw new Error('STATUS_MATRIX is not defined or not an object');
    }
    
    Object.entries(STATUS_MATRIX).forEach(([state, roleConfigs]) => {
      console.log(`Processing state: ${state}`, roleConfigs);
      
      if (!roleConfigs || typeof roleConfigs !== 'object') {
        console.warn(`⚠️ State ${state} has invalid roleConfigs:`, roleConfigs);
        return;
      }
      
      Object.entries(roleConfigs).forEach(([role, config]) => {
        console.log(`  Processing role: ${role} for state: ${state}`, config);
        
        if (!config || typeof config !== 'object') {
          console.warn(`⚠️ Role ${role} in state ${state} has invalid config:`, config);
          return;
        }
        
        flattened.push({
          state,
          role,
          displayText: config.text || 'Unknown',
          color: config.color || 'text-gray-500',
          iconName: getIconName(config.icon),
          description: getStateDescription(state, role)
        });
      });
    });
    
    console.log(`✅ Flattened ${flattened.length} status matrix entries`);
    return flattened;
  } catch (error) {
    console.error('❌ Error flattening STATUS_MATRIX:', error);
    throw error;
  }
}

function flattenButtonMatrix(buttonType) {
  try {
    console.log(`🔍 Flattening ${buttonType} button matrix...`);
    
    // Validate BUTTON_MATRIX exists
    if (!BUTTON_MATRIX || typeof BUTTON_MATRIX !== 'object') {
      throw new Error('BUTTON_MATRIX is not defined or not an object');
    }
    
    const matrix = BUTTON_MATRIX[buttonType];
    if (!matrix) {
      console.warn(`⚠️ No ${buttonType} matrix found in BUTTON_MATRIX`);
      return [];
    }
    
    const flattened = [];
    
    Object.entries(matrix).forEach(([state, roleConfigs]) => {
      console.log(`Processing ${buttonType} state: ${state}`, roleConfigs);
      
      if (!roleConfigs || typeof roleConfigs !== 'object') {
        console.warn(`⚠️ State ${state} has invalid roleConfigs:`, roleConfigs);
        return;
      }
      
      Object.entries(roleConfigs).forEach(([role, buttons]) => {
        console.log(`  Processing ${buttonType} role: ${role} for state: ${state}`, buttons);
        
        if (!Array.isArray(buttons)) {
          console.warn(`⚠️ Role ${role} in state ${state} has non-array buttons:`, buttons);
          return;
        }
        
        buttons.forEach((button, index) => {
          if (!button || typeof button !== 'object') {
            console.warn(`⚠️ Button ${index} for role ${role} in state ${state} is invalid:`, button);
            return;
          }
          
          flattened.push({
            state,
            role,
            buttonType: button.type || 'unknown',
            label: button.label || 'Unknown',
            variant: button.variant || 'default',
            description: getButtonDescription(state, button.type, buttonType, role)
          });
        });
      });
    });
    
    console.log(`✅ Flattened ${flattened.length} ${buttonType} button matrix entries`);
    return flattened;
  } catch (error) {
    console.error(`❌ Error flattening ${buttonType} BUTTON_MATRIX:`, error);
    throw error;
  }
}

function getIconName(iconComponent) {
  if (!iconComponent) return 'None';
  
  // Extract icon name from React component
  const iconMap = {
    'Clock': 'Clock',
    'Save': 'Save', 
    'CheckCircle': 'CheckCircle',
    'CheckCircle2': 'CheckCircle2',
    'XCircle': 'XCircle',
    'Send': 'Send',
    'ArrowRight': 'ArrowRight',
    'FileQuestion': 'FileQuestion',
    'Play': 'Play'
  };
  
  const componentString = iconComponent.toString();
  for (const [name, display] of Object.entries(iconMap)) {
    if (componentString.includes(name)) return display;
  }
  
  return 'Unknown';
}

function createIconComponent(iconName) {
  const iconMap = {
    'Clock': '<Clock className="h-4 w-4 mr-2" />',
    'Save': '<Save className="h-4 w-4 mr-2" />',
    'CheckCircle': '<CheckCircle className="h-4 w-4 mr-2" />',
    'CheckCircle2': '<CheckCircle2 className="h-4 w-4 mr-2" />',
    'XCircle': '<XCircle className="h-4 w-4 mr-2" />',
    'Send': '<Send className="h-4 w-4 mr-2" />',
    'ArrowRight': '<ArrowRight className="h-4 w-4 mr-2" />',
    'FileQuestion': '<FileQuestion className="h-4 w-4 mr-2" />',
    'Play': '<Play className="h-4 w-4 mr-2" />'
  };
  
  return iconMap[iconName] || null;
}

function getStateDescription(state, role = null) {
  const descriptions = {
    'empty': 'Initial state - no work has been done on the match',
    'saved': 'Work in progress - match has been saved but not submitted',
    'in-progress': 'Requestor view when match is routed but work is ongoing',
    'routed': 'Shared-with view when they have routed the match to another organization',
    'sent-to-requestor-by-shared-with': 'Match sent to requestor for approval by shared-with org',
    'sent-to-shared-with-by-routed-to': 'Match sent to shared-with for approval by routed-to org',
    'sent-to-requestor-by-routed-to': 'Match sent to requestor for approval by routed-to org',
    'approved-by-shared-with': 'Match approved by the shared-with organization',
    'approved-by-requestor': 'Match approved by the requestor organization',
    'approved-by-routed-to': 'Match approved by the routed-to organization',
    'rejected-by-shared-with': 'Match rejected by the shared-with organization',
    'rejected-by-requestor': 'Match rejected by the requestor organization',
    'rematch-by-shared-with': 'Re-match requested by shared-with organization',
    'rematch-by-routed-to': 'Re-match requested by routed-to organization'
  };
  
  const baseDescription = descriptions[state] || 'Custom state - no description available';
  return role ? `${baseDescription} (${role} perspective)` : baseDescription;
}

function getButtonDescription(state, buttonType, context, role = null) {
  const descriptions = {
    'review': role ? `Opens match detail view (${role} perspective)` : 'Opens the match detail view for reviewing',
    'approve': role ? `Approves match as ${role}` : 'Approves the match and marks it as accepted',
    'reject': role ? `Rejects match as ${role}` : 'Rejects the match with the option to provide feedback',
    'save': role ? `Saves match as ${role}` : 'Saves the current match without submitting',
    'send-for-approval': role ? `Sends for approval as ${role}` : 'Submits the match for approval by the requestor',
    'start-matching': role ? `Starts matching process as ${role}` : 'Begins the color matching process',
    'rematch-by-shared-with': 'Initiates a new match attempt by the shared-with organization',
    'rematch-by-routed-to': 'Initiates a new match attempt by the routed-to organization'
  };
  
  return descriptions[buttonType] || `${buttonType} button for ${state} state in ${context} (role: ${role})`;
}

function convertToCSV(data) {
  return data.map(row => 
    row.map(cell => 
      typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) 
        ? `"${cell.replace(/"/g, '""')}"` 
        : cell
    ).join(',')
  ).join('\n');
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadJSON(jsonData, filename) {
  const jsonString = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function validateImportData(data) {
  if (!data.statusMatrix || !Array.isArray(data.statusMatrix)) {
    throw new Error('Invalid statusMatrix structure');
  }
  
  if (!data.cardButtonMatrix || !Array.isArray(data.cardButtonMatrix)) {
    throw new Error('Invalid cardButtonMatrix structure');
  }
  
  if (!data.headerButtonMatrix || !Array.isArray(data.headerButtonMatrix)) {
    throw new Error('Invalid headerButtonMatrix structure');
  }
  
  // Additional validation rules can be added here
}

// Usage instructions for the exported data
export const USAGE_INSTRUCTIONS = `
Matrix Export/Import Tool Usage:

EXPORT:
1. Click "Export Matrices" to generate current matrix data
2. Click "Download as CSV" to get Excel-friendly CSV files
3. Or copy the JSON data for programmatic use

CSV FILES GENERATED:
- status-matrix.csv: Role-specific display text, icons, and colors for each state
- card-button-matrix.csv: Role-specific buttons shown on match cards
- header-button-matrix.csv: Role-specific buttons shown in match headers  
- role-mapping.csv: How database roles map to matrix roles

Each CSV now includes a "Role" column showing which role sees what.

IMPORT:
1. Modify the JSON data (be careful with syntax!)
2. Paste modified JSON into the import box
3. Click "Import Matrices" to apply changes

⚠️  WARNING: Only use this in development! 
Changes affect the live application immediately.
`;
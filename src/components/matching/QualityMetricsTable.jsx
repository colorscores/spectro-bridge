import React from 'react';
import { Check, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { normalizeMetricKey } from '@/lib/qualityAssessment';

/**
 * Comprehensive quality metrics table showing all color difference calculations
 * @param {Object} qualityResults - Results from calculateQualityAssessment
 */
export const QualityMetricsTable = ({ qualityResults, currentMeasurementSettings, liveColorMetrics }) => {
  console.log('🔍 QualityMetricsTable DEBUG: Input props', {
    hasQualityResults: !!qualityResults,
    hasAllMetrics: !!qualityResults?.allMetrics,
    hasCurrentSettings: !!currentMeasurementSettings,
    hasLiveMetrics: !!liveColorMetrics,
    qualityResultsKeys: qualityResults ? Object.keys(qualityResults) : [],
    allMetricsKeys: qualityResults?.allMetrics ? Object.keys(qualityResults.allMetrics) : []
  });

  if (!qualityResults) {
    console.log('🔍 QualityMetricsTable: No quality results provided');
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        <div className="font-medium mb-1">No Quality Assessment Available</div>
        <div className="text-xs">Load a match to see quality metrics</div>
      </div>
    );
  }

  if (!qualityResults.allMetrics) {
    console.log('🔍 QualityMetricsTable: No allMetrics in quality results');
    return (
      <div className="text-sm text-muted-foreground p-4">
        Quality results missing metric calculations
      </div>
    );
  }

  const { allMetrics, results, ruleMetricsNormalized = [] } = qualityResults;

  // Create a lookup for rule-based results with normalized keys
  const ruleResults = {};
  const normalizedRuleResults = {};
  const normalizedMetricSet = new Set();
  
  console.log('🔍 DEBUG QualityMetricsTable - Full qualityResults:', qualityResults);
  console.log('🔍 DEBUG QualityMetricsTable - Raw results:', results);
  console.log('🔍 DEBUG QualityMetricsTable - Results is array?', Array.isArray(results));
  console.log('🔍 DEBUG QualityMetricsTable - Results length:', results?.length);
  
  if (results && Array.isArray(results)) {
    results.forEach(result => {
      console.log('🔍 DEBUG QualityMetricsTable - Processing result:', result);
      if (result.metric) {
        // Store by original metric key
        ruleResults[result.metric] = result;
        // Store by normalized key for robust lookup
        const normalizedKey = normalizeMetricKey(result.metric);
        normalizedRuleResults[normalizedKey] = result;
        normalizedMetricSet.add(normalizedKey);
        console.log('🔍 DEBUG - Result metric:', result.metric, '-> normalized:', normalizedKey);
        console.log('🔍 DEBUG - Result properties:', { 
          levelName: result.levelName, 
          status: result.status, 
          displayColor: result.displayColor 
        });
        
        // Also store by the normalized key from the result if different
        if (result.normalizedMetric && result.normalizedMetric !== normalizedKey) {
          normalizedRuleResults[result.normalizedMetric] = result;
          normalizedMetricSet.add(result.normalizedMetric);
          console.log('🔍 DEBUG - Also stored as:', result.normalizedMetric);
        }
      }
    });
  }
  
  console.log('🔍 DEBUG - Normalized metric set:', Array.from(normalizedMetricSet));

  // Only show metrics that have rules defined
  const metricsWithRules = (results && Array.isArray(results)) ? results.map(result => result.metric) : [];
  
  // Always show primary color difference metrics
  const primaryMetrics = ['dE2000', 'dL', 'da', 'db', 'dC', 'dH'];
  
  // Normalize measurement settings for consistent comparison
  const normalizeSettings = (settings) => {
    if (!settings) return null;
    return {
      mode: settings.mode,
      illuminant: settings.illuminant,
      observer: String(settings.observer || '2'),
      table: String(settings.table || '5'),
      deltaE: settings.deltaE === 'dE00' ? 'dE2000' : settings.deltaE // Normalize dE00 to dE2000
    };
  };

  // Define metrics to display - dynamic dE row based on selected method
  const getDeltaEDefinition = () => {
    const deltaEMethod = currentMeasurementSettings?.deltaE || 'dE76';
    switch (deltaEMethod) {
      case 'dE76':
        return { key: 'dE76', name: '∆E 1976' };
      case 'dECMC2:1':
      case 'dECMC1:1':
        return { key: 'dECMC', name: '∆E CMC' };
      case 'dE2000':
      case 'dE00': // Treat dE00 as dE2000 for display
        return { key: 'dE2000', name: 'dE00' };
      default:
        return { key: 'dE76', name: '∆E 1976' };
    }
  };

  const metricDefinitions = [
    getDeltaEDefinition(),
    { key: 'dL', name: '∆L' },
    { key: 'da', name: '∆a' },
    { key: 'db', name: '∆b' },
    { key: 'dC', name: '∆C' },
    { key: 'dH', name: '∆H' }
  ];

  const formatValue = (value, key) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    
    // For signed differences (dL, da, db, dC), show the sign
    if (['dL', 'da', 'db', 'dC'].includes(key)) {
      return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
    }
    
    // For absolute differences and Delta E values
    return Math.abs(value).toFixed(2);
  };

  // Enhanced rule detection - differentiate between "not in rules" vs "settings mismatch"
  const getMetricRuleStatus = (metricKey) => {
    const normalizedKey = normalizeMetricKey(metricKey);
    
    console.log('🔍 DEBUG getMetricRuleStatus - Checking:', metricKey, '-> normalized:', normalizedKey);
    console.log('🔍 DEBUG getMetricRuleStatus - Available rule metrics:', ruleMetricsNormalized);
    console.log('🔍 DEBUG getMetricRuleStatus - Current measurement settings:', currentMeasurementSettings);
    console.log('🔍 DEBUG getMetricRuleStatus - Quality set measurement settings:', qualityResults?.qualitySetMeasurementSettings);
    
    // First check if metric is in rules
    const metricInRules = ruleMetricsNormalized.includes(normalizedKey);
    
    if (!metricInRules) {
      console.log('🔍 DEBUG getMetricRuleStatus - Metric not in rules');
      return { status: 'not_in_rules', tooltip: null };
    }
    
    // Then check if measurement settings match (if quality set has measurement settings)
    const qualitySetSettings = qualityResults?.qualitySetMeasurementSettings;
    if (qualitySetSettings && currentMeasurementSettings) {
      // Normalize both settings for comparison
      const normalizedQualitySettings = normalizeSettings(qualitySetSettings);
      const normalizedCurrentSettings = normalizeSettings(currentMeasurementSettings);
      
      console.log('🔍 DEBUG getMetricRuleStatus - Normalized quality settings:', normalizedQualitySettings);
      console.log('🔍 DEBUG getMetricRuleStatus - Normalized current settings:', normalizedCurrentSettings);
      
      if (normalizedQualitySettings && normalizedCurrentSettings) {
        const settingsMatch = 
          normalizedQualitySettings.mode === normalizedCurrentSettings.mode &&
          normalizedQualitySettings.illuminant === normalizedCurrentSettings.illuminant &&
          normalizedQualitySettings.observer === normalizedCurrentSettings.observer &&
          normalizedQualitySettings.table === normalizedCurrentSettings.table &&
          normalizedQualitySettings.deltaE === normalizedCurrentSettings.deltaE;
        
        console.log('🔍 DEBUG getMetricRuleStatus - Per-field comparison:');
        console.log('  mode:', normalizedQualitySettings.mode, '===', normalizedCurrentSettings.mode, '→', normalizedQualitySettings.mode === normalizedCurrentSettings.mode);
        console.log('  illuminant:', normalizedQualitySettings.illuminant, '===', normalizedCurrentSettings.illuminant, '→', normalizedQualitySettings.illuminant === normalizedCurrentSettings.illuminant);
        console.log('  observer:', normalizedQualitySettings.observer, '===', normalizedCurrentSettings.observer, '→', normalizedQualitySettings.observer === normalizedCurrentSettings.observer);
        console.log('  table:', normalizedQualitySettings.table, '===', normalizedCurrentSettings.table, '→', normalizedQualitySettings.table === normalizedCurrentSettings.table);
        console.log('  deltaE:', normalizedQualitySettings.deltaE, '===', normalizedCurrentSettings.deltaE, '→', normalizedQualitySettings.deltaE === normalizedCurrentSettings.deltaE);
        console.log('🔍 DEBUG getMetricRuleStatus - Final settings match:', settingsMatch);
        
        if (!settingsMatch) {
          console.log('🔍 DEBUG getMetricRuleStatus - Measurement settings do not match quality set');
          
          // Build detailed tooltip about what doesn't match
          const mismatches = [];
          if (normalizedQualitySettings.mode !== normalizedCurrentSettings.mode) {
            mismatches.push(`Mode: Expected ${normalizedQualitySettings.mode}, using ${normalizedCurrentSettings.mode}`);
          }
          if (normalizedQualitySettings.illuminant !== normalizedCurrentSettings.illuminant) {
            mismatches.push(`Illuminant: Expected ${normalizedQualitySettings.illuminant}, using ${normalizedCurrentSettings.illuminant}`);
          }
          if (normalizedQualitySettings.observer !== normalizedCurrentSettings.observer) {
            mismatches.push(`Observer: Expected ${normalizedQualitySettings.observer}°, using ${normalizedCurrentSettings.observer}°`);
          }
          if (normalizedQualitySettings.table !== normalizedCurrentSettings.table) {
            mismatches.push(`Table: Expected ${normalizedQualitySettings.table}, using ${normalizedCurrentSettings.table}`);
          }
          if (normalizedQualitySettings.deltaE !== normalizedCurrentSettings.deltaE) {
            mismatches.push(`Delta E: Expected ${normalizedQualitySettings.deltaE}, using ${normalizedCurrentSettings.deltaE}`);
          }
          
          const tooltip = `Rule exists but measurement settings don't match:\n${mismatches.join('\n')}`;
          return { status: 'settings_mismatch', tooltip };
        }
      }
    }
    
    console.log('🔍 DEBUG getMetricRuleStatus - Result: in_rules (metric in rules and settings match)');
    return { status: 'in_rules', tooltip: null };
  };

  const getStatusColor = (result) => {
    if (!result) return 'text-foreground';
    
    // Use display color from quality set if available
    if (result.displayColor) {
      return { color: result.displayColor };
    }
    
    // Fallback to default colors
    switch (result.status) {
      case 'pass':
        return 'text-green-600';
      case 'fail':
        return 'text-red-600';
      case 'warn':
        return 'text-yellow-600';
      default:
        return 'text-foreground';
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardContent className="p-4 flex flex-col h-full">
        <h4 className="text-sm font-semibold mb-3 flex-shrink-0">
          {qualityResults?.qualitySetName ? `Quality Set: ${qualityResults.qualitySetName}` : 'Color Difference Metrics'}
        </h4>
        {(!ruleMetricsNormalized || ruleMetricsNormalized.length === 0) && (
          <div className="mb-2 text-xs text-muted-foreground">
            No quality rules found for the selected quality set. “Used in Rule” will be empty.
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Metric</th>
                  <th className="text-center py-2 font-medium">∆</th>
                  <th className="text-center py-2 font-medium">Used in Rule</th>
                  <th className="text-left py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {metricDefinitions.map(({ key, name }) => {
                  // Get value - prefer live metrics for dE, fallback to allMetrics
                  let value;
                  if (key.startsWith('dE') && liveColorMetrics?.dE != null) {
                    value = liveColorMetrics.dE;
                  } else if (liveColorMetrics && key === 'dL') {
                    value = liveColorMetrics.dL;
                  } else if (liveColorMetrics && key === 'da') {
                    value = liveColorMetrics.dA;
                  } else if (liveColorMetrics && key === 'db') {
                    value = liveColorMetrics.dB;
                  } else if (liveColorMetrics && key === 'dC') {
                    value = liveColorMetrics.dC;
                  } else if (liveColorMetrics && key === 'dH') {
                    value = liveColorMetrics.dH;
                  } else {
                    value = allMetrics[key];
                  }
                  
                  // Find rule result using more comprehensive lookup strategy
                  const normalizedKey = normalizeMetricKey(key);
                  
                  console.log('🔍 DEBUG - Looking up result for metric:', {
                    key,
                    normalizedKey,
                    availableRuleKeys: Object.keys(ruleResults),
                    availableNormalizedKeys: Object.keys(normalizedRuleResults)
                  });
                  
                  // Try multiple lookup strategies for robust matching
                  let ruleResult = ruleResults[key] || 
                                   normalizedRuleResults[normalizedKey] ||
                                   ruleResults[normalizedKey]; // Sometimes the original key is already normalized
                  
                  // If still no match and it's a Delta E metric, try all Delta E variations
                  if (!ruleResult && key.startsWith('dE')) {
                    const deltaEVariants = ['de76', 'de2000', 'decmc', 'dE76', 'dE2000', 'dECMC'];
                    ruleResult = deltaEVariants
                      .map(variant => normalizedRuleResults[variant] || ruleResults[variant])
                      .find(r => r);
                  }
                  
                  console.log('🔍 DEBUG - Found rule result:', !!ruleResult, ruleResult ? {
                    levelName: ruleResult.levelName,
                    status: ruleResult.status,
                    displayColor: ruleResult.displayColor
                  } : null);
                  
                  const hasRule = !!ruleResult;
                  
                  return (
                    <tr key={key} className="border-b last:border-b-0">
                      <td className="py-2">
                        <div className="font-medium">{name}</div>
                      </td>
                      <td className="py-2 text-center font-mono">
                        {(() => {
                          const ruleStatus = getMetricRuleStatus(key);
                          const shouldApplyRuleColor = hasRule && ruleResult && ruleStatus.status === 'in_rules';
                          
                          return (
                            <span 
                              className={`font-bold ${shouldApplyRuleColor ? (typeof getStatusColor(ruleResult) === 'string' ? getStatusColor(ruleResult) : '') : 'text-foreground'}`}
                              style={shouldApplyRuleColor && typeof getStatusColor(ruleResult) === 'object' ? getStatusColor(ruleResult) : {}}
                            >
                              {formatValue(value, key)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2 text-center">
                        <TooltipProvider>
                          {(() => {
                            const ruleStatus = getMetricRuleStatus(key);
                            
                            if (ruleStatus.status === 'in_rules') {
                              return (
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              );
                            } else if (ruleStatus.status === 'settings_mismatch') {
                              return (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertCircle className="h-4 w-4 text-yellow-600 mx-auto" />
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <div className="text-xs whitespace-pre-line">
                                      {ruleStatus.tooltip}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            } else {
                              return (
                                <X className="h-4 w-4 text-muted-foreground mx-auto" />
                              );
                            }
                          })()}
                        </TooltipProvider>
                      </td>
                      <td className="py-2">
                        {(() => {
                          const ruleStatus = getMetricRuleStatus(key);
                          
                          // Only show results for metrics that are properly "Used in Rule" (green checkmarks)
                          if (hasRule && ruleResult && ruleStatus.status === 'in_rules') {
                            return (
                              <div className="text-sm">
                                <div 
                                  className={`font-bold ${typeof getStatusColor(ruleResult) === 'string' ? getStatusColor(ruleResult) : ''}`}
                                  style={typeof getStatusColor(ruleResult) === 'object' ? getStatusColor(ruleResult) : {}}
                                >
                                  {ruleResult.levelName || ruleResult.status || 'N/A'}
                                </div>
                              </div>
                            );
                          } else {
                            return <span className="text-muted-foreground text-xs">—</span>;
                          }
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
      </CardContent>
    </Card>
  );
};

export default QualityMetricsTable;
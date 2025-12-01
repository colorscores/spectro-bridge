import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Layers, Droplet, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getSolidColorHex, getSolidColorHexFromConditions } from '@/lib/colorUtils/solidColorExtractor';
import { supabase } from '@/integrations/supabase/client';

const DetailRow = ({ label, value, children }) => (
  <div className="flex justify-between items-center py-3 border-b border-gray-200">
    <span className="text-sm text-gray-500">{label}</span>
    {value && <span className="text-sm font-medium text-gray-800 text-right">{value}</span>}
    {children}
  </div>
);

const AssetIcon = ({ assetType, color }) => {
  const iconProps = { className: "h-6 w-6 text-gray-600" };
  switch (assetType) {
    case 'Substrate': return <Layers {...iconProps} />;
    case 'Substrate Condition': return <div className="w-6 h-6 rounded-full" style={{backgroundColor: color}}></div>;
    case 'Ink': return <Droplet {...iconProps} />;
    case 'Ink Condition': return <div className="w-6 h-6 rounded-full" style={{backgroundColor: color}}></div>;
    case 'Printer': return <Printer {...iconProps} />;
    default: return null;
  }
};

// Utility function to get solid color from ink condition or ink
const getSolidColor = (asset, assetType, activeDataMode = null) => {
  if (assetType === 'Ink Condition') {
    return getSolidColorHex(asset, activeDataMode);
  }
  
  if (assetType === 'Ink') {
    return getSolidColorHexFromConditions(asset.conditions || [], activeDataMode);
  }

  return asset.hex || asset.color_hex || '#f3f4f6';
};

const GenericDetailPane = ({ asset, onClose, onViewDetails, assetType, activeDataMode = null }) => {
  const [isAdditionalInfoOpen, setIsAdditionalInfoOpen] = useState(false);
  const [createdByName, setCreatedByName] = useState(null);
  const [updatedByName, setUpdatedByName] = useState(null);
  const [loadingNames, setLoadingNames] = useState(false);
  const [substrateName, setSubstrateName] = useState(null);
  const [substrateConditionName, setSubstrateConditionName] = useState(null);
  const [loadingSubstrateInfo, setLoadingSubstrateInfo] = useState(false);

  // Fetch substrate and substrate condition names for Ink Conditions
  useEffect(() => {
    const fetchSubstrateInfo = async () => {
      if (assetType !== 'Ink Condition' || !asset) {
        setSubstrateName(null);
        setSubstrateConditionName(null);
        return;
      }

      setLoadingSubstrateInfo(true);
      try {
        // Fetch substrate name if substrate_id exists
        if (asset.substrate_id) {
          const { data: substrateData, error: substrateError } = await supabase
            .from('substrates')
            .select('name')
            .eq('id', asset.substrate_id)
            .maybeSingle();

          if (!substrateError && substrateData) {
            setSubstrateName(substrateData.name);
          }
        }

        // Fetch substrate condition name if substrate_condition exists
        if (asset.substrate_condition) {
          const { data: conditionData, error: conditionError } = await supabase
            .from('substrate_conditions')
            .select('name')
            .eq('id', asset.substrate_condition)
            .maybeSingle();

          if (!conditionError && conditionData) {
            setSubstrateConditionName(conditionData.name);
          }
        }
      } catch (error) {
        console.error('Error fetching substrate info:', error);
      } finally {
        setLoadingSubstrateInfo(false);
      }
    };

    fetchSubstrateInfo();
  }, [asset, assetType]);

  // Fetch profile names for created_by and updated_by
  useEffect(() => {
    const fetchProfileNames = async () => {
      if (!asset) return;
      setLoadingNames(true);

      try {
        let createdById = asset.created_by;
        let updatedById = asset.updated_by || asset.last_edited_by;

        // If this is an Ink and editor IDs are missing (e.g. coming from a view), fetch from base table
        if (assetType === 'Ink' && (!createdById || !updatedById)) {
          const { data: inkRow, error: inkError } = await supabase
            .from('inks')
            .select('created_by, last_edited_by')
            .eq('id', asset.id)
            .maybeSingle();

          if (inkError) {
            console.warn('Unable to fetch ink editor IDs:', inkError);
          } else if (inkRow) {
            createdById = createdById || inkRow.created_by;
            updatedById = updatedById || inkRow.last_edited_by;
          }
        }

        const profileIds = [createdById, updatedById].filter(Boolean);
        if (profileIds.length === 0) {
          setCreatedByName(null);
          setUpdatedByName(null);
          return;
        }

        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', profileIds);

        if (error) {
          console.error('Error fetching profile names:', error);
        } else if (profiles) {
          const createdProfile = profiles.find(p => p.id === createdById);
          const updatedProfile = profiles.find(p => p.id === updatedById);
          setCreatedByName(createdProfile?.full_name || null);
          setUpdatedByName(updatedProfile?.full_name || createdProfile?.full_name || null);
        }
      } catch (error) {
        console.error('Error fetching profile names:', error);
      } finally {
        setLoadingNames(false);
      }
    };

    fetchProfileNames();
  }, [asset, assetType]);

  if (!asset) return null;

  const toggleAdditionalInfo = () => {
    setIsAdditionalInfoOpen(prev => !prev);
  };

  const renderAssetDetails = () => {
    switch (assetType) {
      case 'Printer':
        return (
          <>
            <DetailRow label="Type">
              {asset.type ? (
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium text-right underline">
                  {asset.type}
                </button>
              ) : (
                <span className="text-sm font-medium text-gray-800 text-right">N/A</span>
              )}
            </DetailRow>
            <DetailRow label="Calibrated" value={asset.calibrated ? 'Yes' : 'No'} />
            <DetailRow label="Last Calibration" value={asset.lastCalibrationDate || 'N/A'} />
          </>
        );
      case 'Ink':
        return (
          <>
            <DetailRow label="Print Process" value={asset.print_process || 'N/A'} />
            <DetailRow label="Ink Type" value={asset.ink_type || 'N/A'} />
            <DetailRow label="Curve" value={asset.curve === 'as_measured' ? 'As Measured' : (asset.curve || 'N/A')} />
          </>
        );
      case 'Ink Condition':
        const inkCurveDisplay = asset.ink_curve === 'as_measured' ? 'As Measured' :
                               asset.ink_curve === 'iso_12647' ? 'ISO 12647-2' :
                               asset.ink_curve === 'custom_curve' ? 'Custom Curve' :
                               asset.ink_curve || 'As Measured';
        
        return (
          <>
            <DetailRow label="Version" value={asset.version || '--'} />
            <DetailRow label="Substrate" value={loadingSubstrateInfo ? 'Loading...' : (substrateName || 'N/A')} />
            <DetailRow label="Substrate Condition" value={loadingSubstrateInfo ? 'Loading...' : (substrateConditionName || 'N/A')} />
            <DetailRow label="Ink Curve" value={inkCurveDisplay} />
          </>
        );
      case 'Substrate':
        return (
          <>
            <DetailRow label="Type" value={asset.type || 'N/A'} />
            <DetailRow label="Material" value={asset.material || 'N/A'} />
            <DetailRow label="Surface Quality" value={asset.surface_quality || 'N/A'} />
          </>
        );
      case 'Substrate Condition':
        return (
          <>
            <DetailRow label="Description" value={asset.description || 'N/A'} />
            <DetailRow label="Pack Type" value={asset.pack_type ? <Badge variant="secondary">{asset.pack_type}</Badge> : 'N/A'} />
            <DetailRow label="Part of Structure" value={asset.is_part_of_structure ? 'Yes' : 'No'} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 360, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-white flex-shrink-0 flex flex-col h-full rounded-lg border border-border overflow-hidden"
    >
      <div className="flex-shrink-0 h-auto min-h-[73px] p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex-1 pr-4">
          {(asset.displayName || asset.name).split(/([,;:.!?])\s+/).map((part, idx) => {
            // If this part is punctuation, attach it to previous segment
            if (/^[,;:.!?]$/.test(part)) return part;
            // If previous part was punctuation, start new line
            const prevWasPunctuation = idx > 0 && /^[,;:.!?]$/.test((asset.displayName || asset.name).split(/([,;:.!?])\s+/)[idx - 1]);
            return (
              <span key={idx}>
                {prevWasPunctuation && <br />}
                {part}
              </span>
            );
          })}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
          <X className="h-5 w-5 text-gray-500" />
        </Button>
      </div>
      <div className="flex-grow flex flex-col min-h-0">
        <ScrollArea className="flex-grow">
          <div className="p-4">
            {getSolidColor(asset, assetType, activeDataMode) && (
              <div 
                className="w-full h-32 rounded-lg mb-4 flex-shrink-0"
                style={{ backgroundColor: getSolidColor(asset, assetType, activeDataMode) }}
              />
            )}
            <div className="space-y-1">
              {renderAssetDetails()}
              {asset.tags && (
                <div className="flex justify-between items-start py-3 border-b border-gray-200">
                  <span className="text-sm text-gray-500 pt-1">Tags</span>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                    {asset.tags.length > 0 ? asset.tags.map((tag, index) => (
                      <span key={index} className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-md border border-gray-200">{tag}</span>
                    )) : <span className="text-sm text-gray-500">No tags</span>}
                  </div>
                </div>
              )}
              
              <div 
                className="flex justify-between items-center py-3 border-b border-gray-200 cursor-pointer"
                onClick={toggleAdditionalInfo}
              >
                <span className="text-sm text-gray-500">Additional Info</span>
                <motion.div
                  animate={{ rotate: isAdditionalInfoOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </motion.div>
              </div>

              <AnimatePresence initial={false}>
                {isAdditionalInfoOpen && (
                  <motion.div
                    key="additional-info"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pl-4 border-l-2 border-gray-200">
                      <DetailRow label="Created On" value={asset.createdOn || (asset.created_at ? new Date(asset.created_at).toLocaleDateString() : 'N/A')} />
                      <DetailRow label="Created By" value={loadingNames ? 'Loading...' : (createdByName || asset.createdBy || 'N/A')} />
                      <DetailRow label="Last Edited On" value={asset.lastEdited || (asset.updated_at ? new Date(asset.updated_at).toLocaleDateString() : 'N/A')} />
                      <DetailRow label="Last Edited By" value={loadingNames ? 'Loading...' : (updatedByName || asset.lastEditedBy || 'N/A')} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <Button 
            className="w-full"
            onClick={() => onViewDetails(asset)}
          >
            View Details
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default GenericDetailPane;
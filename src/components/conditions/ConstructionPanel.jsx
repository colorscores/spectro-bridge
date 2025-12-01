import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import CardHeader from '@/components/admin/my-company/CardHeader';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const ConstructionLayer = ({ label, bgColor, textColor = 'black', bold = false, className = '' }) => {
    const isTransparent = bgColor === 'transparent';
    const displayBgColor = isTransparent ? 'transparent' : bgColor;
    const borderStyle = isTransparent ? 'border border-gray-600' : 'border border-gray-400';
    
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className={cn('text-center text-xs py-1 overflow-hidden', borderStyle, bold && 'font-bold', className)}
            style={{ backgroundColor: displayBgColor }}
        >
            <span style={{ color: textColor }}>{label}</span>
        </motion.div>
    );
};

const Spacer = () => (
    <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="h-4"
    />
);

const getDefaultLayers = (isSurfacePrint) => ({
    varnish: { enabled: false, label: 'Varnish', bgColor: '#EFF6FF', type: null, surfaceQuality: null },
    // Surface print: this row is Laminate and should NOT be checked by default
    // Reverse print: this row represents Printed Substrate and should be enabled
    printedSubstrate: { enabled: !isSurfacePrint, label: isSurfacePrint ? 'Laminate' : 'Printed Substrate', bgColor: 'transparent', type: null, surfaceQuality: null },
    ink: { enabled: true, label: 'Color Ink', bgColor: 'black', textColor: 'white', bold: true },
    whiteInk: { enabled: false, label: 'White Ink', bgColor: 'white', textColor: 'black', bold: false },
    whiteUndercoat: { enabled: false, label: isSurfacePrint ? 'Use white ink base coat' : 'Use white ink backer', bgColor: '#F3F4F6' },
    baseSubstrate: { enabled: isSurfacePrint, label: isSurfacePrint ? 'Printed Substrate' : 'Base Substrate', bgColor: '#D1D5DB', type: null, surfaceQuality: null },
});


const ConstructionPanel = ({ 
    construction, 
    parentSubstrate, 
    allSubstrates = [], 
    constructionDetails, 
    onConstructionDetailsChange, 
    condition, 
    onConditionChange, 
    canEdit = true, 
    setHasUnsavedChanges, 
    isNew, 
    lockWhiteUndercoat = false,
    isEditing,
    onEdit,
    onSave,
    onCancel
}) => {
    // Use the isEditing prop to control whether construction details can be edited
    const canEditConstruction = isEditing;
    const { printing_side: printingSide, name: parentSubstrateName, surface_quality: parentSubstrateSurfaceQuality, id: parentSubstrateId, use_white_ink: parentUseWhiteInk } = parentSubstrate || {};
    const printingSideNorm = (printingSide || '').toString().toLowerCase();
    const isSurfacePrint = printingSideNorm === 'surface';
    const isReversePrint = printingSideNorm === 'reverse';

    const [substrateTypes, setSubstrateTypes] = useState([]);
    const [surfaceQualities, setSurfaceQualities] = useState({});
    const [varnishTypes, setVarnishTypes] = useState([]);

    const [layers, setLayers] = useState(() => {
        const defaultLayers = getDefaultLayers(isSurfacePrint);
        
        // For reverse print, set whiteUndercoat based on condition's use_white_ink
        if (isReversePrint) {
            defaultLayers.whiteUndercoat.enabled = condition?.use_white_ink || false;
        }
        
        // For reverse print, inherit parent substrate info for printedSubstrate layer
        if (isReversePrint && !constructionDetails) {
            defaultLayers.printedSubstrate = {
                ...defaultLayers.printedSubstrate,
                type: parentSubstrateId,
                surfaceQuality: parentSubstrateSurfaceQuality?.id || null
            };
        }
        
        // For surface print, inherit white undercoat setting from parent substrate
        if (isSurfacePrint && !constructionDetails) {
            defaultLayers.whiteUndercoat.enabled = parentUseWhiteInk || false;
        }
        
        // Convert existing data to new format if needed and fix bgColor for laminate layers
        const mergedLayers = constructionDetails ? { ...defaultLayers, ...constructionDetails } : defaultLayers;
        
        // Ensure backward compatibility - convert typeId/surfaceQualityId to type/surfaceQuality
        Object.keys(mergedLayers).forEach(key => {
            const layer = mergedLayers[key];
            if (layer && typeof layer === 'object') {
                if (layer.typeId) {
                    layer.type = layer.typeId;
                    delete layer.typeId;
                }
                if (layer.surfaceQualityId) {
                    layer.surfaceQuality = layer.surfaceQualityId;
                    delete layer.surfaceQualityId;
                }
                // Force transparent background for printedSubstrate (laminate)
                if (key === 'printedSubstrate') {
                    layer.bgColor = 'transparent';
                }
            }
        });
        // Always ensure the ink label is "Color Ink"
        if (mergedLayers.ink) {
            mergedLayers.ink.label = 'Color Ink';
        }
        // Always ensure the whiteUndercoat label is correct
        if (mergedLayers.whiteUndercoat) {
            mergedLayers.whiteUndercoat.label = isSurfacePrint ? 'Use white ink base coat' : 'Use white ink backer';
        }
        return mergedLayers;
    });

    const controlsRef = useRef(null);
    const [layerBoxHeight, setLayerBoxHeight] = useState('auto');
    
    
    // Fetch substrate types, surface qualities, and varnish types
    useEffect(() => {
        const fetchSubstrateData = async () => {
            try {
                // Fetch substrate types
                const { data: typesData, error: typesError } = await supabase
                    .from('substrate_types')
                    .select('*')
                    .order('name');
                    
                if (typesError) throw typesError;
                setSubstrateTypes(typesData || []);
                
                // Fetch surface qualities for all substrate types
                const { data: qualitiesData, error: qualitiesError } = await supabase
                    .from('substrate_surface_qualities')
                    .select('*')
                    .order('name');
                    
                if (qualitiesError) throw qualitiesError;
                
                // Group surface qualities by substrate type
                const qualitiesByType = {};
                qualitiesData?.forEach(quality => {
                    if (!qualitiesByType[quality.substrate_type_id]) {
                        qualitiesByType[quality.substrate_type_id] = [];
                    }
                    qualitiesByType[quality.substrate_type_id].push(quality);
                });
                setSurfaceQualities(qualitiesByType);
                
                // Fetch varnish types
                const { data: varnishData, error: varnishError } = await supabase
                    .from('varnish_types')
                    .select('*')
                    .order('name');
                    
                if (varnishError) throw varnishError;
                setVarnishTypes(varnishData || []);
                
            } catch (error) {
                console.error('Error fetching substrate data:', error);
            }
        };
        
        fetchSubstrateData();
    }, []);
    
    // Auto-select Film type for surface print laminate when substrate types are loaded
    useEffect(() => {
        if (isSurfacePrint && substrateTypes.length > 0) {
            const filmType = substrateTypes.find(type => type.name === 'Film');
            if (filmType && layers.printedSubstrate && !layers.printedSubstrate.type) {
                setLayers(prev => ({
                    ...prev,
                    printedSubstrate: {
                        ...prev.printedSubstrate,
                        type: filmType.id
                    }
                }));
            }
        }
    }, [substrateTypes, isSurfacePrint, layers.printedSubstrate?.type]);

    useEffect(() => {
        const defaultLayers = getDefaultLayers(isSurfacePrint);
        
        // For reverse print, set whiteUndercoat based on condition's use_white_ink
        if (isReversePrint) {
            defaultLayers.whiteUndercoat.enabled = condition?.use_white_ink || false;
        }
        
        // For reverse print, inherit parent substrate info for printedSubstrate layer
        if (isReversePrint && !constructionDetails) {
            defaultLayers.printedSubstrate = {
                ...defaultLayers.printedSubstrate,
                type: parentSubstrateId,
                surfaceQuality: parentSubstrateSurfaceQuality?.id || null
            };
        }
        
        // For surface print, inherit white undercoat setting from parent substrate
        if (isSurfacePrint && !constructionDetails) {
            defaultLayers.whiteUndercoat.enabled = parentUseWhiteInk || false;
        }
        
        const mergedLayers = constructionDetails ? { ...defaultLayers, ...constructionDetails } : defaultLayers;
        
        // Ensure backward compatibility and fix display issues
        Object.keys(mergedLayers).forEach(key => {
            const layer = mergedLayers[key];
            if (layer && typeof layer === 'object') {
                // Convert old property names
                if (layer.typeId) {
                    layer.type = layer.typeId;
                    delete layer.typeId;
                }
                if (layer.surfaceQualityId) {
                    layer.surfaceQuality = layer.surfaceQualityId;
                    delete layer.surfaceQualityId;
                }
                // Force transparent background for printedSubstrate (laminate)
                if (key === 'printedSubstrate') {
                    layer.bgColor = 'transparent';
                }
            }
        });
        
        // Always ensure the ink label is "Color Ink"
        if (mergedLayers.ink) {
            mergedLayers.ink.label = 'Color Ink';
        }
        // Always ensure the whiteUndercoat label is correct
        if (mergedLayers.whiteUndercoat) {
            mergedLayers.whiteUndercoat.label = isSurfacePrint ? 'Use white ink base coat' : 'Use white ink backer';
        }
        setLayers(mergedLayers);
    }, [constructionDetails, isSurfacePrint, isReversePrint, parentSubstrateId, parentSubstrateSurfaceQuality, parentUseWhiteInk, condition?.use_white_ink]);

    useEffect(() => {
        onConstructionDetailsChange(layers);
    }, [layers, onConstructionDetailsChange]);


    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setLayerBoxHeight(entry.contentRect.height);
            }
        });

        if (controlsRef.current) {
            resizeObserver.observe(controlsRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    const handleCheckChange = (layerKey) => {
        setLayers(prev => ({
            ...prev,
            [layerKey]: { ...prev[layerKey], enabled: !prev[layerKey].enabled }
        }));
        if (!isNew) {
            setHasUnsavedChanges(true);
        }
    };

    const handleTypeChange = (layerKey, typeId) => {
        if (layerKey === 'varnish') {
            // For varnish, just update the type without affecting surface quality logic
            setLayers(prev => ({
                ...prev,
                [layerKey]: {
                    ...prev[layerKey],
                    type: typeId,
                }
            }));
        } else {
            // For substrate layers, reset surface quality when type changes
            const selectedType = substrateTypes.find(t => t.id === typeId);
            setLayers(prev => ({
                ...prev,
                [layerKey]: {
                    ...prev[layerKey],
                    type: typeId,
                    surfaceQuality: null, // Reset surface quality when type changes
                }
            }));
        }
        if (!isNew) {
            setHasUnsavedChanges(true);
        }
    };

    const handleSurfaceQualityChange = (layerKey, qualityId) => {
        setLayers(prev => ({
            ...prev,
            [layerKey]: {
                ...prev[layerKey],
                surfaceQuality: qualityId,
            }
        }));
        if (!isNew) {
            setHasUnsavedChanges(true);
        }
    };

    const isPrintedSubstrateRowDisabled = layers.baseSubstrate.label === 'Printed Substrate';

    const renderSurfacePrintStack = () => {
        const topLayers = [layers.varnish, layers.printedSubstrate].filter(l => l.enabled);
        const hasTopLayers = topLayers.length > 0;

        return (
            <>
                <div className="space-y-[-1px]">
                    {topLayers.map(layer => <ConstructionLayer key={layer.label} {...layer} />)}
                </div>

                {hasTopLayers && <Spacer />}

                <div className="space-y-[-1px]">
                    {layers.ink.enabled && <ConstructionLayer {...layers.ink} />}
                    {condition?.use_white_ink && <ConstructionLayer {...layers.whiteInk} />}
                </div>
            </>
        );
    };

    const renderReversePrintStack = () => (
        <div className="space-y-[-1px]">
            {layers.varnish.enabled && <ConstructionLayer {...layers.varnish} />}
            {layers.printedSubstrate.enabled && <ConstructionLayer {...layers.printedSubstrate} />}
            {layers.ink.enabled && <ConstructionLayer {...layers.ink} />}
            {condition?.use_white_ink && <ConstructionLayer {...layers.whiteInk} />}
        </div>
    );
    
    const anyLayerEnabled = Object.values(layers).some(l => l.enabled);
    const showBaseSpacer = (isPrintedSubstrateRowDisabled || layers.baseSubstrate.enabled) && anyLayerEnabled && !isSurfacePrint;

    const renderLayerControls = (layerKey, layerData) => {
        const isLaminateOrBase = layerKey === 'printedSubstrate' || layerKey === 'baseSubstrate';
        const isBaseSubstratePrinted = layerKey === 'baseSubstrate' && isPrintedSubstrateRowDisabled;
        const isPrintedSubstrateInheritedFromParent = layerKey === 'printedSubstrate' && isReversePrint;

        return (
            <React.Fragment key={layerKey}>
                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id={layerKey} 
                        checked={layerData.enabled} 
                        onCheckedChange={() => handleCheckChange(layerKey)} 
                        disabled={!canEditConstruction || isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent} 
                    />
                    <Label 
                        htmlFor={layerKey} 
                        className={cn((isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent) && "text-gray-400")}
                    >
                        {layerData.label}
                    </Label>
                </div>
                <Select
                    value={(() => {
                        if (isSurfacePrint && layerKey === 'printedSubstrate') {
                            // Force Film type for surface print laminate
                            const filmType = substrateTypes.find(type => type.name === 'Film');
                            return filmType?.id || "";
                        }
                        return isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent ? parentSubstrateId : layerData.type || "";
                    })()}
                    onValueChange={(value) => {
                        // Prevent changes to laminate type for surface print (must be Film)
                        if (isSurfacePrint && layerKey === 'printedSubstrate') {
                            return;
                        }
                        handleTypeChange(layerKey, value);
                    }}
                    disabled={!canEditConstruction || !layerData.enabled || isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent || (isSurfacePrint && layerKey === 'printedSubstrate')}
                >
                    <SelectTrigger className={cn("w-full", (isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent || (isSurfacePrint && layerKey === 'printedSubstrate')) && "text-gray-400 bg-gray-100")}>
                        <SelectValue placeholder={
                            isSurfacePrint && layerKey === 'printedSubstrate' ? "Film (Auto-selected)" :
                            (isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent) ? parentSubstrateName : "Select Type"
                        } />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-[100] border shadow-lg">
                        {(isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent) ? (
                            <SelectItem value={parentSubstrateId}>{parentSubstrateName}</SelectItem>
                        ) : isSurfacePrint && layerKey === 'printedSubstrate' ? (
                            // Only show Film type for surface print laminate
                            substrateTypes.filter(type => type.name === 'Film').map(type => 
                                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            )
                        ) : isLaminateOrBase ? (
                            substrateTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)
                        ) : (
                            <SelectItem value="type1">Type 1</SelectItem>
                        )}
                    </SelectContent>
                </Select>
                <Select
                    value={(isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent) ? parentSubstrateSurfaceQuality?.id : layerData.surfaceQuality || ""}
                    onValueChange={(value) => handleSurfaceQualityChange(layerKey, value)}
                    disabled={!canEditConstruction || !layerData.enabled || isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent || !isLaminateOrBase || (!layerData.type && !isPrintedSubstrateInheritedFromParent)}
                >
                    <SelectTrigger className={cn("w-full", (isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent) && "text-gray-400")}>
                        <SelectValue placeholder={(isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent) ? parentSubstrateSurfaceQuality?.name : "Select Quality"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-[100] border shadow-lg">
                        {(isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent) && parentSubstrateSurfaceQuality && (
                            <SelectItem value={parentSubstrateSurfaceQuality.id}>{parentSubstrateSurfaceQuality.name}</SelectItem>
                        )}
                        {isLaminateOrBase && layerData.type && surfaceQualities[layerData.type] && !(isBaseSubstratePrinted || isPrintedSubstrateInheritedFromParent) && 
                            surfaceQualities[layerData.type].map(quality => (
                                <SelectItem key={quality.id} value={quality.id}>{quality.name}</SelectItem>
                            ))
                        }
                        {!isLaminateOrBase && <SelectItem value="glossy">Glossy</SelectItem>}
                    </SelectContent>
                </Select>
            </React.Fragment>
        );
    };

    const title = isSurfacePrint ? 'Construction (Surface Print)' : 'Construction (Reverse Print)';

    return (
        <Card>
            <CardHeader
                title={title}
                onEdit={onEdit}
                onSave={onSave}
                onCancel={onCancel}
                showEdit={!isNew}
                isEditing={isEditing}
                canSave={true}
            />
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start pt-4">
                <div ref={controlsRef} className="md:col-span-2 grid grid-cols-[1fr_1fr_1fr] gap-x-6 gap-y-1 items-center">
                    
                    {/* Header Row */}
                    <Label className="text-sm font-medium text-gray-700">Layer</Label>
                    <Label className="text-sm font-medium text-gray-700">Type</Label>
                    <Label className="text-sm font-medium text-gray-700">Surface Quality</Label>

                    {/* Varnish Row */}
                    <div className="flex items-center space-x-2 min-h-[2.5rem]">
                        <Checkbox 
                            id="varnish" 
                            checked={layers.varnish.enabled} 
                            onCheckedChange={() => handleCheckChange('varnish')} 
                            disabled={!canEditConstruction} 
                        />
                        <Label htmlFor="varnish" className="cursor-pointer">
                            {layers.varnish.label}
                        </Label>
                    </div>
                    <div className="min-h-[2.5rem] flex items-center">
                        <Select
                            value={layers.varnish.type || ""}
                            onValueChange={(value) => handleTypeChange('varnish', value)}
                            disabled={!canEditConstruction || !layers.varnish.enabled}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100] border shadow-lg">
                                {varnishTypes.map(type => (
                                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="min-h-[2.5rem] flex items-center">
                        <Select
                            value={layers.varnish.surfaceQuality || ""}
                            onValueChange={(value) => handleSurfaceQualityChange('varnish', value)}
                            disabled={!canEditConstruction || !layers.varnish.enabled}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Quality" />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100] border shadow-lg">
                                <SelectItem value="glossy">Glossy</SelectItem>
                                <SelectItem value="matte">Matte</SelectItem>
                                <SelectItem value="satin">Satin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Printed Substrate Row */}
                    <div className="flex items-center space-x-2 min-h-[2.5rem]">
                        <Checkbox 
                            id="printedSubstrate" 
                            checked={layers.printedSubstrate.enabled} 
                            onCheckedChange={() => handleCheckChange('printedSubstrate')} 
                            disabled={!canEditConstruction || (isReversePrint)} 
                        />
                        <Label 
                            htmlFor="printedSubstrate" 
                            className={cn("cursor-pointer", isReversePrint && "text-gray-400")}
                        >
                            {layers.printedSubstrate.label}
                        </Label>
                    </div>
                    <div className="min-h-[2.5rem] flex items-center">
                        <Select
                            value={(() => {
                                if (isReversePrint) return parentSubstrateId;
                                if (isSurfacePrint) {
                                    // Force Film type for surface print laminate
                                    const filmType = substrateTypes.find(type => type.name === 'Film');
                                    return filmType?.id || "";
                                }
                                return layers.printedSubstrate.type || "";
                            })()}
                            onValueChange={(value) => {
                                // Prevent changes to laminate type for surface print (must be Film)
                                if (isSurfacePrint) return;
                                handleTypeChange('printedSubstrate', value);
                            }}
                            disabled={!canEditConstruction || !layers.printedSubstrate.enabled || isReversePrint || isSurfacePrint}
                        >
                            <SelectTrigger className={cn("w-full", (isReversePrint || isSurfacePrint) && "text-gray-400 bg-gray-100")}>
                                <SelectValue placeholder={
                                    isReversePrint ? parentSubstrateName : 
                                    isSurfacePrint ? "Film (Auto-selected)" : 
                                    "Select Type"
                                } />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100] border shadow-lg">
                                {isReversePrint ? (
                                    <SelectItem value={parentSubstrateId}>{parentSubstrateName}</SelectItem>
                                ) : isSurfacePrint ? (
                                    // Only show Film type for surface print laminate
                                    substrateTypes.filter(type => type.name === 'Film').map(type => 
                                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                    )
                                ) : (
                                    substrateTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="min-h-[2.5rem] flex items-center">
                        <Select
                            value={(() => {
                                if (isReversePrint) {
                                    return parentSubstrateSurfaceQuality?.id != null ? String(parentSubstrateSurfaceQuality.id) : "";
                                }
                                return layers.printedSubstrate.surfaceQuality ? String(layers.printedSubstrate.surfaceQuality) : "";
                            })()}
                            onValueChange={(value) => handleSurfaceQualityChange('printedSubstrate', value)}
                            disabled={(() => {
                                if (!canEditConstruction || !layers.printedSubstrate.enabled || isReversePrint) return true;
                                
                                // For surface print, get the auto-selected Film type
                                if (isSurfacePrint) {
                                    const filmType = substrateTypes.find(type => type.name === 'Film');
                                    return !filmType; // Enable if Film type exists
                                }
                                
                                // For other cases, check if type is selected
                                return !layers.printedSubstrate.type;
                            })()}
                        >
                            <SelectTrigger className={cn("w-full", isReversePrint && "text-gray-400")}>
                                {(() => {
                                    if (isReversePrint) {
                                        return parentSubstrateSurfaceQuality?.name ? (
                                            <span>{parentSubstrateSurfaceQuality.name}</span>
                                        ) : (
                                            <SelectValue placeholder="Select Quality" />
                                        );
                                    }
                                    
                                    // For surface print, use Film type to find surface qualities
                                    const typeId = isSurfacePrint 
                                        ? substrateTypes.find(type => type.name === 'Film')?.id 
                                        : layers.printedSubstrate.type;
                                    
                                    const currentValue = layers.printedSubstrate.surfaceQuality ? String(layers.printedSubstrate.surfaceQuality) : "";
                                    const label = typeId && surfaceQualities[typeId]
                                        ? surfaceQualities[typeId].find(q => String(q.id) === currentValue)?.name
                                        : undefined;
                                    
                                    return label ? (
                                        <span>{label}</span>
                                    ) : (
                                        <SelectValue placeholder="Select Quality" />
                                    );
                                })()}
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100] border shadow-lg">
                                {isReversePrint && parentSubstrateSurfaceQuality ? (
                                    <SelectItem value={String(parentSubstrateSurfaceQuality.id)}>{parentSubstrateSurfaceQuality.name}</SelectItem>
                                ) : (() => {
                                    // For surface print, use Film type to find surface qualities
                                    const typeId = isSurfacePrint 
                                        ? substrateTypes.find(type => type.name === 'Film')?.id 
                                        : layers.printedSubstrate.type;
                                    
                                    return typeId && surfaceQualities[typeId] ? 
                                        surfaceQualities[typeId].map(quality => (
                                            <SelectItem key={quality.id} value={String(quality.id)}>{quality.name}</SelectItem>
                                        )) : null;
                                })()}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* White Undercoat Row */}
                    <div 
                        className="flex items-center space-x-2 min-h-[2.5rem]"
                        style={{
                          opacity: isReversePrint ? 1 : 0.5,
                          pointerEvents: isReversePrint ? 'auto' : 'none'
                        }}
                    >
                        <Checkbox 
                            id="white-undercoat" 
                            checked={parentUseWhiteInk || false} 
                            onCheckedChange={(checked) => {
                                if (!lockWhiteUndercoat && isReversePrint && canEditConstruction) {
                                    onConditionChange({ ...condition, use_white_ink: checked });
                                    if (!isNew && setHasUnsavedChanges) setHasUnsavedChanges(true);
                                }
                            }}
                            disabled={!canEditConstruction || lockWhiteUndercoat || isSurfacePrint}
                        />
                        <Label 
                            htmlFor="white-undercoat" 
                            className={cn("cursor-pointer", isSurfacePrint && "text-gray-400")}
                        >
                            {layers.whiteUndercoat.label}
                        </Label>
                    </div>
                    <div className="min-h-[2.5rem]"></div>
                    <div className="min-h-[2.5rem]"></div>


                    {/* Base Substrate Row */}
                    <div className="flex items-center space-x-2 min-h-[2.5rem]">
                        <Checkbox 
                            id="baseSubstrate" 
                            checked={isPrintedSubstrateRowDisabled || layers.baseSubstrate.enabled} 
                            onCheckedChange={() => handleCheckChange('baseSubstrate')} 
                            disabled={!canEditConstruction || isPrintedSubstrateRowDisabled} 
                        />
                        <Label 
                            htmlFor="baseSubstrate" 
                            className={cn("cursor-pointer", isPrintedSubstrateRowDisabled && "text-gray-400")}
                        >
                            {layers.baseSubstrate.label}
                        </Label>
                    </div>
                    <div className="min-h-[2.5rem] flex items-center">
                        <Select
                            value={isPrintedSubstrateRowDisabled ? parentSubstrateId : layers.baseSubstrate.type || ""}
                            onValueChange={(value) => handleTypeChange('baseSubstrate', value)}
                            disabled={!canEditConstruction || !(isPrintedSubstrateRowDisabled || layers.baseSubstrate.enabled) || isPrintedSubstrateRowDisabled}
                        >
                            <SelectTrigger className={cn("w-full", isPrintedSubstrateRowDisabled && "text-gray-400")}>
                                <SelectValue placeholder={isPrintedSubstrateRowDisabled ? parentSubstrateName : "Select Type"} />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100] border shadow-lg">
                                {isPrintedSubstrateRowDisabled ? (
                                    <SelectItem value={parentSubstrateId}>{parentSubstrateName}</SelectItem>
                                ) : (
                                    substrateTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="min-h-[2.5rem] flex items-center">
                        <Select
                            value={isPrintedSubstrateRowDisabled ? (parentSubstrateSurfaceQuality?.id != null ? String(parentSubstrateSurfaceQuality.id) : "") : (layers.baseSubstrate.surfaceQuality ? String(layers.baseSubstrate.surfaceQuality) : "")}
                            onValueChange={(value) => handleSurfaceQualityChange('baseSubstrate', value)}
                            disabled={!canEditConstruction || !(isPrintedSubstrateRowDisabled || layers.baseSubstrate.enabled) || isPrintedSubstrateRowDisabled || (!layers.baseSubstrate.type && !isPrintedSubstrateRowDisabled)}
                        >
                            <SelectTrigger className={cn("w-full", isPrintedSubstrateRowDisabled && "text-gray-400")}>
                                {(() => {
                                    const currentValue = isPrintedSubstrateRowDisabled
                                        ? (parentSubstrateSurfaceQuality?.id != null ? String(parentSubstrateSurfaceQuality.id) : "")
                                        : (layers.baseSubstrate.surfaceQuality ? String(layers.baseSubstrate.surfaceQuality) : "");
                                    const label = isPrintedSubstrateRowDisabled
                                        ? parentSubstrateSurfaceQuality?.name
                                        : (layers.baseSubstrate.type && surfaceQualities[layers.baseSubstrate.type]
                                            ? surfaceQualities[layers.baseSubstrate.type].find(q => String(q.id) === currentValue)?.name
                                            : undefined);
                                    return label ? (
                                        <span>{label}</span>
                                    ) : (
                                        <SelectValue placeholder={"Select Quality"} />
                                    );
                                })()}
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100] border shadow-lg">
                                {isPrintedSubstrateRowDisabled && parentSubstrateSurfaceQuality ? (
                                    <SelectItem value={parentSubstrateSurfaceQuality.id}>{parentSubstrateSurfaceQuality.name}</SelectItem>
                                ) : (
                                    layers.baseSubstrate.type && surfaceQualities[layers.baseSubstrate.type] &&
                                    surfaceQualities[layers.baseSubstrate.type].map(quality => (
                                        <SelectItem key={quality.id} value={quality.id}>{quality.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div 
                    className="w-full max-w-xs mx-auto bg-gray-200 p-4 border border-gray-300 flex flex-col justify-center"
                    style={{ height: layerBoxHeight }}
                >
                    <AnimatePresence>
                         {isSurfacePrint ? renderSurfacePrintStack() : renderReversePrintStack()}
                    </AnimatePresence>
                     <AnimatePresence>
                        {(isPrintedSubstrateRowDisabled || layers.baseSubstrate.enabled) && (
                            <motion.div
                                layout
                                className={cn(showBaseSpacer && "mt-4")}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <ConstructionLayer 
                                    {...layers.baseSubstrate}
                                    bgColor={construction?.hex || layers.baseSubstrate.bgColor}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
};

export default ConstructionPanel;
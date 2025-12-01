import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Plus, Trash2, Edit2, X, Check, GripHorizontal, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { ChromePicker } from 'react-color';

import { useProfile } from '@/context/ProfileContext';
import { useQualitySetDetails } from '@/hooks/useQualitySetDetails';
import { getDeltaEOptions } from '@/lib/constants/deltaEMethods';
import { Card, CardContent, CardHeader as CardHeaderUI, CardTitle } from '@/components/ui/card';
import CardHeader from '@/components/admin/my-company/CardHeader';
import QualitySetDetailHeader from '@/components/quality-sets/QualitySetDetailHeader';

const RequiredLabel = ({ children, value }) => (
  <div className="flex items-center gap-2">
    <span>{children}</span>
    {!value && <span className="text-red-500 text-xs">(required)</span>}
  </div>
);

const RuleCard = ({ rule, index, onUpdate, onAddLevel, onDelete, onRemoveLevel, measurementSettings, isEditing, canDelete }) => {
  const [colorPickerOpen, setColorPickerOpen] = useState({});
  const [colorPickerPosition, setColorPickerPosition] = useState({});
  const [isDragging, setIsDragging] = useState({});
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isInsertMode, setIsInsertMode] = useState(false);

  const toggleColorPicker = (levelIndex) => {
    setColorPickerOpen(prev => ({ 
      ...prev, 
      [levelIndex]: !prev[levelIndex] 
    }));
  };

  const handleColorChange = (color, levelIndex) => {
    const newLevels = [...rule.levels];
    newLevels[levelIndex].display_color = color.hex;
    onUpdate({...rule, levels: newLevels});
  };

  const handleColorPickerMouseDown = (e, levelIndex) => {
    if (!e.target.closest('.color-picker-drag-handle')) return;
    
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging({ ...isDragging, [levelIndex]: true });
  };

  const handleColorPickerMouseMove = (e, levelIndex) => {
    if (!isDragging[levelIndex]) return;
    
    e.preventDefault();
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    setColorPickerPosition({
      ...colorPickerPosition,
      [levelIndex]: { x: newX, y: newY }
    });
  };

  const handleColorPickerMouseUp = (levelIndex) => {
    setIsDragging({ ...isDragging, [levelIndex]: false });
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      Object.keys(isDragging).forEach(levelIndex => {
        if (isDragging[levelIndex]) {
          handleColorPickerMouseMove(e, levelIndex);
        }
      });
    };

    const handleGlobalMouseUp = () => {
      Object.keys(isDragging).forEach(levelIndex => {
        if (isDragging[levelIndex]) {
          handleColorPickerMouseUp(levelIndex);
        }
      });
    };

    if (Object.values(isDragging).some(v => v)) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  return (
    <Card className="mb-4 h-auto">
      <CardHeaderUI className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-md font-semibold">Rule {index + 1}</CardTitle>
          {isEditing && (
            <button
              onClick={() => onDelete(index)}
              disabled={!canDelete}
              className={`text-sm font-bold hover:underline ${
                canDelete 
                  ? 'text-red-600 hover:text-red-800' 
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Remove
            </button>
          )}
        </div>
      </CardHeaderUI>
      <CardContent className="pt-0 pb-6">
        <div>
          <Label htmlFor={`target-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
            <RequiredLabel value={rule.reference}>Target</RequiredLabel>
          </Label>
          <Select value={rule.reference} onValueChange={(value) => onUpdate({ ...rule, reference: value })} disabled={!isEditing}>
            <SelectTrigger id={`target-${index}`}>
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Reference Solid">Reference Solid</SelectItem>
              <SelectItem value="Average Matched Solid">Average Matched Solid</SelectItem>
              <SelectItem value="From Ink 50% Tint">From Ink 50% Tint</SelectItem>
              <SelectItem value="From Ink Substrate">From Ink Substrate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-6">
          <div className="grid grid-cols-12 gap-x-6 text-sm font-medium text-gray-500 mb-2">
            <div className="col-span-2">Level Range</div>
            <div className="col-span-4 ml-12">Level Name</div>
            <div className="col-span-3">Level Action</div>
            <div className="col-span-2 text-center">Display Color</div>
            <div className="col-span-1"></div>
          </div>
          
          <AnimatePresence>
            {isEditing && isInsertMode ? (
              <motion.div key="insert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {[...Array(rule.levels.length + 1)].map((_, insertIndex) => (
                  <motion.div
                    key={`insert-and-level-${insertIndex}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: insertIndex * 0.05 }}
                  >
                    {/* Insertion bar */}
                    <div
                      className="group cursor-pointer py-2 -mx-4 px-4 transition-all"
                      onClick={() => {
                        onAddLevel(index, insertIndex);
                        setIsInsertMode(false);
                      }}
                    >
                      <div className="h-0.5 bg-primary/30 group-hover:h-1 group-hover:bg-primary transition-all rounded-full" />
                      <div className="text-xs text-primary text-center opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        Insert level here
                      </div>
                    </div>

                    {/* Level row (if exists) */}
                    {insertIndex < rule.levels.length && (
                      <div className="grid grid-cols-12 gap-x-6 items-center mb-3">
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Input 
                            type="number" 
                            value={rule.levels[insertIndex].range_from} 
                            className="w-20 text-center text-sm h-8 [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto" 
                            disabled={!isEditing}
                            onChange={(e) => {
                              const newLevels = [...rule.levels];
                              newLevels[insertIndex].range_from = parseFloat(e.target.value) || 0;
                              onUpdate({...rule, levels: newLevels});
                            }} 
                          />
                          <span className="text-gray-500 text-sm">&lt;</span>
                          <Input 
                            value={rule.levels[insertIndex].range_to === null ? 'open' : rule.levels[insertIndex].range_to} 
                            className="w-20 text-center text-sm h-8 [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto" 
                            disabled={!isEditing}
                            onChange={(e) => {
                               const newLevels = [...rule.levels];
                               newLevels[insertIndex].range_to = e.target.value === 'open' ? null : parseFloat(e.target.value) || 0;
                               onUpdate({...rule, levels: newLevels});
                            }}
                          />
                        </div>
                        <div className="col-span-4 ml-12">
                          <Input 
                            value={rule.levels[insertIndex].name} 
                            className={`h-8 ${!rule.levels[insertIndex].name?.trim() ? 'border-red-300' : ''}`}
                            placeholder="Enter level name"
                            disabled={!isEditing}
                            onChange={(e) => {
                              const newLevels = [...rule.levels];
                              newLevels[insertIndex].name = e.target.value;
                              onUpdate({...rule, levels: newLevels});
                            }}
                          />
                        </div>
                        <div className="col-span-3">
                          <Select 
                            value={rule.levels[insertIndex].action} 
                            onValueChange={(value) => {
                              const newLevels = [...rule.levels];
                              newLevels[insertIndex].action = value;
                              onUpdate({...rule, levels: newLevels});
                            }}
                            disabled={!isEditing}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Auto-approve">Auto-approve</SelectItem>
                              <SelectItem value="Review">Review</SelectItem>
                              <SelectItem value="Auto-reject">Auto-reject</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 relative flex justify-center">
                          <button
                            type="button"
                            className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ backgroundColor: rule.levels[insertIndex].display_color || '#6B7280' }}
                            onClick={() => isEditing && toggleColorPicker(insertIndex)}
                            disabled={!isEditing}
                          />
                          {colorPickerOpen[insertIndex] && isEditing && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => toggleColorPicker(insertIndex)}
                              />
                              <div 
                                className="fixed z-50 bg-white shadow-2xl rounded-lg border border-border"
                                style={{
                                  left: colorPickerPosition[insertIndex]?.x ? `${colorPickerPosition[insertIndex].x}px` : 'auto',
                                  top: colorPickerPosition[insertIndex]?.y ? `${colorPickerPosition[insertIndex].y}px` : 'auto',
                                  right: !colorPickerPosition[insertIndex] ? '20px' : 'auto',
                                  bottom: !colorPickerPosition[insertIndex] ? '20px' : 'auto',
                                  cursor: isDragging[insertIndex] ? 'grabbing' : 'default'
                                }}
                                onMouseDown={(e) => handleColorPickerMouseDown(e, insertIndex)}
                              >
                                <div className="color-picker-drag-handle bg-muted/50 py-1.5 rounded-t-lg cursor-grab hover:bg-muted flex items-center justify-center select-none">
                                  <GripHorizontal className="h-4 w-4 text-muted-foreground" />
                                </div>
                                
                                <div className="p-3">
                                  <ChromePicker
                                    color={rule.levels[insertIndex].display_color || '#6B7280'}
                                    onChange={(color) => handleColorChange(color, insertIndex)}
                                    disableAlpha={true}
                                  />
                                  <Button
                                    type="button"
                                    onClick={() => toggleColorPicker(insertIndex)}
                                    className="mt-3 w-full"
                                    size="sm"
                                  >
                                    Done
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {isEditing && rule.levels.length > 2 && (
                            <button
                              onClick={() => onRemoveLevel(index, insertIndex)}
                              className="text-sm font-bold hover:underline text-gray-400 hover:text-gray-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                <div className="flex items-center justify-between mt-4 p-3 bg-muted/30 rounded-lg border border-muted">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>Choose where to insert new level</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsInsertMode(false)}
                  >
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="static"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {rule.levels.map((level, levelIndex) => (
                <div key={level.id || levelIndex} className="grid grid-cols-12 gap-x-6 items-center mb-3">
                  <div className="col-span-2 flex items-center gap-1.5">
                    <Input 
                      type="number" 
                      value={level.range_from} 
                      className="w-20 text-center text-sm h-8 [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto" 
                      disabled={!isEditing}
                      onChange={(e) => {
                        const newLevels = [...rule.levels];
                        newLevels[levelIndex].range_from = parseFloat(e.target.value) || 0;
                        onUpdate({...rule, levels: newLevels});
                      }} 
                    />
                    <span className="text-gray-500 text-sm">&lt;</span>
                    <Input 
                      value={level.range_to === null ? 'open' : level.range_to} 
                      className="w-20 text-center text-sm h-8 [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto" 
                      disabled={!isEditing}
                      onChange={(e) => {
                         const newLevels = [...rule.levels];
                         newLevels[levelIndex].range_to = e.target.value === 'open' ? null : parseFloat(e.target.value) || 0;
                         onUpdate({...rule, levels: newLevels});
                      }}
                    />
                  </div>
                  <div className="col-span-4 ml-12">
                    <Input 
                      value={level.name} 
                      className={`h-8 ${!level.name?.trim() ? 'border-red-300' : ''}`}
                      placeholder="Enter level name"
                      disabled={!isEditing}
                      onChange={(e) => {
                        const newLevels = [...rule.levels];
                        newLevels[levelIndex].name = e.target.value;
                        onUpdate({...rule, levels: newLevels});
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <Select 
                      value={level.action} 
                      onValueChange={(value) => {
                        const newLevels = [...rule.levels];
                        newLevels[levelIndex].action = value;
                        onUpdate({...rule, levels: newLevels});
                      }}
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Auto-approve">Auto-approve</SelectItem>
                        <SelectItem value="Review">Review</SelectItem>
                        <SelectItem value="Auto-reject">Auto-reject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 relative flex justify-center">
                    <button
                      type="button"
                      className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: level.display_color || '#6B7280' }}
                      onClick={() => isEditing && toggleColorPicker(levelIndex)}
                      disabled={!isEditing}
                    />
                    {colorPickerOpen[levelIndex] && isEditing && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => toggleColorPicker(levelIndex)}
                        />
                        <div 
                          className="fixed z-50 bg-white shadow-2xl rounded-lg border border-border"
                          style={{
                            left: colorPickerPosition[levelIndex]?.x ? `${colorPickerPosition[levelIndex].x}px` : 'auto',
                            top: colorPickerPosition[levelIndex]?.y ? `${colorPickerPosition[levelIndex].y}px` : 'auto',
                            right: !colorPickerPosition[levelIndex] ? '20px' : 'auto',
                            bottom: !colorPickerPosition[levelIndex] ? '20px' : 'auto',
                            cursor: isDragging[levelIndex] ? 'grabbing' : 'default'
                          }}
                          onMouseDown={(e) => handleColorPickerMouseDown(e, levelIndex)}
                        >
                          <div className="color-picker-drag-handle bg-muted/50 py-1.5 rounded-t-lg cursor-grab hover:bg-muted flex items-center justify-center select-none">
                            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          <div className="p-3">
                            <ChromePicker
                              color={level.display_color || '#6B7280'}
                              onChange={(color) => handleColorChange(color, levelIndex)}
                              disableAlpha={true}
                            />
                            <Button
                              type="button"
                              onClick={() => toggleColorPicker(levelIndex)}
                              className="mt-3 w-full"
                              size="sm"
                            >
                              Done
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {isEditing && rule.levels.length > 2 && (
                      <button
                        onClick={() => onRemoveLevel(index, levelIndex)}
                        className="text-sm font-bold hover:underline text-gray-400 hover:text-gray-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isEditing && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-1" 
                  onClick={() => setIsInsertMode(true)}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add level
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
};

const QualitySetDetail = () => {
  const { qualitySetId } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const isNew = qualitySetId === 'new';
  
  // Use React Query for data fetching
  const { data: qualitySetData, isLoading: qualitySetLoading, error: qualitySetError } = useQualitySetDetails(!isNew ? qualitySetId : null);
  
  const [qualitySet, setQualitySet] = useState(null);
  const [originalQualitySet, setOriginalQualitySet] = useState(null);
  const [measurementSettings, setMeasurementSettings] = useState({
    mode: 'M1',
    illuminant: 'D50', 
    observer: '2',
    table: '5',
    deltaE: 'dE76'
  });
  const [organization, setOrganization] = useState(null);
  const [standards, setStandards] = useState({
    illuminants: [],
    observers: [],
    astmTables: [],
    loading: true
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Page-level edit state (for new quality sets)
  const [isEditing, setIsEditing] = useState(isNew);
  
  // Card-level edit states (for existing quality sets)
  const [isEditingColorSettings, setIsEditingColorSettings] = useState(false);
  const [isEditingRules, setIsEditingRules] = useState(false);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Track original state for each card
  const [originalColorSettings, setOriginalColorSettings] = useState(null);
  const [originalRules, setOriginalRules] = useState(null);

  // Load reference data and organization in parallel
  useEffect(() => {
    const fetchData = async () => {
      try {
        const promises = [
          supabase.from('illuminants').select('*').order('name'),
          supabase.from('observers').select('*').order('name'),
          supabase.from('astm_e308_tables').select('*').order('table_number')
        ];

        // Add organization fetch if needed
        if (profile?.organization_id) {
          promises.push(
            supabase
              .from('organizations')
              .select('*')
              .eq('id', profile.organization_id)
              .single()
          );
        }

        const results = await Promise.all(promises);
        const [illuminantsRes, observersRes, astmTablesRes, orgRes] = results;

        setStandards({
          illuminants: illuminantsRes.data || [],
          observers: observersRes.data || [],
          astmTables: astmTablesRes.data || [],
          loading: false
        });

        if (orgRes?.data) {
          setOrganization(orgRes.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setStandards(prev => ({ ...prev, loading: false }));
      }
    };

    fetchData();
  }, [profile?.organization_id]);

  // Handle quality set initialization
  useEffect(() => {
    if (isNew) {
      // For new quality sets, initialize immediately with defaults
      const getDefaults = () => ({
        mode: organization?.default_measurement_mode || 'M1',
        illuminant: organization?.default_illuminant || 'D50',
        observer: organization?.default_observer || '2', 
        table: organization?.default_astm_table || '5',
        deltaE: organization?.default_delta_e || 'dE76'
      });

      setMeasurementSettings(getDefaults());

      const newQualitySet = {
        name: '',
        rules: [
          {
            name: 'Reference Solid',
            reference: 'Reference Solid',
            levels: [
              { range_from: 0.00, range_to: 3.00, name: 'Pass', action: 'Auto-approve', display_color: '#10B981' },
              { range_from: 3.00, range_to: null, name: 'Fail', action: 'Review', display_color: '#EF4444' },
            ],
          },
        ],
      };
      setQualitySet(newQualitySet);
      setOriginalQualitySet(newQualitySet);
    } else if (qualitySetData) {
      // For existing quality sets, use fetched data
      setQualitySet(qualitySetData);
      setOriginalQualitySet(qualitySetData);
      
      // Set measurement settings from quality set or organization defaults
      if (qualitySetData.measurement_settings) {
        setMeasurementSettings(qualitySetData.measurement_settings);
        setOriginalColorSettings({
          name: qualitySetData.name,
          measurementSettings: qualitySetData.measurement_settings
        });
      } else {
        const defaults = {
          mode: organization?.default_measurement_mode || 'M1',
          illuminant: organization?.default_illuminant || 'D50',
          observer: organization?.default_observer || '2', 
          table: organization?.default_astm_table || '5',
          deltaE: organization?.default_delta_e || 'dE76'
        };
        setMeasurementSettings(defaults);
        setOriginalColorSettings({
          name: qualitySetData.name,
          measurementSettings: defaults
        });
      }
      
      // Store original rules
      setOriginalRules(qualitySetData.rules);
    } else if (qualitySetError) {
      toast({ title: "Error", description: qualitySetError.message, variant: "destructive" });
      navigate('/quality-sets');
    }
  }, [isNew, qualitySetData, qualitySetError, organization, navigate]);

  const handleUpdateRule = (updatedRule, index) => {
    const newRules = [...qualitySet.rules];
    newRules[index] = updatedRule;
    setQualitySet({ ...qualitySet, rules: newRules });
    setHasUnsavedChanges(true);
  };

  const handleRemoveLevel = (ruleIndex, levelIndex) => {
    const newRules = [...qualitySet.rules];
    
    // Ensure minimum 2 levels
    if (newRules[ruleIndex].levels.length <= 2) {
      toast({ title: "Cannot Remove Level", description: "A rule must have at least 2 levels", variant: "destructive" });
      return;
    }
    
    // Remove the level
    newRules[ruleIndex].levels.splice(levelIndex, 1);
    
    setQualitySet({ ...qualitySet, rules: newRules });
    setHasUnsavedChanges(true);
    toast({ title: "Level Removed", description: "The level has been removed successfully" });
  };

  const handleAddLevel = (ruleIndex, insertAtIndex = null) => {
    const newRules = [...qualitySet.rules];
    const newLevel = { 
      range_from: '', 
      range_to: null, 
      name: 'New Level', 
      action: 'Auto-approve',
      display_color: '#6B7280'
    };
    
    // Determine actual insertion index
    const insertIndex = insertAtIndex !== null ? insertAtIndex : newRules[ruleIndex].levels.length;
    const isLastPosition = insertIndex === newRules[ruleIndex].levels.length;
    
    // Auto-populate range_from based on previous level
    if (insertIndex > 0) {
      const prevLevel = newRules[ruleIndex].levels[insertIndex - 1];
      newLevel.range_from = prevLevel.range_to || '';
      
      // If inserting at the end, set range_to to null (open)
      if (isLastPosition) {
        newLevel.range_to = null; // This will display as "open"
        prevLevel.range_to = ''; // Reset previous level's range_to
      } else {
        // If inserting in the middle, keep range_to null initially
        prevLevel.range_to = newLevel.range_from; // Update previous level
      }
    } else if (isLastPosition && newRules[ruleIndex].levels.length === 0) {
      // First level being added - set range_to to null
      newLevel.range_to = null;
    }
    
    // Insert at specific position
    newRules[ruleIndex].levels.splice(insertIndex, 0, newLevel);
    
    setQualitySet({ ...qualitySet, rules: newRules });
    setHasUnsavedChanges(true);
  };
  
  const handleAddRule = () => {
    const newRules = [...qualitySet.rules, {
      name: 'Reference Solid',
      reference: 'Reference Solid',
      levels: [{ range_from: 0.00, range_to: null, name: 'Pass', action: 'Auto-approve', display_color: '#10B981' }],
    }];
    setQualitySet({ ...qualitySet, rules: newRules });
    setHasUnsavedChanges(true);
  };

  const handleDeleteRule = (ruleIndex) => {
    if (qualitySet.rules.length <= 1) {
      toast({
        title: 'Cannot delete rule',
        description: 'A quality set must have at least one rule.',
        variant: 'destructive',
      });
      return;
    }
    
    const newRules = qualitySet.rules.filter((_, index) => index !== ruleIndex);
    setQualitySet({ ...qualitySet, rules: newRules });
    setHasUnsavedChanges(true);
  };
  
  const handleSaveNew = async () => {
    if (!qualitySet.name?.trim()) {
      toast({
        title: 'Name is required',
        description: 'Please enter a name for the quality set.',
        variant: 'destructive',
      });
      return;
    }

    // Validate that all rules have required fields and all levels have names
    const validationErrors = [];
    qualitySet.rules.forEach((rule, ruleIndex) => {
      if (!rule.reference) {
        validationErrors.push(`Rule ${ruleIndex + 1}: Target is required`);
      }
      rule.levels.forEach((level, levelIndex) => {
        if (!level.name?.trim()) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Level name is required`);
        }
        if (level.range_from === '' || level.range_from === null || level.range_from === undefined) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Range from is required`);
        }
        if (!level.action) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Action is required`);
        }
      });
    });

    if (validationErrors.length > 0) {
      toast({
        title: 'Validation Error',
        description: validationErrors[0], // Show first error
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const rulesWithNames = qualitySet.rules.map((rule, idx) => ({
        ...rule,
        name: (rule.name && rule.name.trim()) ? rule.name.trim() : `${rule.reference || 'Rule'}`.trim(),
        levels: rule.levels.map(level => ({
          ...level,
          range_from: typeof level.range_from === 'string' ? parseFloat(level.range_from) || 0 : level.range_from,
          range_to: level.range_to === null ? null : (typeof level.range_to === 'string' ? parseFloat(level.range_to) || 0 : level.range_to)
        }))
      }));

      const payload = { 
        ...qualitySet,
        rules: rulesWithNames,
        organization_id: profile?.organization_id,
        measurement_settings: measurementSettings
      };

      console.log('🎯 Creating quality set with restructured RPC function. Payload:', payload);

      const { error } = await supabase.rpc('upsert_quality_set_with_details', { payload });

      if (error) {
        console.error('❌ RPC Error during creation:', error);
        throw error;
      }

      console.log('✅ Quality Set created successfully!');
      toast({ title: 'Success!', description: 'Quality Set created successfully.' });
      navigate('/quality-sets');
    } catch (error) {
      console.error('❌ Error creating quality set:', error);
      toast({ title: 'Error creating quality set', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUpdate = async () => {
    if (!qualitySet.name?.trim()) {
      toast({
        title: 'Name is required',
        description: 'Please enter a name for the quality set.',
        variant: 'destructive',
      });
      return;
    }

    // Validate that all rules have required fields and all levels have names
    const validationErrors = [];
    qualitySet.rules.forEach((rule, ruleIndex) => {
      if (!rule.reference) {
        validationErrors.push(`Rule ${ruleIndex + 1}: Target is required`);
      }
      rule.levels.forEach((level, levelIndex) => {
        if (!level.name?.trim()) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Level name is required`);
        }
        if (level.range_from === '' || level.range_from === null || level.range_from === undefined) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Range from is required`);
        }
        if (!level.action) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Action is required`);
        }
      });
    });

    if (validationErrors.length > 0) {
      toast({
        title: 'Validation Error',
        description: validationErrors[0], // Show first error
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const rulesWithNames = qualitySet.rules.map((rule, idx) => ({
        ...rule,
        name: (rule.name && rule.name.trim()) ? rule.name.trim() : `${rule.reference || 'Rule'}`.trim(),
        levels: rule.levels.map(level => ({
          ...level,
          range_from: typeof level.range_from === 'string' ? parseFloat(level.range_from) || 0 : level.range_from,
          range_to: level.range_to === null ? null : (typeof level.range_to === 'string' ? parseFloat(level.range_to) || 0 : level.range_to)
        }))
      }));

      const payload = { 
        ...qualitySet,
        rules: rulesWithNames,
        measurement_settings: measurementSettings
      };

      console.log('🎯 Updating quality set with restructured RPC function. Payload:', payload);

      const { error } = await supabase.rpc('upsert_quality_set_with_details', { payload });

      if (error) {
        console.error('❌ RPC Error during update:', error);
        throw error;
      }

      console.log('✅ Quality Set updated successfully!');
      toast({ title: 'Success!', description: 'Quality Set updated successfully.' });
      setOriginalQualitySet(qualitySet);
      setIsEditing(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('❌ Error updating quality set:', error);
      toast({ title: 'Error updating quality set', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMeasurementSettingChange = (key, value) => {
    if (!isEditing && !isEditingColorSettings) return;
    setMeasurementSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  // Card-specific handlers for Color Settings
  const handleEditColorSettings = () => {
    setIsEditingColorSettings(true);
    setOriginalColorSettings({
      name: qualitySet.name,
      measurementSettings: { ...measurementSettings }
    });
  };

  const handleSaveColorSettings = async () => {
    if (!qualitySet.name?.trim()) {
      toast({
        title: 'Name is required',
        description: 'Please enter a name for the quality set.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const rulesWithNames = qualitySet.rules.map((rule) => ({
        ...rule,
        name: (rule.name && rule.name.trim()) ? rule.name.trim() : `${rule.reference || 'Rule'}`.trim(),
        levels: rule.levels.map(level => ({
          ...level,
          range_from: typeof level.range_from === 'string' ? parseFloat(level.range_from) || 0 : level.range_from,
          range_to: level.range_to === null ? null : (typeof level.range_to === 'string' ? parseFloat(level.range_to) || 0 : level.range_to)
        }))
      }));

      const payload = { 
        ...qualitySet,
        rules: rulesWithNames,
        measurement_settings: measurementSettings
      };

      const { error } = await supabase.rpc('upsert_quality_set_with_details', { payload });

      if (error) throw error;

      toast({ title: 'Success!', description: 'Color settings updated successfully.' });
      setOriginalColorSettings({
        name: qualitySet.name,
        measurementSettings: { ...measurementSettings }
      });
      setIsEditingColorSettings(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error updating color settings:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelColorSettings = () => {
    if (originalColorSettings) {
      setQualitySet({ ...qualitySet, name: originalColorSettings.name });
      setMeasurementSettings({ ...originalColorSettings.measurementSettings });
    }
    setIsEditingColorSettings(false);
    setHasUnsavedChanges(false);
  };

  // Card-specific handlers for Rules
  const handleEditRules = () => {
    setIsEditingRules(true);
    setOriginalRules([...qualitySet.rules]);
  };

  const handleSaveRules = async () => {
    // Validate that all rules have required fields
    const validationErrors = [];
    qualitySet.rules.forEach((rule, ruleIndex) => {
      if (!rule.reference) {
        validationErrors.push(`Rule ${ruleIndex + 1}: Target is required`);
      }
      rule.levels.forEach((level, levelIndex) => {
        if (!level.name?.trim()) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Level name is required`);
        }
        if (level.range_from === '' || level.range_from === null || level.range_from === undefined) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Range from is required`);
        }
        if (!level.action) {
          validationErrors.push(`Rule ${ruleIndex + 1}, Level ${levelIndex + 1}: Action is required`);
        }
      });
    });

    if (validationErrors.length > 0) {
      toast({
        title: 'Validation Error',
        description: validationErrors[0],
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const rulesWithNames = qualitySet.rules.map((rule) => ({
        ...rule,
        name: (rule.name && rule.name.trim()) ? rule.name.trim() : `${rule.reference || 'Rule'}`.trim(),
        levels: rule.levels.map(level => ({
          ...level,
          range_from: typeof level.range_from === 'string' ? parseFloat(level.range_from) || 0 : level.range_from,
          range_to: level.range_to === null ? null : (typeof level.range_to === 'string' ? parseFloat(level.range_to) || 0 : level.range_to)
        }))
      }));

      const payload = { 
        ...qualitySet,
        rules: rulesWithNames,
        measurement_settings: measurementSettings
      };

      const { error } = await supabase.rpc('upsert_quality_set_with_details', { payload });

      if (error) throw error;

      toast({ title: 'Success!', description: 'Rules updated successfully.' });
      setOriginalRules([...qualitySet.rules]);
      setIsEditingRules(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error updating rules:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelRules = () => {
    if (originalRules) {
      setQualitySet({ ...qualitySet, rules: [...originalRules] });
    }
    setIsEditingRules(false);
    setHasUnsavedChanges(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (isNew) {
      navigate('/quality-sets');
    } else {
      setQualitySet(originalQualitySet);
      setIsEditing(false);
      setHasUnsavedChanges(false);
    }
  };



  return (
    <>
      <Helmet>
        <title>{isNew ? 'New' : qualitySet?.name || 'Edit'} Quality Set - Kontrol</title>
      </Helmet>
      <div className="flex-1 flex flex-col h-full">
        <div className="p-6">
          <div className="max-w-none xl:max-w-7xl mx-auto">
            {/* Page Header */}
            <QualitySetDetailHeader
              isNew={isNew}
              qualitySetName={qualitySet?.name}
              originalName={originalQualitySet?.name}
              handleSaveUpdate={handleSaveUpdate}
              handleSaveNew={handleSaveNew}
              saving={isSaving}
              isEditMode={isEditing}
              showEditButton={!isEditing && !isNew}
              onEdit={handleEdit}
              onCancel={handleCancel}
            />

            {/* Panel Card - matching print condition styling */}
            <div className="flex-1 flex flex-col bg-white border border-border rounded-lg overflow-hidden mt-4">
              <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Quality Set Color Settings Card */}
                <Card>
                  <CardHeader
                    title="Quality Set Color Settings"
                    showEdit={!isNew}
                    isEditing={isNew ? isEditing : isEditingColorSettings}
                    onEdit={handleEditColorSettings}
                    onSave={isNew ? handleSaveNew : handleSaveColorSettings}
                    onCancel={isNew ? handleCancel : handleCancelColorSettings}
                    canSave={hasUnsavedChanges && !!qualitySet?.name?.trim()}
                    saving={isSaving}
                    hasRequiredFields={true}
                    requiredFieldsFilled={!!qualitySet?.name?.trim()}
                  />
                  <CardContent className="space-y-6">
                    <div className="w-full max-w-2xl">
                      <Label htmlFor="quality-set-name" className="block text-sm font-medium text-gray-700 mb-1">
                        <RequiredLabel value={qualitySet?.name}>Quality Set name</RequiredLabel>
                      </Label>
                      <Input
                        id="quality-set-name"
                        value={qualitySet?.name || ''}
                        onChange={(e) => {
                          setQualitySet({ ...qualitySet, name: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        disabled={isNew ? !isEditing : !isEditingColorSettings}
                        placeholder="Enter quality set name"
                      />
                    </div>

                    {standards.loading ? (
                      <div className="text-sm text-muted-foreground">Loading measurement settings...</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="mode-select">Mode:</Label>
                          <Select value={measurementSettings.mode} onValueChange={(val) => handleMeasurementSettingChange('mode', val)} disabled={isNew ? !isEditing : !isEditingColorSettings}>
                            <SelectTrigger id="mode-select" className="w-[80px] h-8">
                              <SelectValue placeholder="Mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M0">M0</SelectItem>
                              <SelectItem value="M1">M1</SelectItem>
                              <SelectItem value="M2">M2</SelectItem>
                              <SelectItem value="M3">M3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Label htmlFor="illuminant-select">Illuminant:</Label>
                          <Select value={measurementSettings.illuminant} onValueChange={(val) => handleMeasurementSettingChange('illuminant', val)} disabled={isNew ? !isEditing : !isEditingColorSettings}>
                            <SelectTrigger id="illuminant-select" className="w-[100px] h-8">
                              <SelectValue placeholder="Illuminant" />
                            </SelectTrigger>
                            <SelectContent>
                              {standards.illuminants.map(ill => (
                                <SelectItem key={ill.id} value={ill.name}>{ill.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Label htmlFor="observer-select">Observer:</Label>
                          <Select value={measurementSettings.observer} onValueChange={(val) => handleMeasurementSettingChange('observer', val)} disabled={isNew ? !isEditing : !isEditingColorSettings}>
                            <SelectTrigger id="observer-select" className="w-[80px] h-8">
                              <SelectValue placeholder="Observer" />
                            </SelectTrigger>
                            <SelectContent>
                              {standards.observers.map(obs => (
                                <SelectItem key={obs.id} value={obs.name}>{obs.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Label htmlFor="table-select">Table:</Label>
                          <Select value={measurementSettings.table} onValueChange={(val) => handleMeasurementSettingChange('table', val)} disabled={isNew ? !isEditing : !isEditingColorSettings}>
                            <SelectTrigger id="table-select" className="w-[80px] h-8">
                              <SelectValue placeholder="Table" />
                            </SelectTrigger>
                            <SelectContent>
                              {standards.astmTables
                                .filter((value, index, self) => 
                                  index === self.findIndex((t) => t.table_number === value.table_number)
                                )
                                .sort((a, b) => a.table_number - b.table_number)
                                .map(table => (
                                  <SelectItem key={table.id} value={String(table.table_number)}>{table.table_number}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Label htmlFor="delta-e-select">ΔE Method:</Label>
                          <Select value={measurementSettings.deltaE} onValueChange={(val) => handleMeasurementSettingChange('deltaE', val)} disabled={isNew ? !isEditing : !isEditingColorSettings}>
                            <SelectTrigger id="delta-e-select" className="w-[120px] h-8">
                              <SelectValue placeholder="ΔE Method" />
                            </SelectTrigger>
                             <SelectContent>
                               {getDeltaEOptions().map(option => (
                                 <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                               ))}
                             </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Quality Set Rules Card */}
                <Card>
                  <CardHeader
                    title="Quality Set Rules"
                    showEdit={!isNew}
                    isEditing={isNew ? isEditing : isEditingRules}
                    onEdit={handleEditRules}
                    onSave={isNew ? handleSaveNew : handleSaveRules}
                    onCancel={isNew ? handleCancel : handleCancelRules}
                    canSave={hasUnsavedChanges && !!qualitySet?.name?.trim()}
                    saving={isSaving}
                    hasRequiredFields={true}
                    requiredFieldsFilled={!!qualitySet?.name?.trim()}
                  />
                  <CardContent className="pt-0 pb-4">
                    {qualitySet?.rules?.map((rule, index) => (
                      <RuleCard 
                        key={rule.id || index}
                        rule={rule} 
                        index={index} 
                        onUpdate={(updatedRule) => handleUpdateRule(updatedRule, index)}
                        onAddLevel={handleAddLevel}
                        onDelete={handleDeleteRule}
                        onRemoveLevel={handleRemoveLevel}
                        measurementSettings={measurementSettings}
                        isEditing={isNew ? isEditing : isEditingRules}
                        canDelete={qualitySet?.rules?.length > 1}
                      />
                    ))}
                    {(isNew ? isEditing : isEditingRules) && (
                      <button
                        onClick={handleAddRule}
                        className="text-sm font-bold text-primary hover:text-primary/80 hover:underline mt-2"
                      >
                        + Add Rule
                      </button>
                    )}
                  </CardContent>
                </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
    </>
  );
};

export default QualitySetDetail;
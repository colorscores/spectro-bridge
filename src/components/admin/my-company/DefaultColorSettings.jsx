import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Save, Edit2, X, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { debug } from '@/lib/debugUtils';
import { getDeltaEOptions } from '@/lib/constants/deltaEMethods';

const DefaultColorSettings = ({ organization, onUpdate, withinPanel = false, editing = false, hideLocalActions = false, onDirtyChange, onSettingsChange, registerSaveHandler, registerCancelHandler, hideTitle = false, onEditComplete }) => {
  
  const [settings, setSettings] = useState({
    mode: 'M0',
    illuminant: 'D50',
    observer: '2',
    table: '5',
    deltaE: 'dE00'
  });
  const [originalSettings, setOriginalSettings] = useState({
    mode: 'M0',
    illuminant: 'D50',
    observer: '2',
    table: '5',
    deltaE: 'dE00'
  });
  const [standards, setStandards] = useState({
    illuminants: [],
    observers: [],
    astmTables: [],
    loading: true
  });
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Sync editing state from parent
  useEffect(() => {
    setIsEditing(!!editing);
  }, [editing]);

  // Load measurement standards
  useEffect(() => {
    const fetchStandards = async () => {
      try {
        const [illuminantsRes, observersRes, astmTablesRes] = await Promise.all([
          supabase.from('illuminants').select('*').order('name'),
          supabase.from('observers').select('*').order('name'),
          supabase.from('astm_e308_tables').select('*').order('table_number')
        ]);

        setStandards({
          illuminants: illuminantsRes.data || [],
          observers: observersRes.data || [],
          astmTables: astmTablesRes.data || [],
          loading: false
        });
      } catch (error) {
        console.error('Error fetching measurement standards:', error);
        setStandards(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStandards();
  }, []);

  // Load organization's default settings
  useEffect(() => {
    if (organization) {
      const newSettings = {
        mode: organization.default_measurement_mode || 'M0',
        illuminant: organization.default_illuminant || 'D50',
        observer: organization.default_observer || '2',
        table: organization.default_astm_table || '5',
        deltaE: organization.default_delta_e || 'dE00'
      };
      setSettings(newSettings);
      setOriginalSettings(newSettings);
    }
  }, [organization]);

  const handleSettingChange = (key, value) => {
    if (!isEditing) return;
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setSettings(originalSettings);
    setIsEditing(false);
    onEditComplete?.();
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  useEffect(() => {
    onDirtyChange?.(!!isEditing && hasChanges);
  }, [isEditing, hasChanges, onDirtyChange]);

  const handleSave = async () => {
    
    if (!organization) {
      
      toast({
        title: 'Error',
        description: 'Please log in to save default color settings.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          default_measurement_mode: settings.mode,
          default_illuminant: settings.illuminant,
          default_observer: settings.observer,
          default_astm_table: settings.table,
          default_delta_e: settings.deltaE
        })
        .eq('id', organization.id);

      if (error) throw error;
      
      // Update original settings and exit edit mode
      setOriginalSettings(settings);
      setIsEditing(false);
      onEditComplete?.();
      
      toast({
        title: 'Success!',
        description: 'Default color settings updated successfully.'
      });

      // Notify parent component of the update with the new settings
      const updatedOrg = {
        ...organization,
        default_measurement_mode: settings.mode,
        default_illuminant: settings.illuminant,
        default_observer: settings.observer,
        default_astm_table: settings.table,
        default_delta_e: settings.deltaE
      };
      
      
      if (onUpdate) {
        onUpdate(updatedOrg);
      }
      
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Register external save/cancel handlers for header controls
  useEffect(() => {
    registerSaveHandler?.(handleSave);
    registerCancelHandler?.(handleCancel);
  }, [registerSaveHandler, registerCancelHandler, handleSave]);

  if (standards.loading) {
    if (withinPanel) {
      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Default Color Settings</h2>
          <p className="text-sm text-gray-500 mt-2">Loading measurement standards...</p>
        </div>
      );
    }
    return (
      <Card className="bg-white p-6 rounded-xl shadow-none mt-8">
        <CardHeader className="p-0 mb-6">
          <h2 className="text-xl font-semibold text-gray-700">Default Color Settings</h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="text-sm text-gray-500">Loading measurement standards...</div>
        </CardContent>
      </Card>
    );
  }

  if (!organization) {
    if (withinPanel) {
      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Default Color Settings</h2>
          <p className="text-sm text-gray-500 mt-2">Organization data not available. Please ensure you are logged in.</p>
        </div>
      );
    }
    return (
      <Card className="bg-white p-6 rounded-xl shadow-none mt-8">
        <CardHeader className="p-0 mb-6">
          <h2 className="text-xl font-semibold text-gray-700">Default Color Settings</h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="text-sm text-gray-500">Organization data not available. Please ensure you are logged in.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    withinPanel ? (
      <div>
        {!hideTitle && (
          <>
            <h2 className="text-xl font-semibold text-gray-700">Default Color Settings</h2>
            <p className="text-sm text-gray-500 mt-2">
              Configure the default measurement settings for color viewing and matching in your organization.
            </p>
          </>
        )}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Label htmlFor="default-mode-select">Mode:</Label>
                <Select value={settings.mode} onValueChange={(val) => handleSettingChange('mode', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-mode-select" className="w-[80px] h-8">
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
                <Label htmlFor="default-illuminant-select">Illuminant:</Label>
                <Select value={settings.illuminant} onValueChange={(val) => handleSettingChange('illuminant', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-illuminant-select" className="w-[100px] h-8">
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
                <Label htmlFor="default-observer-select">Observer:</Label>
                <Select value={settings.observer} onValueChange={(val) => handleSettingChange('observer', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-observer-select" className="w-[80px] h-8">
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
                <Label htmlFor="default-table-select">Table:</Label>
                <Select value={settings.table} onValueChange={(val) => handleSettingChange('table', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-table-select" className="w-[80px] h-8">
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
                <Label htmlFor="default-delta-e-select">ΔE Method:</Label>
                <Select value={settings.deltaE} onValueChange={(val) => handleSettingChange('deltaE', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-delta-e-select" className="w-[120px] h-8">
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

          </div>
        </div>
      </div>
    ) : (
      <Card className="bg-white p-6 rounded-xl shadow-none mt-8">
        <CardHeader className="p-0 mb-6">
          <h2 className="text-xl font-semibold text-gray-700">Default Color Settings</h2>
          <p className="text-sm text-gray-500 mt-2">
            Configure the default measurement settings for color viewing and matching in your organization.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Label htmlFor="default-mode-select">Mode:</Label>
                <Select value={settings.mode} onValueChange={(val) => handleSettingChange('mode', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-mode-select" className="w-[80px] h-8">
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
                <Label htmlFor="default-illuminant-select">Illuminant:</Label>
                <Select value={settings.illuminant} onValueChange={(val) => handleSettingChange('illuminant', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-illuminant-select" className="w-[100px] h-8">
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
                <Label htmlFor="default-observer-select">Observer:</Label>
                <Select value={settings.observer} onValueChange={(val) => handleSettingChange('observer', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-observer-select" className="w-[80px] h-8">
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
                <Label htmlFor="default-table-select">Table:</Label>
                <Select value={settings.table} onValueChange={(val) => handleSettingChange('table', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-table-select" className="w-[80px] h-8">
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
                <Label htmlFor="default-delta-e-select">ΔE Method:</Label>
                <Select value={settings.deltaE} onValueChange={(val) => handleSettingChange('deltaE', val)} disabled={!isEditing}>
                  <SelectTrigger id="default-delta-e-select" className="w-[120px] h-8">
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

          </div>
        </CardContent>
      </Card>
    )
  );
};

export default DefaultColorSettings;
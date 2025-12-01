import React, { useState, useEffect, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Edit2, X, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useLicensing } from '@/hooks/useLicensing';

const orgTypeOptions = [
  "Brand Owner",
  "Print Supplier",
  "Premedia Agency",
  "Design Agency",
  "Vendor",
  "Ink Supplier",
];

const OrganizationTypes = ({ selectedTypes, onTypeChange, loading, organization, editing = false, hideLocalActions = false, onDirtyChange, onChange, registerSaveHandler, registerCancelHandler, hideTitle = false, onEditComplete }) => {
  
  const { isSuperadmin } = useRoleAccess();
  const { licenses } = useLicensing();
  const [isEditing, setIsEditing] = useState(false);
  const [localSelectedTypes, setLocalSelectedTypes] = useState(selectedTypes || []);
  const [originalTypes, setOriginalTypes] = useState(selectedTypes || []);
  const [saving, setSaving] = useState(false);

  // Check if editing is allowed - for FREE library accounts, only superadmins can edit
  const isFreeMode = licenses.libraries?.plan === 'Free';
  const canEdit = isSuperadmin || !isFreeMode;

  useEffect(() => {
    setLocalSelectedTypes(selectedTypes || []);
    setOriginalTypes(selectedTypes || []);
  }, [selectedTypes]);

  useEffect(() => {
    setIsEditing(!!editing);
  }, [editing]);

  const handleCheckedChange = (type) => {
    if (!isEditing) return;
    const newSelectedTypes = localSelectedTypes.includes(type)
      ? localSelectedTypes.filter((t) => t !== type)
      : [...localSelectedTypes, type];
    setLocalSelectedTypes(newSelectedTypes);
    onChange?.(newSelectedTypes);
  };

  const handleEdit = () => {
    if (!canEdit) {
      toast({
        title: "Access Restricted",
        description: "Changing organization types requires a paid library license or superadmin access.",
        variant: "destructive"
      });
      return;
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setLocalSelectedTypes(originalTypes);
    setIsEditing(false);
    onEditComplete?.();
  };

  const hasChanges = JSON.stringify(localSelectedTypes.sort()) !== JSON.stringify(originalTypes.sort());

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleSave = async () => {
    if (!organization?.id) {
      toast({
        title: "Error",
        description: "Organization information is not available.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ type: localSelectedTypes })
        .eq('id', organization.id);

      if (error) throw error;

      setOriginalTypes(localSelectedTypes);
      setIsEditing(false);
      onTypeChange(localSelectedTypes);
      onEditComplete?.();

      toast({
        title: "Success",
        description: "Organization types updated successfully.",
      });
    } catch (error) {
      console.error('Error saving organization types:', error);
      toast({
        title: "Error",
        description: `Failed to save organization types: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    registerSaveHandler?.(handleSave);
    registerCancelHandler?.(handleCancel);
  }, [registerSaveHandler, registerCancelHandler, handleSave]);

  if (loading) {
    return (
      <Card className="border-none shadow-none">
        <CardContent className="p-0 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {orgTypeOptions.map((type) => (
              <div key={type} className="flex items-center space-x-2 animate-pulse">
                <div className="h-4 w-4 rounded-sm bg-muted"></div>
                <div className="h-4 w-24 rounded-md bg-muted"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-none">
      {hideTitle ? null : (
        <CardHeader className="p-0 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700">Organization Types</h3>
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0 pt-0">
        {isFreeMode && !isSuperadmin ? (
          // Free mode: Only show selected types as read-only badges
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {localSelectedTypes.length > 0 ? (
                localSelectedTypes.map((type) => (
                  <div key={type} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                    {type}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-sm">No organization types selected</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Organization types are read-only with Free library license. Upgrade to edit organization types.
            </div>
          </div>
        ) : (
          // Paid mode or Superadmin: Show full editing interface
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-1 w-full flex-wrap items-center gap-x-5 gap-y-3">
              {orgTypeOptions.map((type) => (
                <div key={type} className="flex items-center space-x-2 whitespace-nowrap">
                  <Checkbox
                    id={type}
                    checked={localSelectedTypes.includes(type)}
                    onCheckedChange={() => handleCheckedChange(type)}
                    disabled={!isEditing}
                  />
                  <Label 
                    htmlFor={type} 
                    className={`font-normal text-sm whitespace-nowrap ${!isEditing ? 'text-muted-foreground' : ''}`}
                  >
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrganizationTypes;
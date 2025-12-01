import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const ImportedColorHeader = ({ 
  color, 
  onUpdate, 
  canEdit = false,
  printConditions = [],
  substrateTypes = [],
  materialTypes = [],
  printProcesses = []
}) => {
  const handleNameChange = (e) => {
    if (onUpdate) {
      onUpdate(prev => ({ ...prev, name: e.target.value }));
    }
  };

  const handleVersionChange = (e) => {
    if (onUpdate) {
      onUpdate(prev => ({ ...prev, version: e.target.value }));
    }
  };

  const handlePrintProcessChange = (value) => {
    if (onUpdate) {
      onUpdate(prev => ({ ...prev, print_process: value }));
    }
  };

  const handleSubstrateTypeChange = (value) => {
    if (onUpdate) {
      onUpdate(prev => ({ ...prev, substrate_type: value }));
    }
  };

  const handleMaterialTypeChange = (value) => {
    if (onUpdate) {
      onUpdate(prev => ({ ...prev, material_type: value }));
    }
  };

  const handlePrintSideChange = (value) => {
    if (onUpdate) {
      onUpdate(prev => ({ ...prev, print_side: value }));
    }
  };

  const handlePackTypeChange = (value) => {
    if (onUpdate) {
      onUpdate(prev => ({ ...prev, pack_type: value }));
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6 mb-6">
      {/* Row 1: Print Condition Name, Version, Print Process */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-5 space-y-2">
          <Label htmlFor="print-condition-name" className="text-sm font-semibold">
            Print Condition Name
          </Label>
          <Input
            id="print-condition-name"
            value={color.name || ''}
            onChange={handleNameChange}
            disabled={!canEdit}
            className="w-full"
            placeholder="Enter print condition name"
          />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="version" className="text-sm font-semibold">
            Version
          </Label>
          <Input
            id="version"
            value={color.version || ''}
            onChange={handleVersionChange}
            disabled={!canEdit}
            className="w-full"
            placeholder="e.g., V1, 2.0"
          />
        </div>

        <div className="col-span-5 space-y-2">
          <Label htmlFor="print-process" className="text-sm font-semibold">
            Print Process
          </Label>
          <Select 
            value={color.print_process || ''} 
            onValueChange={handlePrintProcessChange}
            disabled={!canEdit}
          >
            <SelectTrigger id="print-process" className="w-full">
              <SelectValue placeholder="Select print process" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Flexo">Flexo</SelectItem>
              <SelectItem value="Offset">Offset</SelectItem>
              <SelectItem value="Digital">Digital</SelectItem>
              <SelectItem value="Gravure">Gravure</SelectItem>
              <SelectItem value="Screen">Screen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Substrate Type, Material Type, Print Side, Pack Type */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-2">
          <Label htmlFor="substrate-type" className="text-sm font-semibold">
            Substrate Type
          </Label>
          <Select
            value={color.substrate_type || ''}
            onValueChange={handleSubstrateTypeChange}
            disabled={!canEdit}
          >
            <SelectTrigger id="substrate-type" className="w-full">
              <SelectValue placeholder="Select substrate type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Uncoated Paper">Uncoated Paper</SelectItem>
              <SelectItem value="Coated Paper">Coated Paper</SelectItem>
              <SelectItem value="Cardboard">Cardboard</SelectItem>
              <SelectItem value="Film">Film</SelectItem>
              <SelectItem value="Foil">Foil</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-3 space-y-2">
          <Label htmlFor="material-type" className="text-sm font-semibold">
            Material Type
          </Label>
          <Select
            value={color.material_type || ''}
            onValueChange={handleMaterialTypeChange}
            disabled={!canEdit}
          >
            <SelectTrigger id="material-type" className="w-full">
              <SelectValue placeholder="Select material type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Corrugate">Corrugate</SelectItem>
              <SelectItem value="Paperboard">Paperboard</SelectItem>
              <SelectItem value="Label Stock">Label Stock</SelectItem>
              <SelectItem value="Flexible Film">Flexible Film</SelectItem>
              <SelectItem value="Rigid Plastic">Rigid Plastic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-3 space-y-2">
          <Label htmlFor="print-side" className="text-sm font-semibold">
            Print Side
          </Label>
          <Select
            value={color.print_side || ''}
            onValueChange={handlePrintSideChange}
            disabled={!canEdit}
          >
            <SelectTrigger id="print-side" className="w-full">
              <SelectValue placeholder="Select print side" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Surface">Surface</SelectItem>
              <SelectItem value="Reverse">Reverse</SelectItem>
              <SelectItem value="Both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-3 space-y-2">
          <Label htmlFor="pack-type" className="text-sm font-semibold">
            Pack Type
          </Label>
          <Select
            value={color.pack_type || ''}
            onValueChange={handlePackTypeChange}
            disabled={!canEdit}
          >
            <SelectTrigger id="pack-type" className="w-full">
              <SelectValue placeholder="Select pack type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Corrugated Box">Corrugated Box</SelectItem>
              <SelectItem value="Folding Carton">Folding Carton</SelectItem>
              <SelectItem value="Label">Label</SelectItem>
              <SelectItem value="Flexible Pouch">Flexible Pouch</SelectItem>
              <SelectItem value="Rigid Container">Rigid Container</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ImportedColorHeader;
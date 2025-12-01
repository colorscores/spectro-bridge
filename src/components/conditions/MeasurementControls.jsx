import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Upload, Plus, ChevronDown } from 'lucide-react';
import { sortMeasurementModes } from '@/lib/utils/measurementUtils';

const MeasurementControls = ({ controls, setControls, standards, availableModes = [], disabled, onFileChange, showCard = false, labConditions = null }) => {
  const { mode, illuminant, observer, table } = controls;
  const { illuminants, observers, astmTables, loading } = standards;
  
  // If no spectral data is available (empty availableModes) and we have stored Lab conditions, constrain to those values
  const isLabOnly = availableModes.length === 0 && labConditions;
  const isConstrained = isLabOnly || disabled;
  
  const cxfInputRef = useRef(null);
  const cgatsInputRef = useRef(null);

  const handleControlChange = (key, value) => {
    setControls(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading measurement standards...</div>;
  }

  const controlsContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <Label htmlFor="mode-select">Mode:</Label>
          <Select value={mode} onValueChange={(val) => handleControlChange('mode', val)} disabled={disabled}>
            <SelectTrigger id="mode-select" className="w-[80px] h-8">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-md z-50">
            {availableModes.length > 0 ? sortMeasurementModes(availableModes).map(m => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              )) : (
                <>
                  <SelectItem value="M0">M0</SelectItem>
                  <SelectItem value="M1">M1</SelectItem>
                  <SelectItem value="M2">M2</SelectItem>
                  <SelectItem value="M3">M3</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Label htmlFor="illuminant-select">Illuminant:</Label>
          <Select value={illuminant} onValueChange={(val) => handleControlChange('illuminant', val)} disabled={isConstrained}>
            <SelectTrigger id="illuminant-select" className="w-[100px] h-8">
              <SelectValue placeholder="Illuminant" />
            </SelectTrigger>
            <SelectContent>
              {isLabOnly ? (
                <SelectItem value={labConditions.illuminant}>{labConditions.illuminant}</SelectItem>
              ) : (
                illuminants.map(ill => (
                  <SelectItem key={ill.id} value={ill.name}>{ill.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Label htmlFor="observer-select">Observer:</Label>
          <Select value={observer} onValueChange={(val) => handleControlChange('observer', val)} disabled={isConstrained}>
            <SelectTrigger id="observer-select" className="w-[80px] h-8">
              <SelectValue placeholder="Observer" />
            </SelectTrigger>
            <SelectContent>
              {isLabOnly ? (
                <SelectItem value={labConditions.observer}>{labConditions.observer}</SelectItem>
              ) : (
                observers.map(obs => (
                  <SelectItem key={obs.id} value={obs.name}>{obs.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Label htmlFor="table-select">Table:</Label>
          <Select value={table} onValueChange={(val) => handleControlChange('table', val)} disabled={isConstrained}>
            <SelectTrigger id="table-select" className="w-[80px] h-8">
              <SelectValue placeholder="Table" />
            </SelectTrigger>
            <SelectContent>
              {isLabOnly ? (
                <SelectItem value={labConditions.table}>{labConditions.table}</SelectItem>
              ) : (
                astmTables
                  .filter((value, index, self) => 
                    index === self.findIndex((t) => t.table_number === value.table_number)
                  )
                  .sort((a, b) => a.table_number - b.table_number)
                  .map(table => (
                    <SelectItem key={table.id} value={String(table.table_number)}>{table.table_number}</SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {onFileChange && !disabled && (
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import Measurement
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => {
                cxfInputRef.current?.click();
              }}>
                <Plus className="mr-2 h-4 w-4" />
                CxF File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                cgatsInputRef.current?.click();
              }}>
                <Plus className="mr-2 h-4 w-4" />
                CGATS File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Hidden file inputs */}
          <input
            ref={cxfInputRef}
            type="file"
            accept=".cxf"
            onChange={(e) => {
              onFileChange(e, 'cxf');
            }}
            className="hidden"
          />
          <input
            ref={cgatsInputRef}
            type="file"
            accept=".txt,.cgats"
            onChange={(e) => {
              onFileChange(e, 'cgats');
            }}
            className="hidden"
          />
        </div>
      )}
    </div>
  );

  if (showCard) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Measurement Settings</CardTitle>
          {onFileChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Measurement
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <label htmlFor="cxf-upload" className="flex items-center cursor-pointer w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    CxF File
                  </label>
                  <input
                    id="cxf-upload"
                    type="file"
                    accept=".cxf"
                    onChange={(e) => onFileChange(e, 'cxf')}
                    className="hidden"
                  />
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <label htmlFor="cgats-upload" className="flex items-center cursor-pointer w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    CGATS File
                  </label>
                  <input
                    id="cgats-upload"
                    type="file"
                    accept=".txt,.cgats"
                    onChange={(e) => onFileChange(e, 'cgats')}
                    className="hidden"
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <Label htmlFor="mode-select-card">Mode:</Label>
              <Select value={mode} onValueChange={(val) => handleControlChange('mode', val)} disabled={disabled}>
                <SelectTrigger id="mode-select-card" className="w-[80px] h-8">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  {availableModes.length > 0 ? availableModes.map(mode => (
                    <SelectItem key={typeof mode === 'string' ? mode : mode.value} value={typeof mode === 'string' ? mode : mode.value}>
                      {typeof mode === 'string' ? mode : mode.label}
                    </SelectItem>
                  )) : (
                    <>
                      <SelectItem value="M0">M0</SelectItem>
                      <SelectItem value="M1">M1</SelectItem>
                      <SelectItem value="M2">M2</SelectItem>
                      <SelectItem value="M3">M3</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="illuminant-select-card">Illuminant:</Label>
              <Select value={illuminant} onValueChange={(val) => handleControlChange('illuminant', val)} disabled={disabled}>
                <SelectTrigger id="illuminant-select-card" className="w-[100px] h-8">
                  <SelectValue placeholder="Illuminant" />
                </SelectTrigger>
                <SelectContent>
                  {illuminants.map(ill => (
                    <SelectItem key={ill.id} value={ill.name}>{ill.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="observer-select-card">Observer:</Label>
              <Select value={observer} onValueChange={(val) => handleControlChange('observer', val)} disabled={disabled}>
                <SelectTrigger id="observer-select-card" className="w-[80px] h-8">
                  <SelectValue placeholder="Observer" />
                </SelectTrigger>
                <SelectContent>
                  {observers.map(obs => (
                    <SelectItem key={obs.id} value={obs.name}>{obs.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="table-select-card">Table:</Label>
              <Select value={table} onValueChange={(val) => handleControlChange('table', val)} disabled={disabled}>
                <SelectTrigger id="table-select-card" className="w-[80px] h-8">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  {astmTables
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
          </div>
        </CardContent>
      </Card>
    );
  }

  return controlsContent;
};

export default MeasurementControls;
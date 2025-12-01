import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Controller } from 'react-hook-form';

const PrinterInfoTab = ({ register, control, errors, watch, setValue, disabled = false }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Printer Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Printer Name *</Label>
            <Input
              id="name"
              {...register('name', { required: 'Printer name is required' })}
              placeholder="Enter printer name"
              disabled={disabled}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Printer Type</Label>
            <Input
              id="type"
              {...register('type')}
              placeholder="e.g., Flexo, Digital, Offset"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input
              id="manufacturer"
              {...register('manufacturer')}
              placeholder="Enter manufacturer name"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="print_process">Print Process</Label>
            <Input
              id="print_process"
              {...register('print_process')}
              placeholder="Enter print process"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ink_type">Ink Type</Label>
            <Controller
              name="ink_type"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ink type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="water-based">Water-based</SelectItem>
                    <SelectItem value="solvent-based">Solvent-based</SelectItem>
                    <SelectItem value="uv">UV</SelectItem>
                    <SelectItem value="led-uv">LED UV</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="calibrated" className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Calibration Status
            </Label>
            <div className="flex items-center space-x-2">
              <Controller
                name="calibrated"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="calibrated"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={disabled}
                  />
                )}
              />
              <Label htmlFor="calibrated" className="text-sm">
                Printer is calibrated
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="series" className="text-gray-500">Series (Coming Soon)</Label>
            <Input
              id="series"
              disabled
              placeholder="Future implementation"
              className="bg-gray-50"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrinterInfoTab;
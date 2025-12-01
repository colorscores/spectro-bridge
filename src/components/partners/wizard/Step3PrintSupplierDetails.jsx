import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const Step3PrintSupplierDetails = ({ data, updateData }) => {
  return (
    <div className="space-y-6">
      <div>
        <Label>Print Process</Label>
        <Select
          value={data.printProcess.join(',')}
          onValueChange={(value) => updateData({ printProcess: value.split(',') })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select print process" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Flexo,Offset">Flexo, Offset</SelectItem>
            <SelectItem value="Flexo">Flexo</SelectItem>
            <SelectItem value="Offset">Offset</SelectItem>
            <SelectItem value="Digital">Digital</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Substrate Types</Label>
        <Select
          value={data.substrateTypes.join(',')}
          onValueChange={(value) => updateData({ substrateTypes: value.split(',') })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select substrate types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Carton Board,Film">Carton Board, Film</SelectItem>
            <SelectItem value="Carton Board">Carton Board</SelectItem>
            <SelectItem value="Film">Film</SelectItem>
            <SelectItem value="Paper">Paper</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Color Standard Types</Label>
        <Select
          value={data.colorStandardTypes}
          onValueChange={(value) => updateData({ colorStandardTypes: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select color standard types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Dependent">All Dependent</SelectItem>
            <SelectItem value="Type A">Type A</SelectItem>
            <SelectItem value="Type B">Type B</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4 pt-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="collectMatches"
            checked={data.collectMatches}
            onCheckedChange={(checked) => updateData({ collectMatches: checked })}
          />
          <Label htmlFor="collectMatches" className="font-normal">
            Collect Color Matches from this printer (uses 1 approval pack token)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="requireDirectMeasure"
            checked={data.requireDirectMeasure}
            onCheckedChange={(checked) => updateData({ requireDirectMeasure: checked })}
          />
          <Label htmlFor="requireDirectMeasure" className="font-normal">
            Require direct measure for Color Matches
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="autoRequestDrawdowns"
            checked={data.autoRequestDrawdowns}
            onCheckedChange={(checked) => updateData({ autoRequestDrawdowns: checked })}
          />
          <Label htmlFor="autoRequestDrawdowns" className="font-normal">
            Auto-request drawdowns for color matches
          </Label>
        </div>
      </div>
    </div>
  );
};

export default Step3PrintSupplierDetails;
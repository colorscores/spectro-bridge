import React from 'react';
    import { Controller } from 'react-hook-form';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

    const ConstructionLayer = ({ name, options, control, getValues, enabledKey, formKey }) => {
      return (
        <div className="grid grid-cols-3 items-center">
            <div className="col-span-1 flex items-center space-x-2">
                <Controller
                    name={enabledKey}
                    control={control}
                    render={({ field }) => (
                        <Checkbox
                            id={enabledKey}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    )}
                />
                <Label htmlFor={enabledKey} className="font-semibold">{name}</Label>
            </div>
            <div className="col-span-2">
                <Controller
                    name={formKey}
                    control={control}
                    render={({ field }) => (
                        <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={!getValues(enabledKey)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={`Select a ${name.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
        </div>
      );
    };

    export default ConstructionLayer;
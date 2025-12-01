import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const CxfImportDialog = ({ isOpen, setIsOpen, cxfColors, onColorSelect }) => {
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [matchName, setMatchName] = useState('Match 123');

  useEffect(() => {
    if (cxfColors && cxfColors.length > 0) {
      setSelectedColorId(cxfColors[0].id.toString());
    }
  }, [cxfColors]);

  const handleDone = () => {
    const selectedColor = cxfColors.find(c => c.id.toString() === selectedColorId);
    if (selectedColor) {
      onColorSelect({ ...selectedColor, matchName });
      setIsOpen(false);
    }
  };

  if (!cxfColors || cxfColors.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] p-8">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">Add Match</DialogTitle>
          <DialogDescription className="text-center">
            Please select the color you like to add as a match
          </DialogDescription>
        </DialogHeader>
        <div className="my-6">
          <RadioGroup value={selectedColorId} onValueChange={setSelectedColorId}>
            <div className="space-y-2">
              {cxfColors.map((color) => (
                <Label
                  key={color.id}
                  htmlFor={`cxf-${color.id}`}
                   className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all overflow-visible ${
                     selectedColorId === color.id.toString() ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                   }`}
                >
                   <div className="flex items-center gap-4">
                     <RadioGroupItem value={color.id.toString()} id={`cxf-${color.id}`} className="h-[18px] w-[18px] p-0 flex-shrink-0" />
                    <div className="w-8 h-8 rounded-full" style={{ backgroundColor: color.hex }}></div>
                    <span className="font-medium text-gray-800">{color.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{color.lab}</span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        color.type === 'Target'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {color.type}
                    </span>
                  </div>
                </Label>
              ))}
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label htmlFor="matchName">Match Name</Label>
          <Input
            id="matchName"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
            placeholder="Enter match name"
          />
        </div>
        <DialogFooter className="mt-8">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDone}>Next</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CxfImportDialog;
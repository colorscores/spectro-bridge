import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { helpContent } from './helpContent';
import FloatingIconDisplay from './FloatingIconDisplay';

const ColorsHelpDialog = ({ open, onOpenChange }) => {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);

  const currentGroup = helpContent[selectedGroupIndex];
  const currentFeature = currentGroup?.features[selectedFeatureIndex];

  const navigateLeft = () => {
    if (selectedFeatureIndex > 0) {
      setSelectedFeatureIndex(selectedFeatureIndex - 1);
    } else if (selectedGroupIndex > 0) {
      setSelectedGroupIndex(selectedGroupIndex - 1);
      setSelectedFeatureIndex(helpContent[selectedGroupIndex - 1].features.length - 1);
    }
  };

  const navigateRight = () => {
    if (selectedFeatureIndex < currentGroup.features.length - 1) {
      setSelectedFeatureIndex(selectedFeatureIndex + 1);
    } else if (selectedGroupIndex < helpContent.length - 1) {
      setSelectedGroupIndex(selectedGroupIndex + 1);
      setSelectedFeatureIndex(0);
    }
  };

  const handleGroupChange = (value) => {
    const groupIndex = parseInt(value);
    setSelectedGroupIndex(groupIndex);
    setSelectedFeatureIndex(0);
  };

  const handleFeatureChange = (value) => {
    const featureIndex = parseInt(value);
    setSelectedFeatureIndex(featureIndex);
  };

  const canNavigateLeft = selectedGroupIndex > 0 || selectedFeatureIndex > 0;
  const canNavigateRight = selectedGroupIndex < helpContent.length - 1 || selectedFeatureIndex < currentGroup?.features.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-6">
            Colors Feature Guide
          </DialogTitle>
          
          <div className="flex items-center justify-center gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={navigateLeft}
              disabled={!canNavigateLeft}
              className="h-10 w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-4">
              <div className="min-w-[200px]">
                <Select value={selectedGroupIndex.toString()} onValueChange={handleGroupChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {helpContent.map((group, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[250px]">
                <Select value={selectedFeatureIndex.toString()} onValueChange={handleFeatureChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentGroup?.features.map((feature, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {feature.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={navigateRight}
              disabled={!canNavigateRight}
              className="h-10 w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6">
          <div className="max-w-4xl mx-auto">
            {/* Floating Icon Display */}
            <FloatingIconDisplay 
              features={currentGroup?.features || []}
              selectedFeatureIndex={selectedFeatureIndex}
              onFeatureSelect={setSelectedFeatureIndex}
            />
            
            {/* Content Section */}
            <div className="space-y-6 max-w-2xl mx-auto text-center">
              <div>
                <h4 className="text-lg font-medium mb-3 text-foreground">
                  What it does
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {currentFeature?.description}
                </p>
              </div>

              <div>
                <h4 className="text-lg font-medium mb-3 text-foreground">
                  Why it's important
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {currentFeature?.importance}
                </p>
              </div>

              {currentFeature?.howToUse && (
                <div>
                  <h4 className="text-lg font-medium mb-3 text-foreground">
                    How to use it
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {currentFeature?.howToUse}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Feature {selectedFeatureIndex + 1} of {currentGroup?.features.length} in {currentGroup?.name}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColorsHelpDialog;
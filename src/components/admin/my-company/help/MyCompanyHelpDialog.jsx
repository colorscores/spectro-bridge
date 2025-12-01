import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { myCompanyHelpContent } from './myCompanyHelpContent';
import MyCompanyFloatingIconDisplay from './MyCompanyFloatingIconDisplay';

const MyCompanyHelpDialog = ({ isOpen, onClose, initialSection = null }) => {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(
    initialSection ? myCompanyHelpContent.findIndex(group => group.groupName === initialSection) || 0 : 0
  );
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);

  const selectedGroup = myCompanyHelpContent[selectedGroupIndex];
  const selectedFeature = selectedGroup?.features[selectedFeatureIndex];

  // Navigation logic
  const canNavigateLeft = selectedGroupIndex > 0 || selectedFeatureIndex > 0;
  const canNavigateRight = selectedGroupIndex < myCompanyHelpContent.length - 1 || 
    selectedFeatureIndex < (selectedGroup?.features.length - 1);

  const navigateLeft = () => {
    if (selectedFeatureIndex > 0) {
      setSelectedFeatureIndex(selectedFeatureIndex - 1);
    } else if (selectedGroupIndex > 0) {
      const prevGroup = myCompanyHelpContent[selectedGroupIndex - 1];
      setSelectedGroupIndex(selectedGroupIndex - 1);
      setSelectedFeatureIndex(prevGroup.features.length - 1);
    }
  };

  const navigateRight = () => {
    if (selectedFeatureIndex < selectedGroup.features.length - 1) {
      setSelectedFeatureIndex(selectedFeatureIndex + 1);
    } else if (selectedGroupIndex < myCompanyHelpContent.length - 1) {
      setSelectedGroupIndex(selectedGroupIndex + 1);
      setSelectedFeatureIndex(0);
    }
  };

  const handleGroupChange = (value) => {
    const newIndex = parseInt(value);
    setSelectedGroupIndex(newIndex);
    setSelectedFeatureIndex(0);
  };

  const handleFeatureChange = (index) => {
    setSelectedFeatureIndex(index);
  };

  if (!selectedGroup || !selectedFeature) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-semibold">
            My Company Help
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-4 py-4 border-b">
            {/* Left Navigation */}
            <Button
              variant="outline"
              size="sm"
              onClick={navigateLeft}
              disabled={!canNavigateLeft}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {/* Group and Feature Selectors */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Section:</span>
                <Select value={selectedGroupIndex.toString()} onValueChange={handleGroupChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {myCompanyHelpContent.map((group, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {group.groupName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedGroup.features.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Feature:</span>
                  <Select value={selectedFeatureIndex.toString()} onValueChange={(value) => setSelectedFeatureIndex(parseInt(value))}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedGroup.features.map((feature, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {feature.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Right Navigation */}
            <Button
              variant="outline"
              size="sm"
              onClick={navigateRight}
              disabled={!canNavigateRight}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Icon Display */}
          <div className="py-6 border-b">
            <MyCompanyFloatingIconDisplay
              features={selectedGroup.features}
              selectedFeatureIndex={selectedFeatureIndex}
              onFeatureSelect={handleFeatureChange}
              groupName={selectedGroup.groupName}
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto py-6 space-y-6 text-center">
            <div className="space-y-4">{/* Removed repeated title/tagline section */}
              <div>
                <h4 className="text-lg font-medium mb-3 text-foreground">What it does</h4>
                <p className="text-muted-foreground leading-relaxed">{selectedFeature.whatItDoes}</p>
              </div>

              <div>
                <h4 className="text-lg font-medium mb-3 text-foreground">Why it's important</h4>
                <p className="text-muted-foreground leading-relaxed">{selectedFeature.whyImportant}</p>
              </div>

              <div>
                <h4 className="text-lg font-medium mb-3 text-foreground">How to use it</h4>
                <p className="text-muted-foreground leading-relaxed">{selectedFeature.howToUse}</p>
              </div>

              {/* Additional sections based on content type */}
              {selectedFeature.levels && (
                <div>
                  <h4 className="text-lg font-medium mb-3 text-foreground">Available Levels</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {selectedFeature.levels.map((level, index) => (
                      <li key={index}>{level}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedFeature.options && (
                <div>
                  <h4 className="text-lg font-medium mb-3 text-foreground">Available Options</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {selectedFeature.options.map((option, index) => (
                      <li key={index}>{option}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedFeature.operations && (
                <div>
                  <h4 className="text-lg font-medium mb-3 text-foreground">Operations</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {selectedFeature.operations.map((operation, index) => (
                      <li key={index}>{operation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Pagination info */}
            <div className="text-center pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedFeatureIndex + 1} of {selectedGroup.features.length} in {selectedGroup.groupName}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyCompanyHelpDialog;
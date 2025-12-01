import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import SubstrateConditionVisuals from '@/components/conditions/SubstrateConditionVisuals';

const SubstrateConditionInfoDisplayReadOnly = ({ 
  substrateCondition, 
  parentSubstrate, 
  allSubstrates, 
  constructionDetails, 
  packTypes,
  loading = false 
}) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!substrateCondition) {
    return (
      <div className="space-y-6">
        {/* Basic Information Card */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900">
                  Substrate Condition Name
                </Label>
                <div className="text-base text-muted-foreground">No substrate condition available</div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900">
                  Pack Type
                </Label>
                <div className="text-base text-muted-foreground">Not specified</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual Data Card */}
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="text-center text-muted-foreground">
              No substrate condition information available
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get pack type name
  const packType = packTypes?.find(pt => pt.name === substrateCondition.pack_type);

  return (
    <div className="space-y-6">
      {/* Basic Information Card - exactly matches SubstrateConditionInfo */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">
                Substrate Condition Name
              </Label>
              <div className="px-3 py-2 border rounded-md bg-gray-50 text-base">
                {substrateCondition.name}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">
                Pack Type
              </Label>
              <div className="px-3 py-2 border rounded-md bg-gray-50 text-base">
                {packType?.name || substrateCondition.pack_type || 'Not specified'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Data - exactly matches SubstrateConditionVisuals */}
      <SubstrateConditionVisuals
        condition={substrateCondition}
        parentSubstrate={parentSubstrate}
        allSubstrates={allSubstrates}
        constructionDetails={constructionDetails}
        onConstructionDetailsChange={() => {}} // Read-only - no changes allowed
        onConditionChange={() => {}} // Read-only - no changes allowed
        canEdit={false}
        setHasUnsavedChanges={() => {}} // Read-only - no changes allowed
        isNew={false}
      />
    </div>
  );
};

export default SubstrateConditionInfoDisplayReadOnly;
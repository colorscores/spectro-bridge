import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useLicensing } from '@/hooks/useLicensing';

const Step2RoleOptions = ({ data, updateData }) => {
  const { getLicenseInfo } = useLicensing();
  
  const hasRole = (role) => Array.isArray(data.selectedOrgRoles) && data.selectedOrgRoles.includes(role);
  const isPrintSupplier = hasRole('Print Supplier');
  const isDesignAgency = hasRole('Design Agency');

  const matchPackInfo = getLicenseInfo('matchPack');
  const createPackInfo = getLicenseInfo('createPack');

  return (
    <div className="space-y-6">
      {isPrintSupplier && (
        <Card>
          <CardHeader>
            <CardTitle>Print Supplier Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="collectColorMatches"
                checked={!!data.collectColorMatches}
                className="mt-1"
                onCheckedChange={(checked) => {
                  const isChecked = Boolean(checked);
                  updateData({
                    collectColorMatches: isChecked,
                    ...(isChecked
                      ? {}
                      : {
                          autoRequestAnalogDrawdowns: false,
                          forceDirectMeasurement: false,
                        }),
                  });
                }}
                disabled={matchPackInfo.available === 0}
              />
              <div className="space-y-1">
                <Label htmlFor="collectColorMatches">Collect Color Matches (consumes 1 Match Pack license)</Label>
                <p className={`text-sm ${matchPackInfo.available === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {matchPackInfo.available} of {matchPackInfo.total} available
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="autoRequestAnalogDrawdowns"
                checked={false}
                disabled={true}
              />
              <div className="space-y-1">
                <Label htmlFor="autoRequestAnalogDrawdowns" className="text-muted-foreground">Auto-request analog drawdowns for color matches</Label>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="forceDirectMeasurement"
                checked={false}
                disabled={true}
              />
              <div className="space-y-1">
                <Label htmlFor="forceDirectMeasurement" className="text-muted-foreground">Force direct measurement of color matches</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isDesignAgency && (
        <Card>
          <CardHeader>
            <CardTitle>Design Agency Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="shareCreatePackLicenses"
                checked={!!data.shareCreatePackLicenses}
                onCheckedChange={(checked) => {
                  const isChecked = Boolean(checked);
                  updateData({
                    shareCreatePackLicenses: isChecked,
                    ...(isChecked ? {} : { createPackLicenseCount: 0 }),
                  });
                }}
                disabled={createPackInfo.available === 0}
              />
              <div className="space-y-1">
                <Label htmlFor="shareCreatePackLicenses">Share Create Pack Licenses</Label>
                <p className={`text-sm ${createPackInfo.available === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {createPackInfo.available} of {createPackInfo.total} available
                </p>
              </div>
            </div>

            {data.shareCreatePackLicenses && (
              <div className="space-y-2 ml-6">
                <Label htmlFor="createPackLicenseCount">Number of licenses to share</Label>
                <Input
                  id="createPackLicenseCount"
                  type="number"
                  min="0"
                  max={createPackInfo.available}
                  value={data.createPackLicenseCount || 0}
                  onChange={(e) => {
                    const value = Math.min(createPackInfo.available, Math.max(0, parseInt(e.target.value) || 0));
                    updateData({ createPackLicenseCount: value });
                  }}
                  className="w-32"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isPrintSupplier && !isDesignAgency && (
        <Card>
          <CardHeader>
            <CardTitle>Role Options</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No specific options available for the selected roles.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Step2RoleOptions;
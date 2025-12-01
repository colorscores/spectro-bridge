import React, { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

const Step2BrandAccess = ({ formData, setFormData, partners = [], loading }) => {
  const availableBrands = useMemo(() => {
    const brands = (partners || []).map(p => ({
      id: p.id, // partner connection id
      name: p.partner_name,
      orgId: p.partner_organization_id,
      status: p.status,
    }));
    
    // Add "My Company" option for partner users to access their own organization's colors
    brands.unshift({
      id: 'my-company',
      name: 'My Company',
      orgId: formData.organizationId, // Use the selected user's organization
      status: 'connected',
    });
    
    return brands;
  }, [partners, formData.organizationId]);

  const toggleBrand = (partnerId) => {
    setFormData(prev => {
      const set = new Set(prev.selectedBrandIds || []);
      if (set.has(partnerId)) set.delete(partnerId); else set.add(partnerId);
      const nextSelected = Array.from(set);
      let nextActive = prev.activeBrandId;
      if (!nextActive && nextSelected.length === 1) nextActive = nextSelected[0];
      if (nextActive && !set.has(nextActive)) nextActive = nextSelected[0] || null;
      return { ...prev, selectedBrandIds: nextSelected, activeBrandId: nextActive };
    });
  };

  return (
    <div className="space-y-4 pt-4 max-w-md mx-auto">
      <div>
        <Label className="font-semibold">Library access</Label>
        <p className="text-sm text-muted-foreground mt-1">Select the library organizations this user can access.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-64">
            <ul className="divide-y">
              {loading ? (
                <li className="p-4 text-sm text-muted-foreground">Loading brands…</li>
              ) : availableBrands.length ? (
                availableBrands.map(b => (
                  <li key={b.id} className="p-4 flex items-center gap-3">
                    <Checkbox
                      id={`brand-${b.id}`}
                      checked={(formData.selectedBrandIds || []).includes(b.id)}
                      onCheckedChange={() => toggleBrand(b.id)}
                    />
                    <Label htmlFor={`brand-${b.id}`} className="cursor-pointer">{b.name}</Label>
                  </li>
                ))
              ) : (
                <li className="p-4 text-sm text-muted-foreground">No partner libraries found for the selected organization.</li>
              )}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">You can refine categories and tags per library on the next step.</p>
    </div>
  );
};

export default Step2BrandAccess;

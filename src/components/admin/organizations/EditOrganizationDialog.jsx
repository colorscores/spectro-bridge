import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const roleOptions = [
  { value: 'Brand', label: 'Brand' },
  { value: 'Printer', label: 'Printer' },
  { value: 'Print Supplier', label: 'Print Supplier' },
  { value: 'Premedia Agency', label: 'Premedia Agency' },
  { value: 'Design Agency', label: 'Design Agency' },
  { value: 'Vendor', label: 'Vendor' },
  { value: 'Ink Supplier', label: 'Ink Supplier' },
];

const EditOrganizationDialog = ({ isOpen, setIsOpen, organization, onOrganizationUpdated }) => {
  
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [types, setTypes] = useState([]);
  const [colorLibrariesLicense, setColorLibrariesLicense] = useState('Free');
  const [printerKioskLicense, setPrinterKioskLicense] = useState('No');
  const [matchPackLicense, setMatchPackLicense] = useState('1');
  const [createPackLicense, setCreatePackLicense] = useState('No');

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      const current = organization.type;
      setTypes(Array.isArray(current) ? current : (current ? [current] : []));
      setColorLibrariesLicense(organization.color_libraries_license || 'Free');
      setPrinterKioskLicense(organization.printer_kiosk_license || 'No');
      setMatchPackLicense(organization.match_pack_license || '1');
      setCreatePackLicense(organization.create_pack_license || 'No');
    }
  }, [organization]);

  const handleUpdateOrganization = async (e) => {
    e.preventDefault();
    if (!organization) return;

    setIsLoading(true);

    const { error } = await supabase
      .from('organizations')
      .update({ 
        name, 
        type: types,
        color_libraries_license: colorLibrariesLicense,
        printer_kiosk_license: printerKioskLicense,
        match_pack_license: matchPackLicense,
        create_pack_license: createPackLicense
      })
      .eq('id', organization.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update organization',
        description: error.message,
      });
    } else {
      toast({
        title: 'Organization updated successfully!',
      });
      onOrganizationUpdated();
      setIsOpen(false);
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleUpdateOrganization}>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update the organization's details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="org-name" className="text-right">
                Name
              </Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="org-roles" className="text-right">
                Role
              </Label>
              <div className="col-span-3">
                <MultiSelect
                  options={roleOptions}
                  selected={types}
                  onChange={setTypes}
                  placeholder="Select roles"
                />
              </div>
            </div>
            
            {/* Licensing Section */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-sm font-medium">Licensing</Label>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="libraries-license" className="text-right text-xs">
                  Libraries
                </Label>
                <Select value={colorLibrariesLicense} onValueChange={setColorLibrariesLicense}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Free">Free</SelectItem>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="kiosk-license" className="text-right text-xs">
                  Printer Kiosk
                </Label>
                <Select value={printerKioskLicense} onValueChange={setPrinterKioskLicense}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Lite">Lite</SelectItem>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {types.includes('Brand') && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="match-pack" className="text-right text-xs">
                    Match Pack
                  </Label>
                  <Input
                    id="match-pack"
                    type="number"
                    min="0"
                    value={matchPackLicense}
                    onChange={(e) => setMatchPackLicense(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="create-pack" className="text-right text-xs">
                  Create Pack
                </Label>
                <Select value={createPackLicense} onValueChange={setCreatePackLicense}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrganizationDialog;
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

const EditLocationDialog = ({ isOpen, setIsOpen, locationToEdit, onLocationUpdated }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (locationToEdit) {
      setName(locationToEdit.name || '');
      setAddress(locationToEdit.address || '');
      setCity(locationToEdit.city || '');
      setCountry(locationToEdit.country || '');
    }
  }, [locationToEdit]);

  const handleUpdateLocation = async () => {
    if (!name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!locationToEdit) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('organization_locations')
      .update({ name, address, city, country })
      .eq('id', locationToEdit.id);
    
    setIsSaving(false);
    if (error) {
      toast({ title: 'Error updating location', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success!', description: 'Location has been updated.' });
      onLocationUpdated();
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription>Update the details for this location.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">Address</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="city" className="text-right">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="country" className="text-right">Country</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateLocation} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditLocationDialog;
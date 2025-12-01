import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { toast } from '@/hooks/use-toast';

const AddToInkBookDialog = ({ isOpen, setIsOpen, selectedInkIds, onSuccess, inkBooks }) => {
  const [selectedBookIds, setSelectedBookIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useProfile();
  

  const bookOptions = inkBooks?.map(book => ({
    value: book.id,
    label: book.name
  })) || [];

  const handleSubmit = async () => {
    if (selectedBookIds.length === 0) {
      toast({ title: 'Selection required', description: 'Please select at least one ink book.', variant: 'destructive' });
      return;
    }

    if (!profile?.organization_id) {
      toast({ title: 'Error', description: 'You must be logged in to add inks to books.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Add inks to each selected book
      for (const bookId of selectedBookIds) {
        const { error } = await supabase
          .rpc('add_inks_to_book', {
            p_ink_ids: selectedInkIds,
            p_book_id: bookId,
            p_organization_id: profile.organization_id
          });

        if (error) throw error;
      }

      toast({ 
        title: 'Success', 
        description: `Successfully added ${selectedInkIds.length} ink(s) to ${selectedBookIds.length} book(s).` 
      });
      
      setSelectedBookIds([]);
      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: `Failed to add inks to books: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedBookIds([]);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Inks to Book</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Ink Books</Label>
            <MultiSelect
              options={bookOptions}
              selected={selectedBookIds}
              onChange={setSelectedBookIds}
              placeholder="Select ink books..."
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add to Books
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddToInkBookDialog;
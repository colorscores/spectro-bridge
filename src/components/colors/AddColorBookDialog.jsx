import React, { useState } from 'react';
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
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

const AddColorBookDialog = ({ isOpen, setIsOpen, onBookAdded }) => {
  const [bookName, setBookName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { profile } = useProfile();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bookName.trim() || !profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Book name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('color_books').insert({
        name: bookName.trim(),
        organization_id: profile.organization_id,
      }).select().single();

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Color book "${bookName.trim()}" has been created.`,
      });
      onBookAdded(data);
      setBookName('');
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Error creating book',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Color Book</DialogTitle>
            <DialogDescription>
              Create a new book to organize your colors.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="book-name" className="text-right">
                Book Name
              </Label>
              <Input
                id="book-name"
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Brand Colors 2025"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Book'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddColorBookDialog;
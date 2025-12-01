import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { toast } from '@/hooks/use-toast';

const AddInkBookDialog = ({ isOpen, setIsOpen, onBookAdded }) => {
  const [bookName, setBookName] = useState('');
  const [loading, setLoading] = useState(false);
  const { profile } = useProfile();
  

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!bookName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a name for the ink book.', variant: 'destructive' });
      return;
    }

    if (!profile?.organization_id) {
      toast({ title: 'Error', description: 'You must be logged in to create an ink book.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ink_books')
        .insert([{ 
          name: bookName.trim(),
          organization_id: profile.organization_id 
        }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Success', description: 'Ink book created successfully.' });
      setBookName('');
      setIsOpen(false);
      if (onBookAdded) onBookAdded();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: `Failed to create ink book: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setBookName('');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Ink Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="book-name">Book Name</Label>
            <Input
              id="book-name"
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              placeholder="Enter ink book name"
              disabled={loading}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Book
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddInkBookDialog;
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

const DeleteInkBookDialog = ({ isOpen, setIsOpen, selectedBookIds, onBooksDeleted }) => {
  const [loading, setLoading] = useState(false);
  

  const handleConfirm = async () => {
    if (selectedBookIds.length === 0) {
      toast({ title: 'No books selected', description: 'Please select books to delete.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('ink_books')
        .delete()
        .in('id', selectedBookIds);

      if (error) throw error;

      toast({ 
        title: 'Success', 
        description: `Successfully deleted ${selectedBookIds.length} ink book(s).` 
      });
      
      setIsOpen(false);
      if (onBooksDeleted) onBooksDeleted();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: `Failed to delete ink books: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Ink Books</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            Are you sure you want to delete {selectedBookIds.length} ink book(s)?
          </p>
          <p className="text-sm text-muted-foreground">
            This will remove the books and all their ink associations. The inks themselves will not be deleted.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Books
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteInkBookDialog;
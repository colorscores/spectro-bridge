import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { toast } from '@/hooks/use-toast';

const RemoveFromInkBookDialog = ({ isOpen, setIsOpen, context, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { profile } = useProfile();
  

  const associationsToRemove = useMemo(() => {
    if (!context?.selectedAssetIds) return [];
    
    return Array.from(context.selectedAssetIds)
      .filter(id => id.includes('::'))
      .map(id => {
        const [inkId, bookId] = id.split('::');
        return { inkId, bookId, associationId: id };
      });
  }, [context?.selectedAssetIds]);

  const handleConfirm = async () => {
    if (associationsToRemove.length === 0) {
      toast({ title: 'No items selected', description: 'Please select items to remove from books.', variant: 'destructive' });
      return;
    }

    if (!profile?.organization_id) {
      toast({ title: 'Error', description: 'You must be logged in to remove inks from books.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Get the actual association IDs from the database
      const { data: associations, error: fetchError } = await supabase
        .from('ink_book_associations')
        .select('id, ink_id, book_id')
        .in('ink_id', associationsToRemove.map(a => a.inkId))
        .in('book_id', associationsToRemove.map(a => a.bookId));

      if (fetchError) throw fetchError;

      // Filter to only the associations we want to remove
      const associationIds = associations
        .filter(assoc => 
          associationsToRemove.some(remove => 
            remove.inkId === assoc.ink_id && remove.bookId === assoc.book_id
          )
        )
        .map(assoc => assoc.id);

      if (associationIds.length === 0) {
        toast({ title: 'No associations found', description: 'No matching associations found to remove.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .rpc('delete_ink_book_associations', {
          p_association_ids: associationIds,
          p_organization_id: profile.organization_id
        });

      if (error) throw error;

      toast({ 
        title: 'Success', 
        description: `Successfully removed ${associationIds.length} ink(s) from book(s).` 
      });
      
      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: `Failed to remove inks from books: ${error.message}`, 
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
          <DialogTitle>Remove Inks from Books</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            Are you sure you want to remove {associationsToRemove.length} ink(s) from their respective books?
          </p>
          <p className="text-sm text-muted-foreground">
            This will only remove the association - the inks themselves will not be deleted.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove from Books
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveFromInkBookDialog;
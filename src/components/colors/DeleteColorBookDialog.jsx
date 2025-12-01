import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const DeleteColorBookDialog = ({ isOpen, setIsOpen, selectedBookIds, onBooksDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    if (selectedBookIds.length === 0) {
      toast({
        title: 'No color books selected',
        description: 'Please select at least one color book to delete.',
        variant: 'destructive',
      });
      setIsDeleting(false);
      setIsOpen(false);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('color_books')
        .delete()
        .in('id', selectedBookIds);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: 'Success!',
        description: `${selectedBookIds.length} color book(s) have been deleted.`,
      });
      onBooksDeleted();

    } catch (error) {
      toast({
        title: 'Error deleting color book(s)',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the selected {selectedBookIds.length} color book(s), but it will NOT delete the colors linked to them. To delete colors, please use the 'list view'.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleDelete} disabled={isDeleting} variant="destructive">
              {isDeleting ? 'Deleting...' : 'Yes, delete'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteColorBookDialog;
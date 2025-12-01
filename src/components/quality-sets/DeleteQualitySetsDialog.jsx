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

const DeleteQualitySetsDialog = ({ isOpen, setIsOpen, selectedQualitySetIds, onQualitySetsDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!selectedQualitySetIds || selectedQualitySetIds.length === 0) {
      toast({
        title: 'No quality sets selected',
        description: 'Please select at least one quality set to delete.',
        variant: 'destructive',
      });
      setIsDeleting(false);
      setIsOpen(false);
      return;
    }

    setIsDeleting(true);

    try {
      // Delete quality sets (cascading deletes will handle quality_rules and quality_levels)
      const { error } = await supabase
        .from('quality_sets')
        .delete()
        .in('id', selectedQualitySetIds);

      if (error) {
        throw error;
      }

      toast({
        title: 'Quality Sets Deleted',
        description: `${selectedQualitySetIds.length} quality set(s) and their associated rules have been deleted.`,
      });

      if (typeof onQualitySetsDeleted === 'function') {
        onQualitySetsDeleted();
      }

      setIsOpen(false);

    } catch (error) {
      console.error('Error deleting quality sets:', error);
      toast({
        title: 'Error deleting quality sets',
        description: error.message || 'An unexpected error occurred while deleting quality sets.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the selected {selectedQualitySetIds?.length || 0} quality set(s) and all associated quality rules and levels.
            {selectedQualitySetIds?.length > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                Any match requests referencing these quality sets may be affected.
              </div>
            )}
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

export default DeleteQualitySetsDialog;
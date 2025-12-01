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
import { ToastAction } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppContext';

const DeleteColorsDialog = ({ isOpen, setIsOpen, selectedColors, onColorsDeleted }) => {
  const { removeColorsOptimistically } = useAppContext();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const colorIds = selectedColors.map(c => c.id);

    if (colorIds.length === 0) {
      toast({
        title: 'No colors selected',
        description: 'Please select at least one color to delete.',
        variant: 'destructive',
      });
      setIsDeleting(false);
      setIsOpen(false);
      return;
    }

    // Verify user is authenticated before proceeding
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to delete colors.',
        variant: 'destructive',
      });
      setIsDeleting(false);
      setIsOpen(false);
      return;
    }
    
    // Optimistically remove from UI immediately
    const rollback = removeColorsOptimistically(colorIds);
    setIsOpen(false);
    
    // Create progress toast that we can update
    const progressToast = toast({ 
      title: 'Deleting colors…', 
      description: `Processing ${colorIds.length} color(s)…`,
      duration: Infinity // Keep it open until we update it
    });

    try {
      const { data, error } = await supabase.functions.invoke('delete-colors', {
        body: { color_ids: colorIds }, // Send as object, not JSON.stringify
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.error) {
        throw new Error(data.error);
      }

      // Handle response from chunked deletion
      const { success_ids = [], failed_ids = [], success, message } = data;

      // Dismiss progress toast
      progressToast.dismiss();

      if (success) {
        // Complete success
        toast({
          title: 'Deleted',
          description: message,
        });
        if (typeof onColorsDeleted === 'function') {
          onColorsDeleted();
        }
      } else {
        // Partial success - rollback only the failed colors
        const failedColorIds = failed_ids.map(f => f.id);
        rollback?.(failedColorIds); // Rollback only failed ones if rollback supports it
        
        toast({
          title: 'Partial deletion',
          description: `${message} ${failed_ids.length > 1 ? 'Some colors may be in use or locked.' : 'Color may be in use or locked.'}`,
          variant: 'destructive',
          action: failed_ids.length > 0 ? (
            <ToastAction altText="View details" onClick={() => {
              console.log('Failed deletions:', failed_ids);
              toast({
                title: 'Failed deletions',
                description:
                  failed_ids.slice(0, 3).map(f => f.error).join(', ') +
                  (failed_ids.length > 3 ? ` and ${failed_ids.length - 3} more...` : ''),
                variant: 'destructive',
              });
            }}>
              View details
            </ToastAction>
          ) : undefined,
        });

        if (typeof onColorsDeleted === 'function') {
          onColorsDeleted();
        }
      }

    } catch (error) {
      // Dismiss progress toast
      progressToast.dismiss();
      
      // Complete failure - rollback all optimistic changes
      rollback?.();
      toast({
        title: 'Error deleting colors',
        description: error.message,
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
            This action cannot be undone. This will permanently delete the selected {selectedColors.length} color(s) and all associated data. Any dependent colors will be unlinked from their master.
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

export default DeleteColorsDialog;
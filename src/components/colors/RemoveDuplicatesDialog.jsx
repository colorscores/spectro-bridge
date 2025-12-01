import React, { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '@/contexts/SupabaseAuthContext';

const RemoveDuplicatesDialog = ({ isOpen, setIsOpen, selectedColorIds, onDuplicatesRemoved }) => {
  const { profile } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [duplicatesFound, setDuplicatesFound] = useState(0);

  const findDuplicates = useCallback(async () => {
    if (!isOpen || selectedColorIds.length < 2 || !profile?.organization_id) {
      setDuplicatesFound(0);
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('find_duplicate_colors', {
        p_color_ids: selectedColorIds,
        p_organization_id: profile.organization_id,
      });

      if (error) throw error;
      
      setDuplicatesFound(data);

    } catch (error) {
      toast({
        title: 'Error finding duplicates',
        description: error.message,
        variant: 'destructive',
      });
      setDuplicatesFound(0);
    } finally {
      setIsProcessing(false);
    }
  }, [isOpen, selectedColorIds, profile?.organization_id, toast]);

  useEffect(() => {
    findDuplicates();
  }, [findDuplicates]);

  const handleRemove = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('find_and_delete_duplicate_colors', {
        p_color_ids: selectedColorIds,
        p_organization_id: profile.organization_id,
      });

      if (error) throw error;

      const { duplicates_found } = data;

      if (duplicates_found > 0) {
        toast({
          title: 'Success!',
          description: `${duplicates_found} duplicate color(s) have been removed.`,
        });
      } else {
        toast({
          title: 'No duplicates found',
          description: 'There were no duplicate colors in your selection.',
        });
      }
      onDuplicatesRemoved();
    } catch (error) {
      toast({
        title: 'Error removing duplicates',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setIsOpen(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Duplicate Colors</AlertDialogTitle>
          <AlertDialogDescription>
            {isProcessing && "Checking for duplicates..."}
            {!isProcessing && duplicatesFound > 0 && `Found ${duplicatesFound} duplicate(s) in your selection. This will permanently delete the newer copies, keeping the oldest one. This action cannot be undone.`}
            {!isProcessing && duplicatesFound === 0 && "No duplicates were found in your selection."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleRemove} disabled={isProcessing || duplicatesFound === 0} variant="destructive">
              {isProcessing ? 'Processing...' : `Remove ${duplicatesFound} duplicate(s)`}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RemoveDuplicatesDialog;
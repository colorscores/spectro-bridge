import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';

const ID_DELIMITER = '::';

const RemoveFromBookDialog = ({ isOpen, setIsOpen, context, onSuccess }) => {
  const { selectedAssetIds } = context;
  const { profile } = useProfile();
  const { colors: allColors, colorBooks } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { colorsToRemove, book } = useMemo(() => {
    if (!selectedAssetIds || selectedAssetIds.size === 0 || !allColors || !colorBooks) {
      return { colorsToRemove: [], book: null };
    }

    const firstId = Array.from(selectedAssetIds)[0];
    const parts = firstId.split(ID_DELIMITER);
    
    if (parts.length < 2) {
      return { colorsToRemove: [], book: null };
    }

    const bookId = parts[1];
    const targetBook = colorBooks.find(b => b.id === bookId);

    if (!targetBook) {
      return { colorsToRemove: [], book: null };
    }
    
    const removedColors = [];

    Array.from(selectedAssetIds).forEach(id => {
      const [colorId, idBookId] = id.split(ID_DELIMITER);
      
      if (idBookId === bookId) {
        const color = allColors.find(c => c.id === colorId);
        
        if (color && color.book_ids && color.book_ids.includes(bookId)) {
          removedColors.push(color);
        }
      }
    });

    return { colorsToRemove: removedColors, book: targetBook };
  }, [selectedAssetIds, allColors, colorBooks]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!book || colorsToRemove.length === 0 || !profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Missing required information to remove colors.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the actual association IDs from the database
      const colorIds = colorsToRemove.map(c => c.id);
      
      const { data: associations, error: fetchError } = await supabase
        .from('color_book_associations')
        .select('id')
        .in('color_id', colorIds)
        .eq('book_id', book.id)
        .eq('organization_id', profile.organization_id);

      if (fetchError) throw fetchError;
      
      const associationIds = associations.map(a => a.id);

      if (associationIds.length === 0) {
        throw new Error('No associations found to delete');
      }

      const { error } = await supabase.rpc('delete_color_book_associations', {
        p_association_ids: associationIds,
        p_organization_id: profile.organization_id,
      });

      if (error) throw error;
      
      // Refresh materialized view to update the book_ids
      await supabase.rpc('refresh_colors_with_full_details');
      
      await queryClient.invalidateQueries({ queryKey: ['colors', profile.organization_id] });
      await queryClient.invalidateQueries({ queryKey: ['color_books', profile.organization_id] });

      toast({
        title: 'Success!',
        description: `${colorsToRemove.length} color(s) removed from "${book.name}".`,
      });
      if(onSuccess) onSuccess();
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Error removing colors',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!book || !colorsToRemove || colorsToRemove.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Remove Colors from Book</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {colorsToRemove.length} selected color(s) from the book "{book.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="font-semibold">Colors to be removed:</p>
            <ul className="list-disc list-inside max-h-40 overflow-y-auto mt-2 text-sm text-muted-foreground">
                {colorsToRemove.map(color => <li key={color.id}>{color.name}</li>)}
            </ul>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? 'Removing...' : 'Confirm Removal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveFromBookDialog;
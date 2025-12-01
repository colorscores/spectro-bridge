import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

const AddToBookDialog = ({ isOpen, setIsOpen, selectedColorIds, colorBooks, onSuccess }) => {
  const [selectedBookId, setSelectedBookId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingBook, setIsCreatingBook] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [localBooks, setLocalBooks] = useState(colorBooks || []);
  const { profile } = useProfile();

  useEffect(() => {
    if (!isOpen) {
      setSelectedBookId('');
      setShowCreateNew(false);
      setNewBookName('');
    }
  }, [isOpen]);

  useEffect(() => {
    setLocalBooks(colorBooks || []);
  }, [colorBooks]);

  const handleCreateBook = async () => {
    const name = newBookName.trim();
    if (!name) {
      toast({ title: 'Enter a name', description: 'Please provide a book name to create it.', variant: 'destructive' });
      return;
    }
    if (!profile?.organization_id) {
      toast({ title: 'Error', description: 'Missing organization context.', variant: 'destructive' });
      return;
    }
    setIsCreatingBook(true);
    try {
      const { data, error } = await supabase
        .from('color_books')
        .insert({ name, organization_id: profile.organization_id })
        .select('id, name')
        .single();

      if (error) throw error;

      setLocalBooks((prev) => [...prev, data]);
      setSelectedBookId(data.id);
      setShowCreateNew(false);
      toast({ title: 'Book created', description: `Created "${data.name}".` });
    } catch (error) {
      toast({ title: 'Failed to create book', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreatingBook(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBookId || !profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Please select a color book and ensure you are logged in.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('add_colors_to_book', {
        p_color_ids: selectedColorIds,
        p_book_id: selectedBookId,
        p_organization_id: profile.organization_id,
      });

      if (error) throw error;

      // Ensure materialized view reflects new associations before refetch
      await supabase.rpc('refresh_colors_with_full_details');

      const selectedBook = localBooks.find((b) => b.id === selectedBookId);
      toast({
        title: 'Success!',
        description: `${selectedColorIds.length} color(s) added to "${selectedBook?.name || 'the book'}".`,
      });
      onSuccess();
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Error adding colors to book',
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
            <DialogTitle>Add Colors to Book</DialogTitle>
            <DialogDescription>
              Select a book to add the {selectedColorIds.length} selected color(s) to.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="book-select" className="text-right">
                Color Book
              </Label>
              <Select
                onValueChange={(val) => {
                  if (val === '__create__') {
                    setShowCreateNew(true);
                    setSelectedBookId('');
                  } else {
                    setSelectedBookId(val);
                    setShowCreateNew(false);
                  }
                }}
                value={selectedBookId || (showCreateNew ? '__create__' : '')}
              >
                <SelectTrigger id="book-select" className="col-span-3">
                  <SelectValue placeholder="Select a book" />
                </SelectTrigger>
                <SelectContent>
                  {(localBooks || []).map((book) => (
                    <SelectItem key={book.id} value={book.id}>
                      {book.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__create__">Create new book...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCreateNew && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-book-name" className="text-right">
                  New Book
                </Label>
                <div className="col-span-3 flex gap-2">
                  <Input
                    id="new-book-name"
                    value={newBookName}
                    onChange={(e) => setNewBookName(e.target.value)}
                    placeholder="Enter book name"
                  />
                  <Button type="button" onClick={handleCreateBook} disabled={isCreatingBook || !newBookName.trim()}>
                    {isCreatingBook ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedBookId}>
              {isSubmitting ? 'Adding...' : 'Add to Book'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddToBookDialog;

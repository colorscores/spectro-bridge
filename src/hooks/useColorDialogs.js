import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useColors } from '@/context/ColorContext';

export const useColorDialogs = (selectedAssetIds, selectedBookIds, allAssets) => {
  const [isAssignTagsOpen, setIsAssignTagsOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddToBookOpen, setIsAddToBookOpen] = useState(false);
  const [isRemoveFromBookOpen, setIsRemoveFromBookOpen] = useState(false);
  const [isChangeTypeOpen, setIsChangeTypeOpen] = useState(false);
  const [isRemoveDuplicatesOpen, setIsRemoveDuplicatesOpen] = useState(false);
  const [isDeleteBookOpen, setIsDeleteBookOpen] = useState(false);
  const [removeFromBookContext, setRemoveFromBookContext] = useState({ book: null, colors: [] });
  const [selectedColorsForDialogs, setSelectedColorsForDialogs] = useState([]);

  const { toast } = useToast();
  const { colorBooks, loading } = useColors();

  const getCleanColorIds = useCallback(() => {
    return Array.from(selectedAssetIds).map(id => id.split('-')[0]);
  }, [selectedAssetIds]);

  const handleTagClick = useCallback(() => {
    if (loading) {
      toast({ title: "Please wait", description: "Data is still loading." });
      return;
    }
    const colorIds = getCleanColorIds();
    if (colorIds.length > 0) {
      const colors = allAssets.filter(c => colorIds.includes(c.id));
      setSelectedColorsForDialogs(colors);
      setIsAssignTagsOpen(true);
    } else {
      toast({ title: "No colors selected", description: "Please select at least one color to assign tags." });
    }
  }, [loading, getCleanColorIds, allAssets, toast]);

  const handleEditClick = useCallback(() => {
    const colorIds = getCleanColorIds();
    if (colorIds.length === 1) {
      const color = allAssets.find(c => c.id === colorIds[0]);
      if (color) {
        setSelectedColorsForDialogs([color]);
        setIsEditDialogOpen(true);
      } else {
        toast({ title: "Invalid selection", description: "Selected color not found." });
      }
    } else {
      toast({ title: "Invalid selection", description: "Please select exactly one color to edit." });
    }
  }, [getCleanColorIds, allAssets, toast]);


  const handleDeleteClick = useCallback(() => {
    const colorIds = getCleanColorIds();
    if (colorIds.length > 0) {
      const colors = allAssets.filter(c => colorIds.includes(c.id));
      setSelectedColorsForDialogs(colors);
      setIsDeleteDialogOpen(true);
    } else {
      toast({ title: "No colors selected", description: "Please select at least one color to delete." });
    }
  }, [getCleanColorIds, allAssets, toast]);

  const handleAddToBookClick = useCallback(() => {
    const colorIds = getCleanColorIds();
    if (colorIds.length > 0) {
      const colors = allAssets.filter(c => colorIds.includes(c.id));
      setSelectedColorsForDialogs(colors);
      setIsAddToBookOpen(true);
    } else {
      toast({ title: "No colors selected", description: "Please select at least one color to add to a book." });
    }
  }, [getCleanColorIds, allAssets, toast]);

  const handleRemoveFromBookClick = useCallback(() => {
    if (selectedAssetIds.size === 0) {
      toast({ title: "No colors selected", description: "Please select at least one color to remove from a book." });
      return;
    }
    
    let targetBook = null;
    const colorsToRemove = [];
    const colorIdsToRemove = new Set();

    for (const selectionId of selectedAssetIds) {
        const [colorId, bookId] = selectionId.split('-');
        if (!bookId) {
            toast({ title: "Invalid Selection", description: "You can only remove colors that are inside a book.", variant: "destructive" });
            return;
        }

        const currentBook = colorBooks.find(g => g.id === bookId);
        if (!currentBook) {
            console.warn(`Could not find book with ID ${bookId} in colorBooks.`);
            continue;
        }

        if (targetBook && targetBook.id !== currentBook.id) {
            toast({ title: "Cross-book selection", description: "You can only remove colors from one book at a time.", variant: "destructive" });
            return;
        }
        targetBook = currentBook;
        
        if (!colorIdsToRemove.has(colorId)) {
            const color = allAssets.find(c => c.id === colorId);
            if (color) {
                colorsToRemove.push(color);
                colorIdsToRemove.add(colorId);
            }
        }
    }

    if (!targetBook || colorsToRemove.length === 0) {
      toast({ title: "Invalid selection", description: "Selected colors are not in a book or could not be found." });
      return;
    }
    
    setRemoveFromBookContext({ book: targetBook, colors: colorsToRemove });
    setIsRemoveFromBookOpen(true);
  }, [selectedAssetIds, allAssets, colorBooks, toast]);

  const handleChangeTypeClick = useCallback(() => {
    const colorIds = getCleanColorIds();
    if (colorIds.length > 0) {
      const colors = allAssets.filter(c => colorIds.includes(c.id));
      setSelectedColorsForDialogs(colors);
      setIsChangeTypeOpen(true);
    } else {
      toast({ title: "No colors selected", description: "Please select colors to change their type." });
    }
  }, [getCleanColorIds, allAssets, toast]);

  const handleRemoveDuplicatesClick = useCallback(() => {
    const colorIds = getCleanColorIds();
    if (colorIds.length > 1) {
      const colors = allAssets.filter(c => colorIds.includes(c.id));
      setSelectedColorsForDialogs(colors);
      setIsRemoveDuplicatesOpen(true);
    } else {
      toast({ title: "Not enough colors", description: "Please select at least two colors to find duplicates." });
    }
  }, [getCleanColorIds, allAssets, toast]);

  const handleDeleteBookClick = useCallback(() => {
    if (selectedBookIds.size > 0) {
      setIsDeleteBookOpen(true);
    } else {
      toast({ title: "No books selected", description: "Please select at least one book to delete." });
    }
  }, [selectedBookIds.size, toast]);
  
  return {
    isAssignTagsOpen,
    isEditDialogOpen,
    isDeleteDialogOpen,
    isAddToBookOpen,
    isRemoveFromBookOpen,
    isChangeTypeOpen,
    isRemoveDuplicatesOpen,
    isDeleteBookOpen,
    removeFromBookContext,
    setIsAssignTagsOpen,
    setIsEditDialogOpen,
    setIsDeleteDialogOpen,
    setIsAddToBookOpen,
    setIsRemoveFromBookOpen,
    setIsChangeTypeOpen,
    setIsRemoveDuplicatesOpen,
    setIsDeleteBookOpen,
    handleTagClick,
    handleEditClick,
    handleDeleteClick,
    handleAddToBookClick,
    handleRemoveFromBookClick,
    handleChangeTypeClick,
    handleRemoveDuplicatesClick,
    handleDeleteBookClick,
    selectedColorsForDialogs,
  };
};
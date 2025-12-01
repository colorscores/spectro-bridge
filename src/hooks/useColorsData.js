
import React, { useMemo } from 'react';

export const useColorsData = (allColors, filteredColors, colorBooks, associations) => {
  return useMemo(() => {
    // console.log('🔍 useColorsData inputs:', {
    //   allColors: allColors?.length || 0,
    //   filteredColors: filteredColors?.length || 0,
    //   colorBooks: colorBooks?.length || 0,
    //   associations: associations?.length || 0
    // });

    const colorsMap = new Map(allColors.map(c => [c.id, c]));
    
    const bookIdToColorsMap = new Map();
    (colorBooks || []).forEach(book => {
      bookIdToColorsMap.set(book.id, {
        id: book.id,
        name: book.name,
        assets: [],
      });
    });

    // Process associations first
    (associations || []).forEach(assoc => {
      const book = bookIdToColorsMap.get(assoc.book_id);
      const color = colorsMap.get(assoc.color_id);
      if (book && color) {
        book.assets.push(color);
      }
    });

    // Fallback: if colors have book_ids but no associations were processed, use book_ids
    let fallbackAssociations = 0;
    if (associations?.length === 0 && allColors.some(c => c.book_ids?.length > 0)) {
      // console.log('🔄 Using fallback: processing color.book_ids');
      allColors.forEach(color => {
        if (color.book_ids && Array.isArray(color.book_ids)) {
          color.book_ids.forEach(bookId => {
            const book = bookIdToColorsMap.get(bookId);
            if (book && !book.assets.find(asset => asset.id === color.id)) {
              book.assets.push(color);
              fallbackAssociations++;
            }
          });
        }
      });
    }

    // Compute assigned color IDs from both sources
    const assignedColorIds = new Set();
    
    // From associations
    (associations || []).forEach(a => assignedColorIds.add(a.color_id));
    
    // From book_ids fallback
    allColors.forEach(color => {
      if (color.book_ids && Array.isArray(color.book_ids) && color.book_ids.length > 0) {
        assignedColorIds.add(color.id);
      }
    });

    const unassignedColors = filteredColors.filter(c => !assignedColorIds.has(c.id));

    // console.log('📊 useColorsData results:', {
    //   associations: associations?.length || 0,
    //   fallbackAssociations,
    //   assignedColors: assignedColorIds.size,
    //   unassignedColors: unassignedColors.length,
    //   totalBooks: bookIdToColorsMap.size,
    //   booksWithColors: Array.from(bookIdToColorsMap.values()).filter(book => book.assets.length > 0).length
    // });

    const processedGroups = Array.from(bookIdToColorsMap.values());

    if (unassignedColors.length > 0) {
      processedGroups.push({ id: 'unassigned', name: 'Unassigned', assets: unassignedColors });
    }

    const sortedGroups = processedGroups.sort((a, b) => {
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      return a.name.localeCompare(b.name);
    });

    const masters = [];
    const dependentsMap = new Map();

    for (const color of filteredColors) {
      if (color.master_color_id) {
        if (!dependentsMap.has(color.master_color_id)) {
          dependentsMap.set(color.master_color_id, []);
        }
        dependentsMap.get(color.master_color_id).push(color);
      } else {
        masters.push(color);
      }
    }

    const processedHierarchicalAssets = masters.map(master => ({
      ...master,
      dependents: dependentsMap.get(master.id) || []
    }));
    
    return { assetGroups: sortedGroups, allAssets: filteredColors, hierarchicalAssets: processedHierarchicalAssets };
  }, [allColors, filteredColors, colorBooks, associations]);
};

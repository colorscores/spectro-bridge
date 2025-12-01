
import { useMemo } from 'react';

export const computeColorsView = (filteredColors, colorBooks, viewMode, allColors = null, associations = null) => {
  // Early return for flat view - no need to compute book groups or hierarchies
  if (viewMode === 'flat') {
    return { 
      assetGroups: [], 
      allAssets: filteredColors || [], 
      hierarchicalAssets: [] 
    };
  }

  // For book view - compute book groups only
  if (viewMode === 'book') {
    const bookIdToColorsMap = new Map();
    const bookColorSets = new Map();
    
    (colorBooks || []).forEach(book => {
      bookIdToColorsMap.set(book.id, {
        id: book.id,
        name: book.name,
        assets: [],
        totalCount: 0,
      });
      bookColorSets.set(book.id, new Set());
    });

    const filteredColorsSet = new Set((filteredColors || []).map(c => c.id));
    
    if (associations?.length) {
      const allColorsMap = new Map((allColors || []).map(c => [c.id, c]));
      
      associations.forEach(association => {
        const book = bookIdToColorsMap.get(association.book_id);
        const color = allColorsMap.get(association.color_id);
        if (book && color) {
          const colorSet = bookColorSets.get(association.book_id);
          colorSet.add(color.id);
          book.totalCount = colorSet.size;
          
          if (filteredColorsSet.has(color.id)) {
            book.assets.push(color);
          }
        }
      });
    } else {
      const colorsToProcess = allColors || filteredColors || [];
      
      colorsToProcess.forEach(color => {
        if (color.book_ids && Array.isArray(color.book_ids)) {
          color.book_ids.forEach(bookId => {
            const book = bookIdToColorsMap.get(bookId);
            if (book) {
              const colorSet = bookColorSets.get(bookId);
              colorSet.add(color.id);
              book.totalCount = colorSet.size;
              
              if (filteredColorsSet.has(color.id)) {
                book.assets.push(color);
              }
            }
          });
        }
      });
    }

    const processedGroups = Array.from(bookIdToColorsMap.values());
    processedGroups.forEach(book => {
      book.totalCount = Math.max(book.totalCount, book.assets.length);
    });

    const sortedGroups = processedGroups.sort((a, b) => a.name.localeCompare(b.name));
    
    return { 
      assetGroups: sortedGroups, 
      allAssets: filteredColors || [], 
      hierarchicalAssets: [] 
    };
  }

  // For dependent view - compute hierarchies only
  if (viewMode === 'dependent') {
    const masters = [];
    const dependentsMap = new Map();

    for (const color of (filteredColors || [])) {
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
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    return { 
      assetGroups: [], 
      allAssets: filteredColors || [], 
      hierarchicalAssets: processedHierarchicalAssets 
    };
  }

  // Fallback (shouldn't happen)
  return { 
    assetGroups: [], 
    allAssets: filteredColors || [], 
    hierarchicalAssets: [] 
  };
};

export const useMemoizedColors = (filteredColors, colorBooks, viewMode, allColors = null, associations = null) => {
  return useMemo(() => computeColorsView(filteredColors, colorBooks, viewMode, allColors, associations), [filteredColors, colorBooks, viewMode, allColors, associations]);
};

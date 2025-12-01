
import { useState, useMemo, useCallback } from 'react';

const ID_DELIMITER = '::';

export const useColorSelection = (allAssets = [], assetGroups = []) => {
  const [selectedAssetIds, setSelectedAssetIds] = useState(new Set());
  const [selectedBookIds, setSelectedBookIds] = useState(new Set());
  const [activeAssetId, setActiveAssetId] = useState(null);

  const selectedAssetForPane = useMemo(() => {
    if (!activeAssetId || !allAssets) return null;
    const cleanId = activeAssetId.split(ID_DELIMITER)[0];
    return allAssets.find(asset => asset.id === cleanId) || null;
  }, [activeAssetId, allAssets]);

  const closePane = useCallback(() => {
    setActiveAssetId(null);
  }, []);

  const handleAssetRowClick = useCallback((assetId, bookId = null) => {
    const uniqueId = bookId ? `${assetId}${ID_DELIMITER}${bookId}` : assetId;
    setActiveAssetId(prev => (prev === uniqueId ? null : uniqueId));
  }, []);

  const handleSelectAsset = useCallback((assetId, isSelected, bookId = null) => {
    const uniqueId = bookId ? `${assetId}${ID_DELIMITER}${bookId}` : assetId;
    setSelectedAssetIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(uniqueId);
      } else {
        newSet.delete(uniqueId);
      }
      return newSet;
    });
  }, []);

  const handleSelectBook = useCallback((bookId, isSelected) => {
    setSelectedBookIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(bookId);
      } else {
        newSet.delete(bookId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((checked, rowsInView) => {
    if (checked) {
        const newAssetIds = new Set();
        const newBookIds = new Set();
        rowsInView.forEach(row => {
            if (row.isGroup) { // It's a book
                newBookIds.add(row.id);
            } else { // It's a color
                const uniqueId = row.parentBookId ? `${row.id}${ID_DELIMITER}${row.parentBookId}` : row.id;
                newAssetIds.add(uniqueId);
            }
        });
        setSelectedAssetIds(newAssetIds);
        setSelectedBookIds(newBookIds);
    } else {
        setSelectedAssetIds(new Set());
        setSelectedBookIds(new Set());
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAssetIds(new Set());
    setSelectedBookIds(new Set());
  }, []);

  const getSelectedColorIds = useCallback(() => {
    const colorIds = new Set();
    selectedAssetIds.forEach(id => {
      colorIds.add(id.split(ID_DELIMITER)[0]);
    });
    return [...colorIds];
  }, [selectedAssetIds]);

  return {
    selectedAssetIds,
    selectedBookIds,
    setSelectedAssetIds,
    setSelectedBookIds,
    activeAssetId,
    setActiveAssetId,
    selectedAssetForPane,
    handleSelectAsset,
    handleSelectBook,
    handleSelectAll,
    handleAssetRowClick,
    closePane,
    clearSelection,
    getSelectedColorIds,
  };
};

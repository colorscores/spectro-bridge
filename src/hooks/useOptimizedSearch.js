import { useMemo } from 'react';
import { useDebounce } from './useDebounce';

export const useOptimizedSearch = (data, searchTerm, searchFields = ['name'], delay = 300) => {
  const debouncedSearchTerm = useDebounce(searchTerm, delay);

  return useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    if (!debouncedSearchTerm?.trim()) return data;

    const term = debouncedSearchTerm.toLowerCase().trim();

    return data.filter(item => {
      return searchFields.some(field => {
        const value = getNestedValue(item, field);
        if (Array.isArray(value)) {
          return value.some(v => 
            typeof v === 'string' 
              ? v.toLowerCase().includes(term)
              : v?.name?.toLowerCase().includes(term)
          );
        }
        return value?.toString().toLowerCase().includes(term);
      });
    });
  }, [data, debouncedSearchTerm, searchFields]);
};

// Helper function to get nested object values
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
};
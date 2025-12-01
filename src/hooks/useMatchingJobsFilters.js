import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const useMatchingJobsFilters = () => {
  const [filterRows, setFilterRows] = useState([]);

  const addFilterRow = useCallback(() => {
    setFilterRows(prev => [...prev, { id: uuidv4(), property: '', value: null }]);
  }, []);

  const removeFilterRow = useCallback((id) => {
    setFilterRows(prev => prev.filter(row => row.id !== id));
  }, []);

  const changeFilterRow = useCallback((id, updates) => {
    setFilterRows(prev => prev.map(row => 
      row.id === id ? { ...row, ...updates } : row
    ));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterRows([]);
  }, []);

  const applyFilters = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    if (filterRows.length === 0) return list;

    let filtered = [...list];

    filterRows.forEach(row => {
      if (!row.property || row.value === null || row.value === undefined) return;

      // Job Status filter
      if (row.property === 'jobStatus' && Array.isArray(row.value) && row.value.length > 0) {
        filtered = filtered.filter(req => row.value.includes(req.calculatedStatus));
      }

      // Match Status filter
      if (row.property === 'matchStatus' && Array.isArray(row.value) && row.value.length > 0) {
        filtered = filtered.filter(req => 
          req.colors?.some(color => row.value.includes(color.status))
        );
      }

      // Printer Location filter
      if (row.property === 'printerLocation' && row.value) {
        filtered = filtered.filter(req => {
          const locationStr = `${req.shared_with} - ${req.location}`;
          return locationStr === row.value;
        });
      }

      // Match Colors filter
      if (row.property === 'matchColors' && Array.isArray(row.value) && row.value.length > 0) {
        filtered = filtered.filter(req =>
          req.colors?.some(color => row.value.includes(color.id))
        );
      }

      // Date Shared filter
      if (row.property === 'dateShared' && row.value?.start && row.value?.end) {
        filtered = filtered.filter(req => {
          if (!req.date_shared) return false;
          return req.date_shared >= row.value.start && req.date_shared <= row.value.end;
        });
      }

      // Due Date filter
      if (row.property === 'dueDate' && row.value?.start && row.value?.end) {
        filtered = filtered.filter(req => {
          if (!req.due_date) return false;
          return req.due_date >= row.value.start && req.due_date <= row.value.end;
        });
      }
    });

    return filtered;
  }, [filterRows]);

  const generateFilterOptions = useCallback((matchRequests, colors) => {
    // Generate unique printer location options
    const locationSet = new Set();
    matchRequests?.forEach(req => {
      if (req.shared_with && req.location) {
        locationSet.add(`${req.shared_with} - ${req.location}`);
      }
    });
    const printerLocationOptions = Array.from(locationSet).map(loc => ({ value: loc, label: loc }));

    // Generate match color options
    const matchColorOptions = (colors || []).map(color => ({
      value: color.id,
      label: color.name
    }));

    return { printerLocationOptions, matchColorOptions };
  }, []);

  const isFilterActive = useMemo(() => {
    return filterRows.some(row => {
      if (!row.property) return false;
      if (Array.isArray(row.value)) return row.value.length > 0;
      if (row.value && typeof row.value === 'object') {
        return row.value.start && row.value.end;
      }
      return row.value !== null && row.value !== undefined && row.value !== '';
    });
  }, [filterRows]);

  return {
    filterRows,
    addFilterRow,
    removeFilterRow,
    changeFilterRow,
    clearFilters,
    applyFilters,
    generateFilterOptions,
    isFilterActive,
  };
};


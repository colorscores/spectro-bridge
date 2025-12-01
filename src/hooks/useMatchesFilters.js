import { useState, useCallback, useMemo } from 'react';

export const useMatchesFilters = () => {
  // Initialize filters from URL if available, otherwise empty
  let initialPrintSupplier = '';
  let initialPrintCondition = '';
  try {
    const params = new URLSearchParams(window.location?.search || '');
    initialPrintSupplier = params.get('printSupplier') || '';
    initialPrintCondition = params.get('printCondition') || '';
  } catch (_) {}
  
  // Local state for filters (decoupled from Router context)
  const [filters, setFilters] = useState({
    printSupplier: initialPrintSupplier,
    printCondition: initialPrintCondition,
  });

  // Update local filters (no Router dependency)
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);

    // Best-effort update of URL without relying on react-router
    try {
      const params = new URLSearchParams(window.location?.search || '');
      if (newFilters.printSupplier) params.set('printSupplier', newFilters.printSupplier); else params.delete('printSupplier');
      if (newFilters.printCondition) params.set('printCondition', newFilters.printCondition); else params.delete('printCondition');
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    } catch (_) {}
  }, []);

  const setPrintSupplier = useCallback((value) => {
    const newValue = value === 'all' ? '' : value;
    updateFilters({ ...filters, printSupplier: newValue });
  }, [filters, updateFilters]);

  const setPrintCondition = useCallback((value) => {
    const newValue = value === 'all' ? '' : value;
    updateFilters({ ...filters, printCondition: newValue });
  }, [filters, updateFilters]);

  const clearFilters = useCallback(() => {
    updateFilters({ printSupplier: '', printCondition: '' });
  }, [updateFilters]);

  // Apply filters to matches array
  const applyFilters = useCallback((matches) => {
    if (!matches || matches.length === 0) return matches;

    return matches.filter(match => {
      let matchesFilter = true;

      // Filter by Print Supplier (matched_by_name)
      if (filters.printSupplier && filters.printSupplier !== '') {
        matchesFilter = matchesFilter && 
          match.matched_by_name && 
          match.matched_by_name.toLowerCase().includes(filters.printSupplier.toLowerCase());
      }

      // Filter by Print Condition (match_print_condition)
      if (filters.printCondition && filters.printCondition !== '') {
        matchesFilter = matchesFilter && 
          match.match_print_condition && 
          match.match_print_condition.toLowerCase().includes(filters.printCondition.toLowerCase());
      }

      return matchesFilter;
    });
  }, [filters]);

  // Generate filter options from matches data
  const generateFilterOptions = useCallback((matches) => {
    if (!matches || matches.length === 0) {
      return { printSupplierOptions: [], printConditionOptions: [] };
    }

    const printSuppliers = [...new Set(
      matches
        .map(match => match.matched_by_name)
        .filter(Boolean)
    )].sort();

    const printConditions = [...new Set(
      matches
        .map(match => match.match_print_condition)
        .filter(Boolean)
    )].sort();

    return {
      printSupplierOptions: printSuppliers.map(supplier => ({
        value: supplier,
        label: supplier
      })),
      printConditionOptions: printConditions.map(condition => ({
        value: condition,
        label: condition
      }))
    };
  }, []);

  // Check if any filters are active
  const isFilterActive = useMemo(() => {
    return filters.printSupplier !== '' || filters.printCondition !== '';
  }, [filters]);

  return {
    filters,
    setPrintSupplier,
    setPrintCondition,
    clearFilters,
    applyFilters,
    generateFilterOptions,
    isFilterActive
  };
};
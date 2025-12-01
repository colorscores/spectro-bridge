import React from 'react';

export const useActivityFilters = () => {
  const [filterRows, setFilterRows] = React.useState([]);

  const addFilterRow = () => {
    setFilterRows([
      ...filterRows,
      { id: Date.now(), property: '', operator: '', values: [] }
    ]);
  };

  const removeFilterRow = (id) => {
    setFilterRows(filterRows.filter(row => row.id !== id));
  };

  const changeFilterRow = (id, field, value) => {
    setFilterRows(filterRows.map(row => {
      if (row.id === id) {
        const updates = { [field]: value };
        
        // Reset values when property changes
        if (field === 'property') {
          updates.values = [];
          updates.operator = getDefaultOperator(value);
        }
        
        return { ...row, ...updates };
      }
      return row;
    }));
  };

  const clearFilters = () => {
    setFilterRows([]);
  };

  const getDefaultOperator = (property) => {
    switch (property) {
      case 'activity':
      case 'type':
        return 'is';
      case 'user':
      case 'company':
      case 'receiver':
        return 'includes';
      case 'date':
        return 'between';
      default:
        return '';
    }
  };

  const generateFilterOptions = (activities) => {
    const options = {
      activity: new Set(),
      user: new Set(),
      company: new Set(),
      receiver: new Set(),
      type: new Set()
    };

    activities.forEach(activity => {
      if (activity.activity) options.activity.add(activity.activity);
      if (activity.user) options.user.add(activity.user);
      if (activity.company) options.company.add(activity.company);
      if (activity.receiver) options.receiver.add(activity.receiver);
      if (activity.type) options.type.add(activity.type);
    });

    return {
      activity: Array.from(options.activity).sort(),
      user: Array.from(options.user).sort(),
      company: Array.from(options.company).sort(),
      receiver: Array.from(options.receiver).sort(),
      type: Array.from(options.type).sort()
    };
  };

  const applyFilters = (activities) => {
    if (filterRows.length === 0) return activities;

    return activities.filter(activity => {
      return filterRows.every(filter => {
        if (!filter.property || !filter.operator) return true;

        const value = activity[filter.property];
        const filterValues = filter.values || [];

        switch (filter.operator) {
          case 'is':
            return filterValues.length === 0 || filterValues.includes(value);
          case 'is not':
            return filterValues.length === 0 || !filterValues.includes(value);
          case 'includes':
            return filterValues.length === 0 || filterValues.some(fv => 
              value?.toLowerCase().includes(fv.toLowerCase())
            );
          case 'excludes':
            return filterValues.length === 0 || !filterValues.some(fv => 
              value?.toLowerCase().includes(fv.toLowerCase())
            );
          case 'between':
            if (!filter.startDate || !filter.endDate) return true;
            const activityDate = new Date(activity.created_at || activity.date);
            return activityDate >= new Date(filter.startDate) && 
                   activityDate <= new Date(filter.endDate);
          case 'on':
            if (!filter.startDate) return true;
            const onDate = new Date(activity.created_at || activity.date).toDateString();
            return onDate === new Date(filter.startDate).toDateString();
          case 'before':
            if (!filter.startDate) return true;
            return new Date(activity.created_at || activity.date) < new Date(filter.startDate);
          case 'after':
            if (!filter.startDate) return true;
            return new Date(activity.created_at || activity.date) > new Date(filter.startDate);
          default:
            return true;
        }
      });
    });
  };

  const isFilterActive = filterRows.length > 0;

  return {
    filterRows,
    addFilterRow,
    removeFilterRow,
    changeFilterRow,
    clearFilters,
    applyFilters,
    generateFilterOptions,
    isFilterActive
  };
};

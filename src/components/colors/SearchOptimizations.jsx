import React, { memo } from 'react';

// Memoized color row component to prevent unnecessary re-renders
export const OptimizedColorRow = memo(({ color, isSelected, onSelect, onRowClick, ...props }) => {
  return (
    <ColorRow
      color={color}
      isSelected={isSelected}
      onSelect={onSelect}
      onRowClick={onRowClick}
      {...props}
    />
  );
});

OptimizedColorRow.displayName = 'OptimizedColorRow';

// Optimized search input with debounced value
export const OptimizedSearchInput = memo(({ value, onChange, placeholder = "Search colors..." }) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
});

OptimizedSearchInput.displayName = 'OptimizedSearchInput';
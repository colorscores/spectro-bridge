import { useState, useEffect } from 'react';

export const useDebounce = (value, delay) => {
  // Add safety check for hook usage
  let debouncedValue, setDebouncedValue;
  try {
    [debouncedValue, setDebouncedValue] = useState(value);
  } catch (error) {
    console.error('useDebounce: React hooks not available, using fallback', error);
    return value; // Return the original value as fallback
  }

  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debouncedValue;
};
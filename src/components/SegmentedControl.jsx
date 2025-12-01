import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const SegmentedControl = ({ options, onSelect, defaultOption }) => {
  const [selected, setSelected] = useState(defaultOption || options[0]?.value);

  const handleSelect = (value) => {
    setSelected(value);
    if (onSelect) {
      onSelect(value);
    }
  };

  return (
    <div className="flex items-center p-1 rounded-lg border border-gray-200">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => handleSelect(option.value)}
          className={cn(
            'relative px-4 py-1.5 text-sm font-semibold text-gray-600 transition-colors duration-300 rounded-md focus:outline-none',
            { 'text-gray-900': selected === option.value },
            { 'hover:text-gray-900': selected !== option.value }
          )}
        >
          {selected === option.value && (
            <motion.div
              layoutId="segmentedControlPill"
              className="absolute inset-0 bg-white rounded-md shadow"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default SegmentedControl;
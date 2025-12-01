import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { sortMeasurementModes } from '@/lib/utils/measurementUtils';

const cardVariants = {
  approved: "border-green-500/50",
  rejected: "border-red-500/50 opacity-60",
  default: "border-gray-200"
};

const ColorCard = ({ color, variant = 'default' }) => {
  const displayHex = color.hex;
  const modes = sortMeasurementModes(Array.from(new Set((color.measurements || []).map(m => m.mode))));
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn("bg-white rounded-md p-2 border", cardVariants[variant])}
    >
      <div
        className="w-full h-16 rounded-sm mb-2 border border-gray-200"
        style={{ backgroundColor: displayHex }}
      />
      {color.name && <p className="text-gray-800 text-xs font-bold text-center truncate">{color.name}</p>}
      <p className="text-gray-500 text-xs font-mono text-center">{displayHex}</p>
      {color.library && <p className="text-blue-500 text-[10px] text-center truncate">{color.library}</p>}
      {modes.length > 0 && (
        <p className="text-gray-400 text-[10px] text-center truncate">
          {modes.join(', ')}
        </p>
      )}
    </motion.div>
  );
};

export default ColorCard;
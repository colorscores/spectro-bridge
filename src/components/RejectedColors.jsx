import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import ColorCard from '@/components/ColorCard';

const RejectedColors = ({ colors }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-white rounded-lg p-6 border border-gray-200"
    >
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <X className="mr-2 h-6 w-6 text-red-500" />
        Rejected Colors ({colors.length})
      </h2>
      
      {colors.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <X className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Rejected colors will be shown here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          <AnimatePresence>
            {colors.map((color) => (
              <ColorCard key={color.id} color={color} variant="rejected" />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default RejectedColors;
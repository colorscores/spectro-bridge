import React from 'react';
import { motion } from 'framer-motion';

const VisualHighlight = ({ coordinates, isVisible, type = 'circle' }) => {
  if (!isVisible || !coordinates) return null;

  const { x, y, width, height } = coordinates;

  if (type === 'circle') {
    const radius = Math.max(width, height) / 2 + 8;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    return (
      <motion.div
        className="absolute pointer-events-none z-10"
        style={{
          left: centerX - radius,
          top: centerY - radius,
          width: radius * 2,
          height: radius * 2,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 20,
          duration: 0.4 
        }}
      >
        <div className="w-full h-full border-4 border-primary rounded-full shadow-lg animate-pulse" 
             style={{ 
               boxShadow: '0 0 0 4px hsl(var(--primary) / 0.2), 0 0 20px hsl(var(--primary) / 0.4)' 
             }} 
        />
      </motion.div>
    );
  }

  // Rectangle highlight
  return (
    <motion.div
      className="absolute pointer-events-none z-10 border-4 border-primary rounded-lg shadow-lg"
      style={{
        left: x - 4,
        top: y - 4,
        width: width + 8,
        height: height + 8,
        boxShadow: '0 0 0 4px hsl(var(--primary) / 0.2), 0 0 20px hsl(var(--primary) / 0.4)'
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 20,
        duration: 0.4 
      }}
    />
  );
};

export default VisualHighlight;
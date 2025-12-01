import React from 'react';

const ColorBubbles = ({ colors, maxVisible = 4, size = 'sm', showCount = true, className = '' }) => {
  // Ensure colors is always an array and filter out invalid entries
  const validColors = Array.isArray(colors) 
    ? colors.filter(color => color && (color.hex || color.color_hex))
    : [];
  
    
  if (validColors.length === 0) {
    return null;
  }

  const visibleColors = validColors.slice(0, maxVisible);
  const remainingCount = validColors.length - maxVisible;
  
  // Size variants
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4', 
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const textSizeClasses = {
    xs: 'text-[8px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const bubbleSize = sizeClasses[size] || sizeClasses.sm;
  const textSize = textSizeClasses[size] || textSizeClasses.sm;

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {visibleColors.map((color) => {
        const colorHex = color.hex || color.color_hex || '#000000';
        const colorName = color.name || color.color_name || colorHex;
        const colorId = color.id || color.color_id || colorHex;
        
        return (
          <div
            key={colorId}
            className={`${bubbleSize} rounded-full border border-border shadow-sm transition-transform hover:scale-110`}
            style={{ backgroundColor: colorHex }}
            title={colorName}
          />
        );
      })}
      {remainingCount > 0 && showCount && (
        <div className={`${bubbleSize} rounded-full bg-muted border border-border flex items-center justify-center`}>
          <span className={`${textSize} text-muted-foreground font-medium`}>
            +{remainingCount}
          </span>
        </div>
      )}
    </div>
  );
};

export default ColorBubbles;
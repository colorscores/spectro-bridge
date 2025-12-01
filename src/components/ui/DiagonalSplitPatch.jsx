import React from 'react';
import { cn } from '@/lib/utils';

/**
 * DiagonalSplitPatch - Shows two colors split diagonally
 * Top-left: imported color, Bottom-right: adapted color
 * Uses slope-based angle calculation for consistent visual appearance across aspect ratios
 */
const DiagonalSplitPatch = ({ 
  importedColor, 
  adaptedColor, 
  size = "w-16 h-16",
  className = "",
  showLabels = false,
  slopeMultiplier = 1.0,
  baseAngle = 45
}) => {
  // Calculate diagonal angle for linear gradient
  const calculateDiagonalAngle = () => {
    // For consistent visual appearance across different aspect ratios:
    // - Square elements (wedges): baseAngle works perfectly  
    // - Wide rectangles: need steeper angle (baseAngle × slopeMultiplier)
    
    const effectiveAngle = baseAngle * slopeMultiplier;
    
    // Convert to CSS linear-gradient angle (0° = top, 90° = right)
    // Adding 90° to get the diagonal direction we want
    const cssAngle = 90 + effectiveAngle;
    
    return cssAngle;
  };

  const diagonalAngle = calculateDiagonalAngle();

  return (
    <div className={cn("relative border border-border rounded overflow-hidden", size, className)}>
      {/* Diagonal split using linear gradient */}
      <div 
        className="absolute inset-0 rounded"
        style={{
          background: `linear-gradient(${diagonalAngle}deg, ${importedColor} 50%, ${adaptedColor} 50%)`
        }}
      />
      
      {/* Corner labels with badge styling */}
      {showLabels && (
        <>
          <div className="absolute top-1 left-1 bg-black/40 text-white text-[9px] font-medium px-1 py-0.5 rounded shadow-sm pointer-events-none">
            Imported
          </div>
          <div className="absolute bottom-1 right-1 bg-black/40 text-white text-[9px] font-medium px-1 py-0.5 rounded shadow-sm pointer-events-none">
            Adapted
          </div>
        </>
      )}
    </div>
  );
};

export default DiagonalSplitPatch;
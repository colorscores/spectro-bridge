import React from 'react';
import VisualHighlight from './VisualHighlight';

const ScreenshotDisplay = ({ 
  imageSrc, 
  alt, 
  highlightCoordinates, 
  highlightType = 'circle',
  className = "" 
}) => {
  return (
    <div className={`relative bg-muted/30 rounded-lg overflow-hidden border ${className}`}>
      <img
        src={imageSrc}
        alt={alt}
        className="w-full h-auto object-contain"
        draggable={false}
      />
      <VisualHighlight
        coordinates={highlightCoordinates}
        isVisible={!!highlightCoordinates}
        type={highlightType}
      />
    </div>
  );
};

export default ScreenshotDisplay;
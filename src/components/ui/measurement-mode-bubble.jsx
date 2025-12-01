import React from 'react';
import { AlertTriangle } from 'lucide-react';

const MeasurementModeBubble = ({ 
  modes = [], 
  hasSpectralData = false, 
  defaultMeasurementMode = null,
  showNoModesMessage = true,
  interactive = false,
  activeMode = null,
  onModeClick = null
}) => {
  // If no modes detected and has spectral data, show warning
  if (modes.length === 0 && hasSpectralData && showNoModesMessage) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <AlertTriangle className="w-3 h-3 text-amber-500" />
        <span className="text-amber-600 text-xs">
          {defaultMeasurementMode ? `${defaultMeasurementMode} (assigned)` : 'no modes detected'}
        </span>
      </div>
    );
  }

  // If we have an assigned mode (when defaultMeasurementMode is set but no original modes)
  if (modes.length === 0 && defaultMeasurementMode && hasSpectralData) {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {defaultMeasurementMode} (assigned)
        </span>
      </div>
    );
  }

  // If we have detected modes, show them as blue bubbles
  if (modes.length > 0) {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {modes.map((mode, idx) => {
          const isActive = activeMode === mode;
          const baseClasses = "text-xs px-1.5 py-0.5 rounded transition-colors";
          const interactiveClasses = interactive ? "cursor-pointer hover:bg-blue-200 hover:text-blue-700" : "";
          const activeClasses = isActive ? "bg-blue-600 text-white font-semibold" : "bg-blue-100 text-blue-600";
          
          return (
            <span 
              key={idx} 
              className={`${baseClasses} ${interactiveClasses} ${activeClasses}`}
              onClick={interactive && onModeClick ? () => onModeClick(mode) : undefined}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onKeyDown={interactive && onModeClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onModeClick(mode);
                }
              } : undefined}
            >
              {mode || 'Unknown'}
            </span>
          );
        })}
      </div>
    );
  }

  // Fallback for no modes and no spectral data
  return null;
};

export default MeasurementModeBubble;
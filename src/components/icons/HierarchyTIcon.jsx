import React from 'react';

const HierarchyTIcon = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="none"
  >
    <path d="M12 0V24" 
      stroke="currentColor"
      strokeWidth="1"
      vectorEffect="non-scaling-stroke"
    />
    <path d="M12 12H24"
      stroke="currentColor"
      strokeWidth="1"
      vectorEffect="non-scaling-stroke"
     />
  </svg>
);

export default HierarchyTIcon;
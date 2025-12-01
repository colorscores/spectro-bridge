import React from 'react';

const InkBookIcon = ({ className = "h-5 w-5", ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Book outline */}
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      
      {/* Book spine line */}
      <path d="M8 2v20" />
      
      {/* Ink droplet on cover */}
      <ellipse cx="14" cy="9" rx="2" ry="3" fill="currentColor" opacity="0.7" />
      <circle cx="14" cy="6.5" r="0.8" fill="currentColor" opacity="0.9" />
    </svg>
  );
};

export default InkBookIcon;
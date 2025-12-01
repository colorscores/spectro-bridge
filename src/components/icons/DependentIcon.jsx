import React from 'react';

const DependentIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 15V21" />
    <path d="M9 15h6" />
    <path d="M12 9v6" />
    <circle cx="12" cy="6" r="3" />
  </svg>
);

export default DependentIcon;
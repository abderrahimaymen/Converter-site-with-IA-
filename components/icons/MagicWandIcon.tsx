import React from 'react';

const MagicWandIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 4V2" />
    <path d="M15 8V6" />
    <path d="M12.5 6.5.5 18.5l6 6L18.5 12.5" />
    <path d="m20 5-3 3" />
  </svg>
);

export default MagicWandIcon;
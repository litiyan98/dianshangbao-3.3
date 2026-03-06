import React from 'react';

interface GloveIconProps {
  size?: number;
  className?: string;
}

const GloveIcon: React.FC<GloveIconProps> = ({ size = 20, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="31" fill="#FFF4DF" />
      <circle cx="32" cy="32" r="28" fill="#FFE8BD" />
      <path
        d="M22 43c0 3.9 3.2 7 7.1 7h8.8c4.5 0 8.1-3.6 8.1-8.1V29.8c0-1.8-1.4-3.2-3.2-3.2-1.2 0-2.2.6-2.8 1.5V18.9c0-1.8-1.4-3.2-3.2-3.2-1.8 0-3.2 1.4-3.2 3.2v8.4c-.2-1.6-1.5-2.8-3.1-2.8-1.8 0-3.2 1.4-3.2 3.2v2.5c-.2-1.4-1.5-2.5-3-2.5-1.8 0-3.2 1.4-3.2 3.2v8.6l-2.4-2.2c-1.5-1.4-3.8-1.3-5.2.2-1.4 1.5-1.3 3.8.2 5.2L22 43z"
        fill="#FF9D2E"
      />
      <path
        d="M41.5 20.2c-.9.9-2.3.9-3.2 0-.9-.9-.9-2.3 0-3.2l2.1-2.1c.9-.9 2.3-.9 3.2 0 .9.9.9 2.3 0 3.2l-2.1 2.1z"
        fill="#FFD66B"
      />
      <circle cx="47.5" cy="14.5" r="2.2" fill="#FFBE55" />
    </svg>
  );
};

export default GloveIcon;

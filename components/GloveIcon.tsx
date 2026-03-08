import React, { useId } from 'react';

interface GloveIconProps {
  size?: number;
  className?: string;
}

const GloveIcon: React.FC<GloveIconProps> = ({ size = 20, className = '' }) => {
  const strokeId = useId().replace(/:/g, '');
  const glowId = useId().replace(/:/g, '');

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
      <defs>
        <linearGradient id={strokeId} x1="8" y1="18" x2="56" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#111827" />
          <stop offset="0.45" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <filter id={glowId} x="2" y="10" width="60" height="44" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.14" />
        </filter>
      </defs>
      <g filter={`url(#${glowId})`}>
        <path
          d="M10 32C13.8 23.8 19.6 19 25.8 19C36.2 19 39.2 45 49 45C54.7 45 58.3 40.7 58.3 34.9C58.3 27.8 53.5 21 46.2 21C36.7 21 33.2 45 23.8 45C16.5 45 11.7 38.2 11.7 31.1C11.7 25.3 15.3 21 21 21"
          stroke={`url(#${strokeId})`}
          strokeWidth="8.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

export default GloveIcon;

import React, { useId } from 'react';

interface GloveIconProps {
  size?: number;
  className?: string;
}

const GloveIcon: React.FC<GloveIconProps> = ({ size = 20, className = '' }) => {
  const leftGradientId = useId().replace(/:/g, '');
  const rightGradientId = useId().replace(/:/g, '');
  const shadowId = useId().replace(/:/g, '');

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
        <linearGradient id={leftGradientId} x1="10" y1="12" x2="40" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#111827" />
          <stop offset="0.58" stopColor="#4B5563" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={rightGradientId} x1="24" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.55" stopColor="#6366F1" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <filter id={shadowId} x="0" y="4" width="64" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.12" />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        <ellipse
          cx="22"
          cy="32"
          rx="12.5"
          ry="16.5"
          transform="rotate(-18 22 32)"
          stroke={`url(#${leftGradientId})`}
          strokeWidth="8.5"
          strokeLinecap="round"
        />
        <ellipse
          cx="42"
          cy="32"
          rx="12.5"
          ry="16.5"
          transform="rotate(18 42 32)"
          stroke={`url(#${rightGradientId})`}
          strokeWidth="8.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

export default GloveIcon;

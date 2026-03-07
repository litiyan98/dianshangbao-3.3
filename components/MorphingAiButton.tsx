import React, { ReactNode, useId } from 'react';

type MorphButtonVariant = 'primary' | 'secondary';
type MorphButtonSize = 'sm' | 'md' | 'lg';

interface MorphingAiButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  idleText: string;
  loadingText: string;
  doneText?: string;
  showDone?: boolean;
  icon?: ReactNode;
  className?: string;
  variant?: MorphButtonVariant;
  size?: MorphButtonSize;
  block?: boolean;
}

export const NebulaDiamondIcon: React.FC = () => {
  const gradientId = useId().replace(/:/g, '');
  const gradRef = `${gradientId}-nebula-full-spectrum`;

  return (
    <svg
      className="nebula-diamond-svg"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradRef} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff4d4d" />
          <stop offset="35%" stopColor="#f9cb28" />
          <stop offset="65%" stopColor="#78e08f" />
          <stop offset="100%" stopColor="#3c40c6" />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            values="-0.45 -0.45;0.45 0.45;-0.45 -0.45"
            dur="4.8s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>
      <path
        d="M12 0C12 6.62742 6.62742 12 0 12C6.62742 12 12 17.3726 12 24C12 17.3726 17.3726 12 24 12C17.3726 12 12 6.62742 12 0Z"
        fill={`url(#${gradRef})`}
      />
    </svg>
  );
};

const MorphingAiButton: React.FC<MorphingAiButtonProps> = ({
  onClick,
  loading,
  disabled = false,
  idleText,
  loadingText,
  doneText = '✨ 渲染完成',
  showDone = false,
  icon,
  className = '',
  variant = 'primary',
  size = 'md',
  block = false,
}) => {
  const labelText = loading ? loadingText : (showDone ? doneText : idleText);
  const mergedClassName = [
    'morphing-ai-button',
    `morphing-ai-button--${variant}`,
    `morphing-ai-button--${size}`,
    loading ? 'loading' : '',
    showDone && !loading ? 'done' : '',
    block ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={mergedClassName}
      type="button"
      aria-busy={loading}
      aria-live="polite"
    >
      <span className="morphing-ai-button__label-wrap">
        {icon ? <span className="morphing-ai-button__icon">{icon}</span> : null}
        <span className="morphing-ai-button__label">{labelText}</span>
      </span>

      <span className="morphing-ai-button__loader">
        <span className="nebula-diamond-shell">
          <NebulaDiamondIcon />
        </span>
      </span>
    </button>
  );
};

export default MorphingAiButton;

import React from 'react';
import { getSurvivorPortraitIndex, getPortraitStyle, PORTRAIT_CONFIG } from '../../utils/portraitManager';

export interface SurvivorPortraitProps {
  portraitIndex?: number;
  survivor?: {
    id?: string;
    name?: string;
    portraitIndex?: number;
    avatarColor?: string;
    avatarUrl?: string;
  };
  shape?: 'portrait' | 'circle' | 'rounded';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  showBorder?: boolean;
}

export const SurvivorPortrait: React.FC<SurvivorPortraitProps> = ({
  portraitIndex,
  survivor,
  shape = 'portrait',
  size = 'custom',
  className = '',
  style = {},
  alt,
  showBorder = true,
}) => {
  const index = portraitIndex !== undefined ? portraitIndex : getSurvivorPortraitIndex(survivor);
  const portraitStyle = getPortraitStyle(index, shape === 'circle' ? 'headshot' : 'full');

  // Size styles
  let sizeClass = '';
  if (size === 'xs') {
    sizeClass = shape === 'circle' ? 'w-6 h-6' : 'w-6 h-8';
  } else if (size === 'sm') {
    sizeClass = shape === 'circle' ? 'w-8 h-8' : 'w-8 h-11';
  } else if (size === 'md') {
    sizeClass = shape === 'circle' ? 'w-10 h-10' : 'w-11 h-15';
  } else if (size === 'lg') {
    sizeClass = shape === 'circle' ? 'w-14 h-14' : 'w-16 h-22';
  } else if (size === 'xl') {
    sizeClass = shape === 'circle' ? 'w-20 h-20' : 'w-full aspect-[2/3]';
  }

  const shapeClass =
    shape === 'circle'
      ? 'rounded-full'
      : shape === 'rounded'
      ? 'rounded-md aspect-[2/3]'
      : 'rounded-md aspect-[2/3]';

  const borderClass = showBorder
    ? shape === 'circle'
      ? 'border border-emerald-600/60 shadow-sm'
      : 'border border-[#523d24] shadow-md'
    : '';

  return (
    <div
      className={`relative overflow-hidden shrink-0 select-none bg-[#120d08] ${shapeClass} ${sizeClass} ${borderClass} ${className}`}
      style={{
        ...portraitStyle,
        ...style,
      }}
      title={alt || survivor?.name || `Survivor Portrait #${index + 1}`}
      role="img"
      aria-label={alt || survivor?.name || `Survivor Portrait #${index + 1}`}
    >
      {/* Subtle inner shadow overlay for depth */}
      <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-[inherit]" />
    </div>
  );
};

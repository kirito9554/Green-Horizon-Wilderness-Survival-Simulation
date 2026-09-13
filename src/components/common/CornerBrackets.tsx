import React from 'react';

export type CornerBracketStyle = 'bronze' | 'iron' | 'carved_wood';

interface CornerBracketsProps {
  style?: CornerBracketStyle;
  size?: number; // size in px, default 16
  className?: string;
  inset?: number; // offset from edge in px, default 2
}

/**
 * CornerBrackets:
 * Renders 4 authentic forged metal / carved wooden brackets at the four corners of a container.
 * Breaks the rigid rectangle appearance of web divs and anchors the UI to the expedition theme.
 */
export const CornerBrackets: React.FC<CornerBracketsProps> = ({
  style = 'bronze',
  size = 18,
  className = '',
  inset = 2,
}) => {
  const isBronze = style === 'bronze';
  const isIron = style === 'iron';

  const strokeMain = isBronze ? '#a87948' : isIron ? '#59655e' : '#694f31';
  const strokeLight = isBronze ? '#ecd49c' : isIron ? '#8d9c93' : '#a3845b';
  const rivetFill = isBronze ? '#ffda9e' : isIron ? '#abbbb1' : '#bda37a';
  const rivetShadow = '#1a1005';

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-10 select-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Top Left Bracket */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ top: `${inset}px`, left: `${inset}px` }}
        className="absolute drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)]"
      >
        <path
          d="M 2 22 L 2 4 C 2 2.8 2.8 2 4 2 L 22 2 L 20 6 L 6 6 L 6 20 Z"
          fill="rgba(18, 14, 10, 0.92)"
          stroke={strokeMain}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M 3 3 L 20 3" stroke={strokeLight} strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
        <path d="M 3 3 L 3 20" stroke={strokeLight} strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
        {/* Corner Rivet */}
        <circle cx="8.5" cy="8.5" r="2.2" fill={rivetShadow} />
        <circle cx="8.5" cy="8.5" r="1.7" fill={rivetFill} />
        <circle cx="7.8" cy="7.8" r="0.6" fill="#fff" opacity="0.9" />
      </svg>

      {/* Top Right Bracket */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ top: `${inset}px`, right: `${inset}px` }}
        className="absolute drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)]"
      >
        <path
          d="M 22 22 L 22 4 C 22 2.8 21.2 2 20 2 L 2 2 L 4 6 L 18 6 L 18 20 Z"
          fill="rgba(18, 14, 10, 0.92)"
          stroke={strokeMain}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M 21 3 L 4 3" stroke={strokeLight} strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
        <path d="M 21 3 L 21 20" stroke={strokeLight} strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
        {/* Corner Rivet */}
        <circle cx="15.5" cy="8.5" r="2.2" fill={rivetShadow} />
        <circle cx="15.5" cy="8.5" r="1.7" fill={rivetFill} />
        <circle cx="14.8" cy="7.8" r="0.6" fill="#fff" opacity="0.9" />
      </svg>

      {/* Bottom Left Bracket */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ bottom: `${inset}px`, left: `${inset}px` }}
        className="absolute drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)]"
      >
        <path
          d="M 2 2 L 2 20 C 2 21.2 2.8 22 4 22 L 22 22 L 20 18 L 6 18 L 6 4 Z"
          fill="rgba(18, 14, 10, 0.92)"
          stroke={strokeMain}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M 3 21 L 20 21" stroke={strokeMain} strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
        <path d="M 3 21 L 3 4" stroke={strokeLight} strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
        {/* Corner Rivet */}
        <circle cx="8.5" cy="15.5" r="2.2" fill={rivetShadow} />
        <circle cx="8.5" cy="15.5" r="1.7" fill={rivetFill} />
        <circle cx="7.8" cy="14.8" r="0.6" fill="#fff" opacity="0.9" />
      </svg>

      {/* Bottom Right Bracket */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ bottom: `${inset}px`, right: `${inset}px` }}
        className="absolute drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)]"
      >
        <path
          d="M 22 2 L 22 20 C 22 21.2 21.2 22 20 22 L 2 22 L 4 18 L 18 18 L 18 4 Z"
          fill="rgba(18, 14, 10, 0.92)"
          stroke={strokeMain}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M 21 21 L 4 21" stroke={strokeMain} strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
        <path d="M 21 21 L 21 4" stroke={strokeMain} strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
        {/* Corner Rivet */}
        <circle cx="15.5" cy="15.5" r="2.2" fill={rivetShadow} />
        <circle cx="15.5" cy="15.5" r="1.7" fill={rivetFill} />
        <circle cx="14.8" cy="14.8" r="0.6" fill="#fff" opacity="0.9" />
      </svg>
    </div>
  );
};

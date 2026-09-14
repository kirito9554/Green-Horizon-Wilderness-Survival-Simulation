import React from 'react';

interface CraftedItemArtProps {
  itemId?: string;
  recipeId?: string;
  size?: number;
  className?: string;
}

export const CraftedItemArt: React.FC<CraftedItemArtProps> = ({
  itemId = '',
  recipeId = '',
  size = 64,
  className = '',
}) => {
  const key = (itemId || recipeId).toUpperCase();

  // 1. Stone Knife
  if (key.includes('KNIFE') && !key.includes('IMPROVED')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cfd4d2" />
            <stop offset="50%" stopColor="#8d9994" />
            <stop offset="100%" stopColor="#515d58" />
          </linearGradient>
          <linearGradient id="stickGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#966336" />
            <stop offset="100%" stopColor="#523214" />
          </linearGradient>
          <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>
        <g filter="url(#glowGold)">
          {/* Wooden handle */}
          <path d="M22 78 L45 55 L53 63 L30 86 Z" fill="url(#stickGrad)" stroke="#38210c" strokeWidth="2" strokeLinejoin="round" />
          {/* Fiber cord wraps */}
          <path d="M38 62 L48 52 M41 65 L51 55 M44 68 L54 58" stroke="#d5b882" strokeWidth="2.5" strokeLinecap="round" />
          {/* Stone Blade */}
          <path d="M42 58 L78 22 L82 26 L70 48 L56 58 L46 62 Z" fill="url(#bladeGrad)" stroke="#2b3531" strokeWidth="2.5" strokeLinejoin="round" />
          {/* Flaked chips texture on stone */}
          <path d="M60 38 L65 42 M68 30 L73 34 M52 50 L58 52" stroke="#abb4b0" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 1b. Improved Knife
  if (key.includes('IMPROVED_KNIFE')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="impBlade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8ecea" />
            <stop offset="40%" stopColor="#b4c2bd" />
            <stop offset="100%" stopColor="#62736c" />
          </linearGradient>
          <linearGradient id="impHandle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b25d2c" />
            <stop offset="100%" stopColor="#5c290a" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Ergonomic handle with leather wrap */}
          <path d="M18 82 L42 58 L52 68 L28 92 Z" fill="url(#impHandle)" stroke="#2b1405" strokeWidth="2.5" />
          <path d="M26 74 L36 64 M31 79 L41 69 M36 84 L46 74" stroke="#e0be88" strokeWidth="3" strokeLinecap="round" />
          {/* Polished stone dagger blade */}
          <path d="M42 58 L85 15 L88 20 L76 46 L58 60 L48 64 Z" fill="url(#impBlade)" stroke="#202925" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M52 50 L80 22" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <circle cx="48" cy="62" r="3" fill="#d97706" />
        </g>
      </svg>
    );
  }

  // 2. Rope
  if (key.includes('ROPE') || key.includes('CORD')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="ropeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dfbf86" />
            <stop offset="50%" stopColor="#b38e55" />
            <stop offset="100%" stopColor="#7a582c" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Outer coil */}
          <ellipse cx="50" cy="52" rx="34" ry="26" fill="none" stroke="url(#ropeGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="6 2" />
          {/* Inner coil */}
          <ellipse cx="50" cy="50" rx="22" ry="16" fill="none" stroke="#927142" strokeWidth="9" strokeLinecap="round" strokeDasharray="5 2" />
          {/* Crossing tie */}
          <path d="M38 34 L62 66 M34 40 L58 72" stroke="#d5b376" strokeWidth="5" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 3. Campfire Kit
  if (key.includes('CAMPFIRE') || key.includes('FIRE_STARTER')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="fireGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="45%" stopColor="#f97316" />
            <stop offset="85%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wood logs teepee */}
          <path d="M20 78 L50 42 L80 78" stroke="#683d1c" strokeWidth="9" strokeLinecap="round" />
          <path d="M32 80 L50 40 L68 80" stroke="#874f24" strokeWidth="7" strokeLinecap="round" />
          {/* Stones ring */}
          <ellipse cx="25" cy="80" rx="7" ry="5" fill="#71717a" stroke="#3f3f46" strokeWidth="2" />
          <ellipse cx="42" cy="84" rx="8" ry="5" fill="#52525b" stroke="#27272a" strokeWidth="2" />
          <ellipse cx="60" cy="84" rx="8" ry="5" fill="#71717a" stroke="#3f3f46" strokeWidth="2" />
          <ellipse cx="76" cy="80" rx="7" ry="5" fill="#52525b" stroke="#27272a" strokeWidth="2" />
          {/* Roaring fire flame */}
          <path d="M50 20 C54 30 68 40 64 56 C60 70 38 72 36 56 C34 44 46 32 50 20 Z" fill="url(#fireGrad)" opacity="0.95" />
          <path d="M50 36 C52 42 58 48 56 58 C53 66 43 66 42 58 C41 52 48 44 50 36 Z" fill="#fef08a" />
        </g>
      </svg>
    );
  }

  // 4. Leaf Bed
  if (key.includes('LEAF_BED') || key.includes('BED')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wooden corner stilts */}
          <rect x="18" y="58" width="6" height="24" rx="2" fill="#5c381c" />
          <rect x="76" y="58" width="6" height="24" rx="2" fill="#5c381c" />
          {/* Bed frame */}
          <rect x="16" y="50" width="68" height="14" rx="4" fill="#7b4e28" stroke="#38210e" strokeWidth="2" />
          {/* Lush woven palm leaves */}
          <path d="M18 48 C30 36 68 36 82 48 L80 58 C68 48 30 48 18 58 Z" fill="#2d6a4f" stroke="#1b4332" strokeWidth="2" />
          <path d="M22 46 C34 32 64 32 78 46" stroke="#52b788" strokeWidth="3" fill="none" strokeDasharray="6 3" />
          <path d="M26 40 C38 28 60 28 74 40" stroke="#74c69d" strokeWidth="2.5" fill="none" />
        </g>
      </svg>
    );
  }

  // 5. Water Flask / Bamboo Canteen
  if (key.includes('FLASK') || key.includes('CANTEEN')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="flaskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b4743c" />
            <stop offset="60%" stopColor="#7a461b" />
            <stop offset="100%" stopColor="#432208" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Shoulder strap */}
          <path d="M30 45 C20 20 75 15 70 45" stroke="#482e18" strokeWidth="3.5" fill="none" strokeDasharray="4 2" />
          {/* Leather / Gourde body */}
          <ellipse cx="50" cy="62" rx="24" ry="25" fill="url(#flaskGrad)" stroke="#321804" strokeWidth="3" />
          <path d="M42 42 L58 42 L56 32 L44 32 Z" fill="#915828" stroke="#321804" strokeWidth="2" />
          {/* Wooden stopper plug */}
          <rect x="46" y="24" width="8" height="9" rx="2" fill="#d4a373" stroke="#58310c" strokeWidth="2" />
          {/* Middle stitched seam */}
          <line x1="50" y1="42" x2="50" y2="86" stroke="#321804" strokeWidth="2" strokeDasharray="3 2" />
        </g>
      </svg>
    );
  }

  // 6. Bandage / Poultice
  if (key.includes('BANDAGE') || key.includes('POULTICE')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Rolled linen bandage roll */}
          <ellipse cx="64" cy="52" rx="14" ry="24" fill="#e5dec9" stroke="#928872" strokeWidth="2.5" />
          <ellipse cx="64" cy="52" rx="7" ry="14" fill="#aba08a" stroke="#716752" strokeWidth="1.5" />
          {/* Unrolled strip */}
          <path d="M64 76 C46 76 22 72 18 62 C16 54 28 44 48 40 L64 36" fill="#f4ebd9" stroke="#928872" strokeWidth="2.5" />
          {/* Medical herb leaf overlay */}
          <path d="M28 56 C32 46 44 48 42 58 C40 68 28 66 28 56 Z" fill="#2d6a4f" />
          <path d="M30 64 L40 50" stroke="#74c69d" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  // 7. Fishing Spear
  if (key.includes('FISHING_SPEAR') || (key.includes('SPEAR') && !key.includes('BONE'))) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Bamboo shaft */}
          <line x1="18" y1="82" x2="68" y2="32" stroke="#7a9a3b" strokeWidth="5" strokeLinecap="round" />
          <line x1="28" y1="72" x2="31" y2="69" stroke="#48611e" strokeWidth="6" strokeLinecap="round" />
          <line x1="48" y1="52" x2="51" y2="49" stroke="#48611e" strokeWidth="6" strokeLinecap="round" />
          {/* Barbed prongs */}
          <path d="M68 32 L85 15 M68 32 L78 20 M68 32 L80 30" stroke="#f4ecd8" strokeWidth="3" strokeLinecap="round" />
          {/* Bone barbs */}
          <polygon points="85,15 78,22 82,24" fill="#e2d7be" />
          <polygon points="78,20 72,26 76,28" fill="#e2d7be" />
          {/* Binding cord */}
          <rect x="62" y="32" width="10" height="8" rx="2" transform="rotate(-45 62 32)" fill="#b08953" />
        </g>
      </svg>
    );
  }

  // 7b. Bone Spear
  if (key.includes('BONE_SPEAR')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          <line x1="16" y1="84" x2="64" y2="36" stroke="#5a3d24" strokeWidth="6" strokeLinecap="round" />
          {/* Large sculpted bone head */}
          <path d="M62 38 L88 12 L78 28 L84 32 L66 44 Z" fill="#ede5d3" stroke="#4a3b2c" strokeWidth="2" />
          {/* Serrated barbs */}
          <polygon points="76,26 84,28 78,32" fill="#d5c8ae" />
          {/* Thick cord wrap */}
          <rect x="58" y="36" width="12" height="9" rx="2" transform="rotate(-45 58 36)" fill="#9c6644" />
        </g>
      </svg>
    );
  }

  // 8. Torch
  if (key.includes('TORCH')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="torchFlame" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="90%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wooden handle */}
          <line x1="22" y1="80" x2="55" y2="46" stroke="#6f4e37" strokeWidth="7" strokeLinecap="round" />
          {/* Coconut husk wrap head */}
          <path d="M50 52 L62 40 L70 48 L58 60 Z" fill="#58310c" stroke="#2b1807" strokeWidth="2" />
          <path d="M52 48 L66 42 M56 56 L70 50" stroke="#bc6c25" strokeWidth="2.5" />
          {/* Fire flame */}
          <path d="M64 42 C72 26 85 24 82 12 C70 18 64 8 56 22 C50 32 58 38 64 42 Z" fill="url(#torchFlame)" />
          <circle cx="70" cy="22" r="4" fill="#fef08a" />
        </g>
      </svg>
    );
  }

  // 9. Simple Basket
  if (key.includes('BASKET')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="basketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4a373" />
            <stop offset="50%" stopColor="#a97142" />
            <stop offset="100%" stopColor="#6f4518" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Basket handle */}
          <path d="M30 45 C30 20 70 20 70 45" stroke="#8c5828" strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* Woven bowl */}
          <path d="M22 45 L30 80 C32 86 68 86 70 80 L78 45 Z" fill="url(#basketGrad)" stroke="#4a2800" strokeWidth="3" strokeLinejoin="round" />
          {/* Woven lattice pattern */}
          <path d="M26 55 Q50 62 74 55 M28 67 Q50 74 72 67 M38 48 L46 82 M50 48 L50 84 M62 48 L54 82" stroke="#4a2800" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </g>
      </svg>
    );
  }

  // 10. Wooden Club
  if (key.includes('CLUB')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Thick tapered club */}
          <path d="M20 78 L26 84 L72 38 C78 30 86 20 80 14 C74 8 64 16 56 22 Z" fill="#6f4e37" stroke="#362112" strokeWidth="3" strokeLinejoin="round" />
          {/* Spikes / Studs */}
          <polygon points="68,14 74,10 72,18" fill="#71717a" stroke="#27272a" strokeWidth="1.5" />
          <polygon points="82,24 88,26 82,30" fill="#71717a" stroke="#27272a" strokeWidth="1.5" />
          <polygon points="60,26 56,32 64,32" fill="#71717a" stroke="#27272a" strokeWidth="1.5" />
          {/* Leather grip */}
          <line x1="24" y1="74" x2="34" y2="64" stroke="#d4a373" strokeWidth="3" />
          <line x1="28" y1="78" x2="38" y2="68" stroke="#d4a373" strokeWidth="3" />
        </g>
      </svg>
    );
  }

  // 11. Stone Axe
  if (key.includes('AXE') && !key.includes('IMPROVED')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Curved handle */}
          <path d="M25 85 C32 65 48 45 68 22 L75 27 C56 50 40 70 32 90 Z" fill="#784b25" stroke="#3d220a" strokeWidth="2.5" />
          {/* Chipped stone axe head */}
          <path d="M52 28 L82 16 C86 28 84 46 76 56 L48 44 Z" fill="#71717a" stroke="#27272a" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M78 20 C82 32 80 44 74 52" stroke="#a1a1aa" strokeWidth="2" fill="none" />
          {/* Binding cord */}
          <circle cx="60" cy="38" r="8" fill="#b08953" stroke="#58310c" strokeWidth="2" />
        </g>
      </svg>
    );
  }

  // 11b. Improved Axe
  if (key.includes('IMPROVED_AXE')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Polished double-bit or heavy head */}
          <path d="M22 88 L68 20 L76 25 L30 94 Z" fill="#58310c" stroke="#251202" strokeWidth="2.5" />
          <path d="M46 22 L88 12 C92 26 88 48 78 58 L54 44 Z" fill="#52525b" stroke="#18181b" strokeWidth="2.5" />
          <path d="M84 16 C88 28 86 44 78 52" stroke="#f4f4f5" strokeWidth="2.5" fill="none" />
          {/* Counter-weight hammer rear */}
          <path d="M46 28 L38 24 L42 38 L50 42 Z" fill="#3f3f46" stroke="#18181b" strokeWidth="2" />
          <circle cx="58" cy="35" r="7" fill="#d97706" />
        </g>
      </svg>
    );
  }

  // 12. Simple Bow
  if (key.includes('BOW')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Curved bamboo stave */}
          <path d="M25 18 C55 35 65 65 25 82" stroke="#879836" strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* Taut bowstring */}
          <line x1="25" y1="18" x2="25" y2="82" stroke="#f4ecd8" strokeWidth="2" strokeLinecap="round" />
          {/* Handle wrap */}
          <rect x="42" y="44" width="7" height="12" rx="2" fill="#7f4f24" stroke="#432818" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  // 13. Arrow
  if (key.includes('ARROW')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Arrow shaft */}
          <line x1="20" y1="80" x2="75" y2="25" stroke="#a68a64" strokeWidth="3" strokeLinecap="round" />
          {/* Stone arrowhead */}
          <polygon points="85,15 70,22 78,30" fill="#71717a" stroke="#27272a" strokeWidth="2" />
          {/* Feather fletching */}
          <path d="M20 80 L14 74 L22 72 M20 80 L26 86 L28 78" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 14. Clay Pot
  if (key.includes('CLAY_POT') || key.includes('POT')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="clayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c86d3b" />
            <stop offset="60%" stopColor="#9a4c21" />
            <stop offset="100%" stopColor="#582910" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Rim */}
          <ellipse cx="50" cy="38" rx="22" ry="7" fill="#803813" stroke="#481c06" strokeWidth="2.5" />
          {/* Pot bulb */}
          <path d="M28 38 C20 54 22 76 34 84 C42 90 58 90 66 84 C78 76 80 54 72 38 Z" fill="url(#clayGrad)" stroke="#481c06" strokeWidth="3" />
          {/* Clay handles */}
          <path d="M24 48 C16 48 16 60 25 62" stroke="#9a4c21" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M76 48 C84 48 84 60 75 62" stroke="#9a4c21" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // 15. Drying Rack & Tanning Rack
  if (key.includes('TANNING_RACK')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wooden rectangle frame */}
          <rect x="22" y="20" width="56" height="65" rx="3" fill="none" stroke="#784b25" strokeWidth="5" />
          <line x1="16" y1="84" x2="84" y2="84" stroke="#58310c" strokeWidth="6" strokeLinecap="round" />
          {/* Stretched deer/boar hide */}
          <path d="M32 30 Q50 26 68 30 Q74 52 68 74 Q50 78 32 74 Q26 52 32 30 Z" fill="#b07d56" stroke="#48240a" strokeWidth="2" />
          {/* Stretch tension cords to frame corners */}
          <line x1="32" y1="30" x2="23" y2="21" stroke="#d5b882" strokeWidth="1.5" />
          <line x1="68" y1="30" x2="77" y2="21" stroke="#d5b882" strokeWidth="1.5" />
          <line x1="32" y1="74" x2="23" y2="84" stroke="#d5b882" strokeWidth="1.5" />
          <line x1="68" y1="74" x2="77" y2="84" stroke="#d5b882" strokeWidth="1.5" />
          <line x1="26" y1="52" x2="22" y2="52" stroke="#d5b882" strokeWidth="1.5" />
          <line x1="74" y1="52" x2="78" y2="52" stroke="#d5b882" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  if (key.includes('BAMBOO_SHELTER') || key.includes('SHELTER')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* A-frame bamboo shelter */}
          <path d="M50 18 L15 82 L85 82 Z" fill="#2d3b24" stroke="#4d7c0f" strokeWidth="3" strokeLinejoin="round" />
          {/* Bamboo ridge pole */}
          <line x1="50" y1="18" x2="50" y2="82" stroke="#84cc16" strokeWidth="4" />
          {/* Thatch roof slats */}
          <line x1="40" y1="35" x2="24" y2="70" stroke="#a3e635" strokeWidth="2.5" />
          <line x1="60" y1="35" x2="76" y2="70" stroke="#a3e635" strokeWidth="2.5" />
          {/* Ground stilts */}
          <line x1="20" y1="82" x2="20" y2="92" stroke="#713f12" strokeWidth="4" />
          <line x1="80" y1="82" x2="80" y2="92" stroke="#713f12" strokeWidth="4" />
        </g>
      </svg>
    );
  }

  if (key.includes('RAIN_CATCHER')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Funnel canopy */}
          <path d="M18 25 L82 25 L54 62 L46 62 Z" fill="#1e3a5f" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round" />
          {/* Water basin at base */}
          <rect x="36" y="66" width="28" height="22" rx="4" fill="#0284c7" stroke="#bae6fd" strokeWidth="2" />
          {/* Rain droplet */}
          <path d="M50 36 C48 42 45 44 45 47 C45 50 47 52 50 52 C53 52 55 50 55 47 C55 44 52 42 50 36 Z" fill="#38bdf8" />
          {/* Tripod legs */}
          <line x1="24" y1="28" x2="16" y2="90" stroke="#78350f" strokeWidth="3" />
          <line x1="76" y1="28" x2="84" y2="90" stroke="#78350f" strokeWidth="3" />
        </g>
      </svg>
    );
  }

  if (key.includes('FISHING_TRAP')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wicker cylinder trap */}
          <ellipse cx="50" cy="50" rx="35" ry="24" fill="#78350f" stroke="#ca8a04" strokeWidth="3" />
          <path d="M25 50 C25 35 75 35 75 50 C75 65 25 65 25 50" stroke="#fef08a" strokeWidth="2" fill="none" strokeDasharray="4 2" />
          {/* Funnel neck */}
          <ellipse cx="25" cy="50" rx="10" ry="16" fill="#451a03" stroke="#eab308" strokeWidth="2" />
          {/* Trapped fish */}
          <path d="M48 48 C55 42 62 54 68 48 L70 54 L66 50 Z" fill="#38bdf8" />
        </g>
      </svg>
    );
  }

  if (key.includes('SMOKE_DRYER')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Stone hearth base */}
          <rect x="25" y="60" width="50" height="28" rx="4" fill="#52525b" stroke="#27272a" strokeWidth="3" />
          <ellipse cx="50" cy="68" rx="16" ry="6" fill="#ea580c" />
          {/* Smoker rack upper */}
          <rect x="30" y="24" width="40" height="36" rx="2" fill="none" stroke="#78350f" strokeWidth="4" />
          {/* Hanging food strips */}
          <path d="M38 30 L38 52 M50 30 L50 56 M62 30 L62 50" stroke="#b91c1c" strokeWidth="4" strokeLinecap="round" />
          {/* Smoke curls */}
          <path d="M46 20 Q42 12 50 8 Q58 4 52 0" stroke="#a1a1aa" strokeWidth="2" fill="none" opacity="0.7" />
        </g>
      </svg>
    );
  }

  if (key.includes('CLAY_KILN')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Clay dome */}
          <path d="M20 85 C20 40 40 25 50 20 C60 25 80 40 80 85 Z" fill="#9a3412" stroke="#431407" strokeWidth="3.5" />
          {/* Fire mouth */}
          <ellipse cx="50" cy="74" rx="18" ry="12" fill="#18181b" />
          <ellipse cx="50" cy="75" rx="14" ry="9" fill="#f97316" />
          <circle cx="50" cy="74" r="5" fill="#fef08a" />
          {/* Chimney vent */}
          <rect x="44" y="14" width="12" height="10" rx="2" fill="#7c2d12" stroke="#431407" strokeWidth="2" />
        </g>
      </svg>
    );
  }

  if (key.includes('WATER_FILTER')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Bamboo cylinder */}
          <rect x="32" y="15" width="36" height="70" rx="6" fill="#3f6212" stroke="#1a2e05" strokeWidth="3" />
          {/* Filter layers inside */}
          <rect x="36" y="24" width="28" height="12" fill="#eab308" opacity="0.8" />
          <rect x="36" y="40" width="28" height="16" fill="#27272a" />
          <rect x="36" y="60" width="28" height="16" fill="#94a3b8" />
          {/* Water drop from bottom */}
          <circle cx="50" cy="90" r="3" fill="#38bdf8" />
        </g>
      </svg>
    );
  }

  if (key.includes('STORAGE_CRATE') || key.includes('CRATE')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wooden chest */}
          <rect x="20" y="35" width="60" height="50" rx="4" fill="#92400e" stroke="#451a03" strokeWidth="3" />
          {/* Planks */}
          <line x1="20" y1="52" x2="80" y2="52" stroke="#451a03" strokeWidth="2" />
          <line x1="20" y1="68" x2="80" y2="68" stroke="#451a03" strokeWidth="2" />
          {/* Iron braces */}
          <rect x="28" y="35" width="6" height="50" fill="#3f3f46" />
          <rect x="66" y="35" width="6" height="50" fill="#3f3f46" />
          {/* Brass lock */}
          <rect x="46" y="50" width="8" height="10" rx="2" fill="#eab308" stroke="#713f12" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  // Obsidian Blade (Dark glassy volcanic shimmer!)
  if (key.includes('OBSIDIAN')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="obsidianGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2e1065" />
            <stop offset="40%" stopColor="#18181b" />
            <stop offset="70%" stopColor="#09090b" />
            <stop offset="100%" stopColor="#3b0764" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 0 8px rgba(168,85,247,0.4))">
          {/* Razor obsidian blade dagger */}
          <path d="M25 80 L78 20 L85 24 L52 76 Z" fill="url(#obsidianGrad)" stroke="#a855f7" strokeWidth="2" strokeLinejoin="round" />
          {/* Conchoidal fracture reflection line */}
          <path d="M36 70 L72 26 L65 42 L48 62" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <polygon points="78,20 85,24 75,32" fill="#e9d5ff" opacity="0.6" />
        </g>
      </svg>
    );
  }

  // Bone Blade
  if (key.includes('BONE_BLADE')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          <path d="M25 78 L80 18 L84 25 L65 55 L45 74 Z" fill="#f5f5f4" stroke="#78716c" strokeWidth="2.5" />
          <polygon points="70,30 76,32 72,38" fill="#d6d3d1" />
          <polygon points="58,45 64,48 60,54" fill="#d6d3d1" />
        </g>
      </svg>
    );
  }

  // Metal Blade
  if (key.includes('METAL_BLADE') || key.includes('METAL_SPEAR')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 0 8px rgba(245,158,11,0.5))">
          {/* Forged copper / bronze blade */}
          <path d="M22 80 L76 16 L84 22 L62 70 Z" fill="#ea580c" stroke="#fed7aa" strokeWidth="2.5" />
          <line x1="32" y1="70" x2="74" y2="24" stroke="#ffedd5" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // Machete
  if (key.includes('MACHETE')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wooden grip */}
          <path d="M18 84 L34 68 L42 74 L26 90 Z" fill="#78350f" stroke="#292524" strokeWidth="2" />
          {/* Wide machete blade */}
          <path d="M34 68 L70 30 Q88 15 90 26 L62 72 Z" fill="#94a3b8" stroke="#1e293b" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M42 60 L78 26" stroke="#f8fafc" strokeWidth="2" opacity="0.7" />
        </g>
      </svg>
    );
  }

  // Pickaxe
  if (key.includes('PICKAXE')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wooden handle */}
          <line x1="20" y1="85" x2="75" y2="30" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
          {/* Double-pointed curved pick head */}
          <path d="M45 15 C60 30 78 40 92 48 L86 54 C72 45 58 35 48 24 Z" fill="#64748b" stroke="#0f172a" strokeWidth="2" />
          <path d="M45 15 C36 28 26 40 12 48 L18 54 C30 44 40 32 48 24 Z" fill="#64748b" stroke="#0f172a" strokeWidth="2" />
          <circle cx="58" cy="38" r="6" fill="#d97706" />
        </g>
      </svg>
    );
  }

  // Hammer
  if (key.includes('HAMMER')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          <line x1="25" y1="85" x2="68" y2="35" stroke="#78350f" strokeWidth="7" strokeLinecap="round" />
          {/* Heavy stone block hammerhead */}
          <rect x="52" y="16" width="36" height="24" rx="4" transform="rotate(-40 52 16)" fill="#64748b" stroke="#1e293b" strokeWidth="3" />
        </g>
      </svg>
    );
  }

  // Shovel
  if (key.includes('SHOVEL')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          <line x1="20" y1="85" x2="65" y2="35" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
          {/* Broad scoop blade */}
          <path d="M58 42 L82 18 C88 24 88 36 82 42 L65 55 Z" fill="#94a3b8" stroke="#334155" strokeWidth="2.5" />
        </g>
      </svg>
    );
  }

  // Backpack
  if (key.includes('BACKPACK')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          <rect x="26" y="24" width="48" height="60" rx="8" fill="#78350f" stroke="#3f1d0b" strokeWidth="3" />
          {/* Flap cover */}
          <path d="M26 24 C26 24 50 48 74 24 Z" fill="#92400e" stroke="#3f1d0b" strokeWidth="2" />
          {/* Utility straps */}
          <line x1="38" y1="24" x2="38" y2="84" stroke="#d97706" strokeWidth="3" />
          <line x1="62" y1="24" x2="62" y2="84" stroke="#d97706" strokeWidth="3" />
          <rect x="36" y="50" width="28" height="22" rx="3" fill="#a16207" stroke="#451a03" strokeWidth="2" />
        </g>
      </svg>
    );
  }

  // Water Flask
  if (key.includes('FLASK') || key.includes('WATER_FLASK')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          <path d="M42 20 L58 20 L58 32 C68 40 76 56 72 74 C68 86 32 86 28 74 C24 56 32 40 42 32 Z" fill="#854d0e" stroke="#451a03" strokeWidth="3" />
          {/* Rope shoulder sling */}
          <path d="M28 55 C16 40 30 10 50 10 C70 10 84 40 72 55" fill="none" stroke="#d97706" strokeWidth="3" strokeDasharray="3 2" />
          {/* Cork stopper */}
          <rect x="46" y="14" width="8" height="8" rx="2" fill="#d4d4d8" />
        </g>
      </svg>
    );
  }

  // 15. Drying Rack
  if (key.includes('DRYING_RACK')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Wooden legs A-frame */}
          <line x1="20" y1="85" x2="35" y2="25" stroke="#714e30" strokeWidth="4" strokeLinecap="round" />
          <line x1="42" y1="85" x2="33" y2="25" stroke="#5a381a" strokeWidth="4" strokeLinecap="round" />
          <line x1="68" y1="85" x2="80" y2="25" stroke="#714e30" strokeWidth="4" strokeLinecap="round" />
          <line x1="88" y1="85" x2="78" y2="25" stroke="#5a381a" strokeWidth="4" strokeLinecap="round" />
          {/* Horizontal crossbar pole */}
          <line x1="25" y1="35" x2="88" y2="35" stroke="#936639" strokeWidth="4.5" strokeLinecap="round" />
          {/* Suspended strips of smoked meat / fish */}
          <path d="M42 37 L42 62 M55 37 L55 68 M68 37 L68 58" stroke="#994d38" strokeWidth="4" strokeLinecap="round" strokeDasharray="3 1" />
        </g>
      </svg>
    );
  }

  // 16. Mortar & Pestle
  if (key.includes('MORTAR')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <defs>
          <linearGradient id="mortarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#71717a" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <g filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))">
          {/* Pestle leaning in bowl */}
          <path d="M52 20 L66 48 L56 53 L42 25 Z" fill="#a1a1aa" stroke="#27272a" strokeWidth="2" strokeLinejoin="round" />
          {/* Mortar stone bowl */}
          <path d="M22 50 C20 78 30 85 50 85 C70 85 80 78 78 50 Z" fill="url(#mortarGrad)" stroke="#27272a" strokeWidth="3" />
          <ellipse cx="50" cy="50" rx="28" ry="10" fill="#27272a" stroke="#18181b" strokeWidth="2" />
          {/* Green herb powder in bowl */}
          <ellipse cx="50" cy="52" rx="18" ry="5" fill="#16a34a" />
        </g>
      </svg>
    );
  }

  // Default Anvil / Hammer Fallback
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
      <path d="M25 35 L75 35 L70 50 L58 52 L58 72 L72 78 L28 78 L42 72 L42 52 L30 50 Z" fill="#9ca3af" stroke="#374151" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
};

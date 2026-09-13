import React from 'react';

/**
 * Encounter UI Rustic Asset Icons
 * Bộ biểu tượng rèn khắc mộc mạc (Rustic & Forged) thay thế cho các icon vector phẳng trong Encounter.
 * Sử dụng kỹ thuật SVG đa lớp, inner shadow, metallic grain và tone màu kim loại/da thuộc cổ điển.
 */

interface IconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

// 1. Biểu tượng Dấu chân Thú dữ / Thám hiểm (In chìm trên huy hiệu gỗ)
export const FootprintsAssetIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', size, style }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="pawGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#422513" />
        <stop offset="60%" stopColor="#24140a" />
        <stop offset="100%" stopColor="#140b05" />
      </linearGradient>
      <filter id="pawShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#ffe2a5" floodOpacity="0.3" />
      </filter>
    </defs>
    {/* Main Pad */}
    <path
      d="M16 14C11.5 14 8 17.5 8.5 22.5C8.8 25.5 11 27.5 16 27.5C21 27.5 23.2 25.5 23.5 22.5C24 17.5 20.5 14 16 14Z"
      fill="url(#pawGrad)"
      stroke="#140804"
      strokeWidth="1.2"
      filter="url(#pawShadow)"
    />
    {/* Claws / Toe pads */}
    <circle cx="9" cy="10" r="2.4" fill="url(#pawGrad)" stroke="#140804" strokeWidth="0.8" />
    <circle cx="13.5" cy="7.5" r="2.6" fill="url(#pawGrad)" stroke="#140804" strokeWidth="0.8" />
    <circle cx="18.5" cy="7.5" r="2.6" fill="url(#pawGrad)" stroke="#140804" strokeWidth="0.8" />
    <circle cx="23" cy="10" r="2.4" fill="url(#pawGrad)" stroke="#140804" strokeWidth="0.8" />
  </svg>
);

// 2. Biểu tượng Quan sát (Kính viễn vọng / Lăng kính trinh sát rèn đồng)
export const ObserveAssetIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', size, style }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="brassGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f5dc9e" />
        <stop offset="40%" stopColor="#c79c52" />
        <stop offset="100%" stopColor="#7a5522" />
      </linearGradient>
    </defs>
    {/* Spyglass barrel 1 */}
    <rect x="5" y="10" width="8" height="12" rx="2" fill="url(#brassGrad)" stroke="#3d260c" strokeWidth="1.2" />
    {/* Spyglass barrel 2 */}
    <rect x="19" y="10" width="8" height="12" rx="2" fill="url(#brassGrad)" stroke="#3d260c" strokeWidth="1.2" />
    {/* Bridge */}
    <path d="M13 15H19" stroke="url(#brassGrad)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M14 18H18" stroke="#3d260c" strokeWidth="1.5" strokeLinecap="round" />
    {/* Lens rings */}
    <circle cx="9" cy="16" r="2.5" fill="#142b26" stroke="#c79c52" strokeWidth="1" />
    <circle cx="23" cy="16" r="2.5" fill="#142b26" stroke="#c79c52" strokeWidth="1" />
    <circle cx="8" cy="15" r="0.8" fill="#75e2b0" />
    <circle cx="22" cy="15" r="0.8" fill="#75e2b0" />
  </svg>
);

// 3. Biểu tượng Kiềm chế / Giữ bình tĩnh (Bàn tay xoa dịu mộc bản)
export const CalmAssetIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', size, style }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="handGrad" x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ebd6b2" />
        <stop offset="50%" stopColor="#c29f70" />
        <stop offset="100%" stopColor="#755530" />
      </linearGradient>
    </defs>
    <path
      d="M11 11V6.5C11 5.7 11.7 5 12.5 5C13.3 5 14 5.7 14 6.5V13M14 8V5C14 4.2 14.7 3.5 15.5 3.5C16.3 3.5 17 4.2 17 5V13M17 9.5V7C17 6.2 17.7 5.5 18.5 5.5C19.3 5.5 20 6.2 20 7V14M20 12.5V10C20 9.2 20.7 8.5 21.5 8.5C22.3 8.5 23 9.2 23 10V18C23 23 19.5 27 15 27C11.5 27 8.5 24 8 20.5L7 16.5C6.7 15.5 7.3 14.5 8.3 14.2C9.1 14 10 14.5 10.3 15.3L11 17.5V11Z"
      fill="url(#handGrad)"
      stroke="#3d2812"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

// 4. Biểu tượng Lùi bước cẩn trọng (Dấu bước chân rút êm)
export const BackAwayAssetIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', size, style }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="stepGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#e3cfab" />
        <stop offset="100%" stopColor="#876840" />
      </linearGradient>
    </defs>
    {/* Left Footprint */}
    <path
      d="M10 20C8.5 20 7.5 18 8 15C8.5 12 10.5 9.5 12 10C13.5 10.5 13 13.5 12.5 16.5C12 19.5 11.5 20 10 20Z"
      fill="url(#stepGrad)"
      stroke="#36230f"
      strokeWidth="1.1"
    />
    {/* Right Footprint stepping backwards */}
    <path
      d="M20 25C18.5 25 17.5 23 18 20C18.5 17 20.5 14.5 22 15C23.5 15.5 23 18.5 22.5 21.5C22 24.5 21.5 25 20 25Z"
      fill="url(#stepGrad)"
      stroke="#36230f"
      strokeWidth="1.1"
    />
    {/* Backward tactical arrow */}
    <path
      d="M6 8L3 11L6 14M3 11H18"
      stroke="#7ae0a3"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 5. Biểu tượng Thế thủ / Chiến đấu (Gươm giáo & Lưỡi đá sắc bén rèn rỉ)
export const DefendAssetIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', size, style }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="bladeGrad" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f0f2eb" />
        <stop offset="50%" stopColor="#a3aba1" />
        <stop offset="100%" stopColor="#555e54" />
      </linearGradient>
      <linearGradient id="guardGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#d99f4e" />
        <stop offset="100%" stopColor="#694318" />
      </linearGradient>
    </defs>
    {/* Spear / Sword Blade */}
    <path
      d="M23 5L27 9L15 21L11 17L23 5Z"
      fill="url(#bladeGrad)"
      stroke="#2b332b"
      strokeWidth="1.2"
    />
    <path d="M23 5L13 19" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
    {/* Guard */}
    <path d="M10 16L16 22" stroke="url(#guardGrad)" strokeWidth="3" strokeLinecap="round" />
    {/* Handle wrapped with leather */}
    <path d="M12 20L7 25" stroke="#754b24" strokeWidth="2.6" strokeLinecap="round" />
    {/* Pommel */}
    <circle cx="6" cy="26" r="1.8" fill="url(#guardGrad)" stroke="#3b220d" strokeWidth="1" />
  </svg>
);

// 6. Biểu tượng Bản đồ Thoát hiểm / Rời đi (Tấm hải đồ cổ da thuộc)
export const LeaveMapAssetIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', size, style }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="mapParchment" x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ebd6b0" />
        <stop offset="100%" stopColor="#b59463" />
      </linearGradient>
    </defs>
    {/* Map Folds */}
    <path
      d="M4 8L11 5L19 9L27 6V23L19 26L11 22L4 25V8Z"
      fill="url(#mapParchment)"
      stroke="#473016"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    {/* Trail line */}
    <path
      d="M8 17C11 15 13 18 16 16C19 14 20 18 23 15"
      stroke="#8a2e1d"
      strokeWidth="1.4"
      strokeDasharray="2 2"
      strokeLinecap="round"
    />
    <circle cx="23" cy="15" r="1.5" fill="#8a2e1d" />
  </svg>
);

// 7. Biểu tượng Cây rừng / Đại ngàn hoang dã
export const WildernessTreesAssetIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', size, style }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="pineGrad1" x1="16" y1="4" x2="16" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4bb374" />
        <stop offset="100%" stopColor="#184a2d" />
      </linearGradient>
      <linearGradient id="pineGrad2" x1="9" y1="9" x2="9" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3c965f" />
        <stop offset="100%" stopColor="#133d24" />
      </linearGradient>
    </defs>
    {/* Center tall tree */}
    <path d="M16 4L22 13H18.5L23 20H17V26H15V20H9L13.5 13H10L16 4Z" fill="url(#pineGrad1)" stroke="#0d2617" strokeWidth="1.1" />
    {/* Side tree */}
    <path d="M8 11L13 18H10.5L14 24H7L10.5 18H8.5L8 11Z" fill="url(#pineGrad2)" stroke="#0d2617" strokeWidth="1" opacity="0.85" />
    {/* Ground hill line */}
    <path d="M3 27C11 25 21 25 29 27" stroke="#3b2b18" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 8. Biểu tượng Rương kho / Thành quả sinh tồn
export const RewardChestAssetIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size, style }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="chestGrad" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#e3b668" />
        <stop offset="60%" stopColor="#a37633" />
        <stop offset="100%" stopColor="#543710" />
      </linearGradient>
    </defs>
    <rect x="3" y="9" width="18" height="11" rx="2" fill="url(#chestGrad)" stroke="#301d08" strokeWidth="1.2" />
    <path d="M2 9C2 6.5 6 4.5 12 4.5C18 4.5 22 6.5 22 9H2Z" fill="url(#chestGrad)" stroke="#301d08" strokeWidth="1.2" />
    <circle cx="12" cy="13" r="1.5" fill="#ffeaa3" stroke="#301d08" strokeWidth="0.8" />
    <path d="M12 14.5V16.5" stroke="#301d08" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

// 9. Biểu tượng Khiên phòng thủ / Nhật ký biến cố
export const TacticalShieldAssetIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size, style }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="shieldGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#d9b675" />
        <stop offset="50%" stopColor="#9e7b42" />
        <stop offset="100%" stopColor="#4f3818" />
      </linearGradient>
    </defs>
    <path
      d="M12 3L4 6V11.5C4 16.5 7.5 20.5 12 21.5C16.5 20.5 20 16.5 20 11.5V6L12 3Z"
      fill="url(#shieldGrad)"
      stroke="#2b1d09"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M12 5V19.5" stroke="#ffe5a8" strokeWidth="0.8" opacity="0.6" />
    <path d="M6 10H18" stroke="#2b1d09" strokeWidth="0.8" opacity="0.5" />
  </svg>
);

// 10. Biểu tượng Điểm Kiến Thức / Thấu hiểu tập tính thú hoang
export const KnowledgeAssetIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size, style }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <defs>
      <linearGradient id="eyeAmber" x1="2" y1="4" x2="18" y2="16" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fae7b5" />
        <stop offset="100%" stopColor="#b38739" />
      </linearGradient>
    </defs>
    <path
      d="M10 4.5C5.5 4.5 2 10 2 10C2 10 5.5 15.5 10 15.5C14.5 15.5 18 10 18 10C18 10 14.5 4.5 10 4.5Z"
      fill="#14211a"
      stroke="url(#eyeAmber)"
      strokeWidth="1.2"
    />
    <circle cx="10" cy="10" r="3" fill="url(#eyeAmber)" stroke="#38250f" strokeWidth="0.8" />
    <circle cx="10" cy="10" r="1.3" fill="#1b120a" />
    <circle cx="9.2" cy="9.2" r="0.6" fill="#ffffff" />
  </svg>
);

// 11. Biểu tượng Vết thương / Nguy hại cơ thể
export const InjuryAssetIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size, style }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <path
      d="M4 10H16M10 4V16"
      stroke="#ff5e54"
      strokeWidth="3.2"
      strokeLinecap="round"
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
    />
    <path
      d="M5 10H15M10 5V15"
      stroke="#ffe6e4"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

// 12. Biểu tượng Điểm kinh nghiệm / Tinh hoa (Khắc gỗ vàng)
export const ExperienceAssetIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size, style }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ width: size, height: size, ...style }}
  >
    <polygon
      points="10,2 12.5,7.2 18,7.9 14,11.8 15,17.3 10,14.6 5,17.3 6,11.8 2,7.9 7.5,7.2"
      fill="#f7c845"
      stroke="#634509"
      strokeWidth="1.2"
      strokeLinejoin="round"
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
    />
    <polygon
      points="10,4.5 11.5,8 15.5,8.5 12.6,11.3 13.3,15.2 10,13.4 6.7,15.2 7.4,11.3 4.5,8.5 8.5,8"
      fill="#fffae6"
      opacity="0.5"
    />
  </svg>
);

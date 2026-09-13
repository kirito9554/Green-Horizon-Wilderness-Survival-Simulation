import React from 'react';
import { getItemIconPath } from '../../data/rawMaterialsIcons';
import { ITEMS_DATABASE } from '../../data/items';
import { 
  Package, 
  Leaf, 
  Utensils, 
  UtensilsCrossed,
  Droplet, 
  Sparkles, 
  Hammer, 
  CircleDot,
  Flame,
  Axe,
  Scissors,
  Fish,
  Heart,
  Plus,
  HelpCircle,
  Apple,
  Flower2,
  HeartPulse,
  Trash2,
  CheckCircle2,
  GlassWater,
  LucideIcon
} from 'lucide-react';

// Ánh xạ tên icon định nghĩa sang Lucide icon component tương ứng
const ICON_NAME_MAP: Record<string, LucideIcon> = {
  Flame,
  Axe,
  Scissors,
  Knife: Scissors,
  Fish,
  Utensils,
  UtensilsCrossed,
  Droplet,
  Droplets: Droplet,
  GlassWater,
  Heart,
  Plus,
  Leaf,
  Hammer,
  CircleDot,
  Package,
  Sparkles,
  Apple,
  Flower2,
  HeartPulse,
  Trash2,
  CheckCircle2,
};

interface ItemIconProps {
  itemId?: string;
  slug?: string;
  name?: string;
  category?: string;
  iconName?: string;
  size?: number; // mặc định 64
  className?: string;
  alt?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({
  itemId,
  slug,
  name,
  category: propCategory,
  iconName: propIconName,
  size = 64,
  className = '',
  alt,
}) => {
  // 1. Tìm đường dẫn icon nguyên liệu thô nếu khớp chính xác 1:1
  const iconSrc = getItemIconPath(itemId || slug || name);

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={alt || name || itemId || 'Item Icon'}
        width={size}
        height={size}
        loading="lazy"
        className={`object-contain select-none pointer-events-none drop-shadow-md ${className}`}
        style={{
          width: size ? `${size}px` : undefined,
          height: size ? `${size}px` : undefined,
          maxWidth: '100%',
          maxHeight: '100%',
        }}
        onError={(e) => {
          // Khi ảnh tải lỗi, ẩn ảnh để fallback hiện placeholder
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // 2. Nếu chưa có icon trong bộ 82 nguyên liệu thô, giữ placeholder chuẩn xác
  const itemDef = itemId ? ITEMS_DATABASE[itemId] : null;
  const category = propCategory || itemDef?.category || 'raw_material';
  const iconKey = propIconName || itemDef?.iconName || '';

  let IconComponent: LucideIcon = Package;
  if (iconKey && ICON_NAME_MAP[iconKey]) {
    IconComponent = ICON_NAME_MAP[iconKey];
  } else if (category === 'food') {
    IconComponent = Utensils;
  } else if (category === 'water') {
    IconComponent = Droplet;
  } else if (category === 'tool') {
    IconComponent = Hammer;
  } else if (category === 'medicine') {
    IconComponent = Heart;
  } else if (category === 'raw_material') {
    IconComponent = Leaf;
  }

  // Màu sắc tông ấm, thanh lịch theo danh mục cho placeholder
  let colorClass = 'text-amber-400/80';
  let borderClass = 'border-[#2d3a2f]';
  let bgClass = 'bg-[#101712]/80';

  if (category === 'food') {
    colorClass = 'text-amber-300';
    borderClass = 'border-amber-900/40';
    bgClass = 'bg-[#1a140d]/80';
  } else if (category === 'water') {
    colorClass = 'text-sky-300';
    borderClass = 'border-sky-900/40';
    bgClass = 'bg-[#0e161c]/80';
  } else if (category === 'tool') {
    colorClass = 'text-emerald-300';
    borderClass = 'border-emerald-900/40';
    bgClass = 'bg-[#0e1a14]/80';
  } else if (category === 'medicine') {
    colorClass = 'text-rose-300';
    borderClass = 'border-rose-900/40';
    bgClass = 'bg-[#1a0e12]/80';
  }

  const iconPixel = Math.round(size * 0.48);

  return (
    <div 
      className={`relative flex items-center justify-center rounded border ${borderClass} ${bgClass} shadow-inner transition-all select-none overflow-hidden ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 4px rgba(0,0,0,0.5)',
      }}
      title={name || itemId ? `${name || itemId}` : 'Vật phẩm'}
    >
      <IconComponent 
        style={{ width: `${iconPixel}px`, height: `${iconPixel}px` }}
        className={`${colorClass} drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`}
      />
    </div>
  );
};

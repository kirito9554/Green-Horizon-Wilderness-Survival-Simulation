import React from 'react';
import { Tent, Compass, Package, Anvil, Hammer, Users } from 'lucide-react';

export type ActiveTab = 'camp' | 'map' | 'inventory' | 'crafting' | 'buildings' | 'survivors';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  inventoryCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  inventoryCount,
}) => {
  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: string | number }> = [
    {
      id: 'camp',
      label: 'Khu trại (Camp)',
      icon: <Tent className="w-4 h-4" />,
    },
    {
      id: 'map',
      label: 'Bản đồ (Map)',
      icon: <Compass className="w-4 h-4" />,
    },
    {
      id: 'inventory',
      label: 'Kho bãi (Stock)',
      icon: <Package className="w-4 h-4" />,
      badge: inventoryCount,
    },
    {
      id: 'crafting',
      label: 'Chế tạo (Craft)',
      icon: <Anvil className="w-4 h-4" />,
    },
    {
      id: 'buildings',
      label: 'Xây dựng (Build)',
      icon: <Hammer className="w-4 h-4" />,
    },
    {
      id: 'survivors',
      label: 'Nhân sự (Roles)',
      icon: <Users className="w-4 h-4" />,
    },
  ];

  return (
    <nav className="w-full bg-[#111814] border-t border-[#24332b] px-4 py-2 flex items-center justify-around z-20 shrink-0 text-[#e2d5bd]">
      {navItems.map(item => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all select-none relative ${
              isActive
                ? 'bg-[#1f2d24] text-emerald-300 border border-emerald-500/60 shadow-inner'
                : 'text-[#8ea596] hover:text-[#e2d5bd] hover:bg-[#16211a]'
            }`}
          >
            {item.icon}
            <span className="font-serif tracking-wide">{item.label}</span>
            {item.badge !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#293c30] text-[#c9dcce] font-mono">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

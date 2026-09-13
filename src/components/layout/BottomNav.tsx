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
    <nav className="w-full bg-[#101713] border-t border-[#2a3c30] px-4 py-2 flex items-center justify-around z-20 shrink-0 text-[#e2d5bd] shadow-[0_-4px_16px_rgba(0,0,0,0.6)]">
      {navItems.map(item => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition-all select-none relative cursor-pointer ${
              isActive
                ? 'bg-gradient-to-b from-[#25392d] to-[#16241c] text-emerald-300 border border-emerald-500/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_2px_4px_rgba(0,0,0,0.5)]'
                : 'text-[#94a89a] hover:text-[#f2e7d3] hover:bg-[#18231c] border border-transparent hover:border-[#2f4236]/60'
            }`}
          >
            <span className={isActive ? 'text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]' : 'text-[#8ea596]'}>
              {item.icon}
            </span>
            <span className="font-serif tracking-wide text-xs">{item.label}</span>
            {item.badge !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#223328] text-emerald-200 border border-emerald-800/40 font-mono">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

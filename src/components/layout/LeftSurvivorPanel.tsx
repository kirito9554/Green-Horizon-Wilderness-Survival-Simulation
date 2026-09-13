import React from 'react';
import { Heart, Utensils, Droplets, Moon, Sparkles, Bed, Activity } from 'lucide-react';
import { SurvivorState } from '../../types';
import { SurvivorPortrait } from '../common/SurvivorPortrait';

interface LeftSurvivorPanelProps {
  survivors: SurvivorState[];
  selectedSurvivorId: string | null;
  onSelectSurvivor: (id: string) => void;
  onRestSurvivor: (id: string) => void;
  onOpenSurvivorManagement: () => void;
}

export const LeftSurvivorPanel: React.FC<LeftSurvivorPanelProps> = ({
  survivors,
  selectedSurvivorId,
  onSelectSurvivor,
  onRestSurvivor,
  onOpenSurvivorManagement,
}) => {
  return (
    <aside className="w-64 bg-[#141c17] border-r border-[#24332b] flex flex-col p-3 gap-3 overflow-y-auto z-10 shrink-0 text-[#e2d5bd]">
      <div className="flex items-center justify-between border-b border-[#223128] pb-2">
        <span className="text-xs font-serif font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Người sống sót ({survivors.length})
        </span>
        <button
          onClick={onOpenSurvivorManagement}
          className="text-[10px] text-amber-300 hover:text-amber-200 underline font-sans"
        >
          Phân công
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {survivors.map((survivor) => {
          const isSelected = selectedSurvivorId === survivor.id;
          const isBusy = survivor.currentAction.type !== 'idle';
          const progressPercent = survivor.currentAction.totalSeconds > 0
            ? Math.min(100, Math.round((survivor.currentAction.progressSeconds / survivor.currentAction.totalSeconds) * 100))
            : 0;

          return (
            <div
              key={survivor.id}
              onClick={() => onSelectSurvivor(survivor.id)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none relative ${
                isSelected
                  ? 'bg-[#1e2a22] border-emerald-500/70 shadow-sm'
                  : 'bg-[#18231d]/90 hover:bg-[#1c2821] border-[#27382d]'
              }`}
            >
              {/* Header: Avatar, Name, Role */}
              <div className="flex items-center gap-2 mb-2">
                <SurvivorPortrait
                  survivor={survivor}
                  shape="portrait"
                  className="w-9 h-12 rounded border border-[#3e5645] shrink-0 shadow"
                />
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[#f0e6d2] truncate">
                      {survivor.name}
                    </h3>
                    <span className="text-[10px] text-[#8ea596] truncate">
                      {survivor.role.split('&')[0]}
                    </span>
                  </div>
                  {/* Current status tag */}
                  <p className="text-[10px] text-emerald-300/80 truncate">
                    {survivor.currentAction.description}
                  </p>
                </div>
              </div>

              {/* Action Progress Bar if busy */}
              {isBusy && (
                <div className="mb-2">
                  <div className="flex justify-between text-[9px] text-[#a4b6aa] mb-0.5 font-mono">
                    <span>Tiến độ</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-[#121914] h-1.5 rounded-full overflow-hidden border border-[#2b3c31]">
                    <div
                      className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stat Meters */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                {/* Health */}
                <div className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-red-400 shrink-0" />
                  <div className="flex-1 bg-[#121914] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-red-500 h-full transition-all"
                      style={{ width: `${Math.round(survivor.health)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-[#a4b6aa] w-5 text-right font-bold">
                    {Math.round(survivor.health)}
                  </span>
                </div>

                {/* Hunger */}
                <div className="flex items-center gap-1" title="Mức đói: Càng cao càng đói">
                  <Utensils className="w-3 h-3 text-amber-400 shrink-0" />
                  <div className="flex-1 bg-[#121914] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        survivor.hunger > 70 ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, Math.round(100 - survivor.hunger)))}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-[#a4b6aa] w-5 text-right font-bold">
                    {Math.max(0, Math.min(100, Math.round(100 - survivor.hunger)))}
                  </span>
                </div>

                {/* Thirst */}
                <div className="flex items-center gap-1" title="Mức nước: Càng cao càng khát">
                  <Droplets className="w-3 h-3 text-sky-400 shrink-0" />
                  <div className="flex-1 bg-[#121914] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        survivor.thirst > 70 ? 'bg-red-500' : 'bg-sky-400'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, Math.round(100 - survivor.thirst)))}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-[#a4b6aa] w-5 text-right font-bold">
                    {Math.max(0, Math.min(100, Math.round(100 - survivor.thirst)))}
                  </span>
                </div>

                {/* Fatigue */}
                <div className="flex items-center gap-1" title="Thể lực: Càng cao càng mệt">
                  <Moon className="w-3 h-3 text-purple-400 shrink-0" />
                  <div className="flex-1 bg-[#121914] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        survivor.fatigue > 75 ? 'bg-red-500' : 'bg-purple-400'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, Math.round(100 - survivor.fatigue)))}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-[#a4b6aa] w-5 text-right font-bold">
                    {Math.max(0, Math.min(100, Math.round(100 - survivor.fatigue)))}
                  </span>
                </div>
              </div>

              {/* Quick Rest Button */}
              {survivor.currentAction.type === 'idle' && survivor.fatigue > 20 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestSurvivor(survivor.id);
                  }}
                  className="mt-2 w-full py-1 text-[10px] bg-[#223127] hover:bg-[#2c3f32] text-emerald-300 rounded border border-[#2e4235] flex items-center justify-center gap-1 transition-colors"
                >
                  <Bed className="w-3 h-3" />
                  <span>Nghỉ ngơi hồi sức</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-2 border-t border-[#223128] text-[10px] text-[#788e80]">
        <p>💡 Đói/khát sẽ tự động tiêu thụ lương thực và nước có sẵn trong kho trại.</p>
      </div>
    </aside>
  );
};

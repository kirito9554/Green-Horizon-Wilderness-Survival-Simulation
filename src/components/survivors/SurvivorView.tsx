import React, { useState } from 'react';
import { 
  Users, 
  Sparkles, 
  Image, 
  Check, 
  X,
  Heart,
  Droplets,
  Utensils,
  Moon,
  UserPlus
} from 'lucide-react';
import { GameState, JobType, JobPriority } from '../../types';
import { SurvivorPortrait } from '../common/SurvivorPortrait';
import { PORTRAIT_CONFIG } from '../../utils/portraitManager';

interface SurvivorViewProps {
  state: GameState;
  onUpdateJobPriority: (survivorId: string, job: JobType, priority: JobPriority) => void;
  onUpdatePolicy: (policyKey: 'foodPolicy' | 'waterPolicy', value: 'ration' | 'normal' | 'generous') => void;
  onUpdatePortrait?: (survivorId: string, portraitIndex: number) => void;
  onRecruitSurvivor?: () => void;
}

export const SurvivorView: React.FC<SurvivorViewProps> = ({
  state,
  onUpdateJobPriority,
  onUpdatePolicy,
  onUpdatePortrait,
  onRecruitSurvivor,
}) => {
  const { survivors, settings } = state;
  const [pickingPortraitForSurvivorId, setPickingPortraitForSurvivorId] = useState<string | null>(null);

  const jobList: Array<{ id: JobType; label: string }> = [
    { id: 'gather', label: 'Thu lượm (Gather)' },
    { id: 'build', label: 'Xây dựng (Build)' },
    { id: 'craft', label: 'Chế tạo (Craft)' },
    { id: 'cook', label: 'Nấu nướng (Cook)' },
    { id: 'haul', label: 'Vận chuyển (Haul)' },
    { id: 'medicine', label: 'Y tế (Medicine)' },
    { id: 'explore', label: 'Trinh sát (Explore)' },
  ];

  const priorityOrder: JobPriority[] = ['highest', 'high', 'normal', 'low', 'disabled'];

  const getNextPriority = (current: JobPriority): JobPriority => {
    const idx = priorityOrder.indexOf(current);
    return priorityOrder[(idx + 1) % priorityOrder.length];
  };

  const getPriorityStyle = (p: JobPriority) => {
    switch (p) {
      case 'highest':
        return 'bg-emerald-900/80 text-emerald-200 border-emerald-500 font-bold';
      case 'high':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700';
      case 'normal':
        return 'bg-[#18231d] text-[#c6d7cb] border-[#2b3c31]';
      case 'low':
        return 'bg-[#1e1b17] text-[#a49b88] border-[#362f26]';
      case 'disabled':
        return 'bg-[#141816] text-[#55695e] border-[#222926] line-through';
    }
  };

  const getPriorityLabel = (p: JobPriority) => {
    switch (p) {
      case 'highest': return '1 • Cao nhất';
      case 'high': return '2 • Cao';
      case 'normal': return '3 • Vừa';
      case 'low': return '4 • Thấp';
      case 'disabled': return '✕ Tắt';
    }
  };

  const selectedSurvivorForPortrait = survivors.find(s => s.id === pickingPortraitForSurvivorId);

  return (
    <div className="flex-1 flex flex-col p-3.5 gap-3.5 overflow-y-auto text-[#e2d5bd]">
      {/* 1. Header & Rations Policies */}
      <div className="camp-sunken-panel-soft p-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base md:text-lg font-bold text-[#f2e7d3]">
              Bảng quản lý nhân lực & Phân bổ công việc
            </h2>
          </div>
          <p className="text-xs md:text-sm text-[#8ea596] mt-1">
            Bấm vào ô ưu tiên để xoay vòng: 1 • Cao nhất → 2 • Cao → 3 • Vừa → 4 • Thấp → ✕ Tắt. Bấm ảnh nhân vật để đổi chân dung.
          </p>
        </div>

        {/* Policies Controls & Recruit Action */}
        <div className="flex items-center gap-3">
          {onRecruitSurvivor && survivors.length < 4 && (
            <button
              onClick={onRecruitSurvivor}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-800 to-teal-700 hover:from-emerald-700 hover:to-teal-600 text-[#f4ecd8] border border-emerald-500/50 flex items-center gap-2 text-sm font-bold shadow-md cursor-pointer transition-all active:scale-95"
              title="Chiêu mộ thêm 1 người sống sót mới vào trại (Tối đa 4 người)"
            >
              <UserPlus className="w-4 h-4 text-emerald-300" />
              <span>Chiêu mộ (+{4 - survivors.length})</span>
            </button>
          )}

          <div className="flex items-center gap-3 camp-sunken-slot px-3.5 py-2 rounded-lg">
            <div>
              <span className="text-[#8ea596] block text-xs font-semibold">Chính sách ăn:</span>
              <select
                value={settings.foodPolicy}
                onChange={(e) => onUpdatePolicy('foodPolicy', e.target.value as any)}
                className="camp-sunken-panel text-xs md:text-sm text-[#f2e7d3] font-medium rounded-md px-2.5 py-1.5 mt-1 focus:outline-none cursor-pointer"
              >
                <option value="ration">Tiết kiệm (Ration)</option>
                <option value="normal">Bình thường (Normal)</option>
                <option value="generous">Rộng rãi (Generous)</option>
              </select>
            </div>

            <div>
              <span className="text-[#8ea596] block text-xs font-semibold">Chính sách uống:</span>
              <select
                value={settings.waterPolicy}
                onChange={(e) => onUpdatePolicy('waterPolicy', e.target.value as any)}
                className="camp-sunken-panel text-xs md:text-sm text-[#f2e7d3] font-medium rounded-md px-2.5 py-1.5 mt-1 focus:outline-none cursor-pointer"
              >
                <option value="ration">Tiết kiệm (Ration)</option>
                <option value="normal">Bình thường (Normal)</option>
                <option value="generous">Rộng rãi (Generous)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Job Priority Matrix Table */}
      <div className="camp-sunken-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="camp-groove-divider text-[#8ea596]">
                <th className="p-3.5 font-bold text-sm text-[#f0e6d2]">Nhân sự (Bấm ảnh đổi chân dung)</th>
                {jobList.map(job => (
                  <th key={job.id} className="p-3 font-bold text-center text-xs md:text-sm text-[#c6d7cd] whitespace-nowrap">
                    {job.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3428]/40">
              {survivors.map(survivor => (
                <tr key={survivor.id} className="hover:bg-[#18231d]/60 transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => setPickingPortraitForSurvivorId(survivor.id)}
                        className="cursor-pointer group relative"
                        title="Bấm để đổi chân dung nhân vật"
                      >
                        <SurvivorPortrait
                          survivor={survivor}
                          shape="portrait"
                          className="w-10 h-14 rounded-md border border-emerald-600/50 shrink-0 shadow group-hover:border-amber-400 transition-colors"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-md transition-opacity">
                          <Image className="w-3.5 h-3.5 text-amber-300" />
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-sm md:text-base text-[#f0e6d2]">{survivor.name}</div>
                        <div className="text-xs text-[#8ea596] mt-0.5">{survivor.role}</div>
                      </div>
                    </div>
                  </td>

                  {jobList.map(job => {
                    const currentPriority = survivor.jobPriorities[job.id] || 'normal';
                    return (
                      <td key={job.id} className="p-2 text-center">
                        <button
                          onClick={() => {
                            const next = getNextPriority(currentPriority);
                            onUpdateJobPriority(survivor.id, job.id, next);
                          }}
                          className={`w-full py-2 px-2.5 rounded-lg text-xs md:text-sm border font-semibold transition-all select-none cursor-pointer shadow-xs ${getPriorityStyle(
                            currentPriority
                          )}`}
                          title="Bấm để chuyển mức độ ưu tiên"
                        >
                          {getPriorityLabel(currentPriority)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Survivor Detailed Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {survivors.map(survivor => (
          <div
            key={survivor.id}
            className="camp-sunken-panel p-4 flex flex-col justify-between gap-3.5"
          >
            <div>
              {/* Header: Portrait & Identity */}
              <div className="flex items-start gap-3.5 mb-3.5 pb-2.5 camp-groove-divider">
                <div 
                  onClick={() => setPickingPortraitForSurvivorId(survivor.id)}
                  className="cursor-pointer group relative shrink-0"
                  title="Bấm để đổi chân dung nhân vật"
                >
                  <SurvivorPortrait
                    survivor={survivor}
                    shape="portrait"
                    className="w-14 h-20 rounded-md border border-emerald-600/60 shadow group-hover:border-amber-400 transition-colors"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-md text-[10px] text-amber-300 transition-opacity">
                    <Image className="w-4 h-4 mb-0.5" />
                    <span>Đổi ảnh</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[#f0e6d2] truncate">{survivor.name}</h3>
                  <p className="text-xs text-[#8ea596] truncate mb-1.5">{survivor.role}</p>
                  
                  {/* Mini rounded vitals */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono font-semibold camp-sunken-slot p-2 rounded">
                    <div className="flex items-center gap-1 text-red-300">
                      <Heart className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{Math.round(survivor.health)}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-300">
                      <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{Math.max(0, Math.min(100, Math.round(100 - survivor.hunger)))}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-sky-300">
                      <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>{Math.max(0, Math.min(100, Math.round(100 - survivor.thirst)))}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-purple-300">
                      <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>{Math.max(0, Math.min(100, Math.round(100 - survivor.fatigue)))}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Traits */}
              <div className="mb-3.5">
                <span className="text-xs font-mono font-bold text-[#8ea596] block mb-1.5">
                  ĐẶC TÍNH BẨM SINH (TRAITS):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {survivor.traits.map(trait => (
                    <span
                      key={trait}
                      className="px-2.5 py-1 rounded-md text-xs camp-sunken-slot text-emerald-300 flex items-center gap-1.5 font-medium"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{trait}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div>
                <span className="text-xs font-mono font-bold text-[#8ea596] block mb-2">
                  KỸ NĂNG THỰC HÀNH:
                </span>
                <div className="space-y-2 text-xs">
                  {Object.entries(survivor.skills).map(([skillName, rawLevel]) => {
                    const level = typeof rawLevel === 'number' ? rawLevel : Number(rawLevel) || 1;
                    return (
                      <div key={skillName}>
                        <div className="flex justify-between text-[#b4c4ba] mb-1 capitalize font-medium">
                          <span>{skillName}</span>
                          <span className="font-mono text-amber-300 font-bold">Cấp {Math.round(level)}</span>
                        </div>
                        <div className="w-full camp-sunken-slot h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.max(15, (level / 5) * 100))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Portrait Selection Modal (20-Portrait Grid) */}
      {pickingPortraitForSurvivorId && selectedSurvivorForPortrait && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-[#140e08] border-2 border-[#523d24] rounded-xl p-4 shadow-2xl flex flex-col gap-3 max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-[#3b2a1a] pb-2">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-[#f5e6cc]">
                  Chọn Chân Dung Cho {selectedSurvivorForPortrait.name}
                </h3>
              </div>
              <button
                onClick={() => setPickingPortraitForSurvivorId(null)}
                className="p-1 rounded bg-[#22170f] hover:bg-[#382618] text-[#a38d72] hover:text-white border border-[#422e1b] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#a38d72]">
              Bảng chân dung 20 nhân vật (4 hàng x 5 cột). Chọn chân dung phù hợp với vai trò của người sống sót:
            </p>

            {/* 20 Portrait Grid */}
            <div className="grid grid-cols-5 gap-2.5 overflow-y-auto p-1 max-h-[60vh]">
              {Array.from({ length: PORTRAIT_CONFIG.total }).map((_, idx) => {
                const isCurrent = (selectedSurvivorForPortrait.portraitIndex ?? 0) === idx;
                return (
                  <button
                    key={`portrait_choice_${idx}`}
                    onClick={() => {
                      if (onUpdatePortrait) {
                        onUpdatePortrait(selectedSurvivorForPortrait.id, idx);
                      }
                      setPickingPortraitForSurvivorId(null);
                    }}
                    className={`group relative rounded-md p-1 border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isCurrent
                        ? 'border-amber-400 bg-amber-950/40 shadow-lg ring-2 ring-amber-400/50'
                        : 'border-[#3b2a1a] bg-[#1a120b] hover:border-[#705234] hover:bg-[#22180f]'
                    }`}
                  >
                    <SurvivorPortrait
                      portraitIndex={idx}
                      shape="portrait"
                      className="w-full aspect-[2/3] rounded shadow"
                    />
                    <div className="flex items-center justify-between w-full px-0.5 text-[10px]">
                      <span className="font-mono text-[#a38d72]">#{idx + 1}</span>
                      {isCurrent && <Check className="w-3 h-3 text-amber-400" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#3b2a1a]">
              <button
                onClick={() => setPickingPortraitForSurvivorId(null)}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-[#22170f] hover:bg-[#382618] text-[#e5dbc8] border border-[#523d24] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

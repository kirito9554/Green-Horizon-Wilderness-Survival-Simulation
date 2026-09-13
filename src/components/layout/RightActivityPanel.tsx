import React from 'react';
import { Compass, Hammer, Clock, FileText, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { ActiveExpedition, ConstructedBuilding, LogMessage } from '../../types';
import { AREAS_DATABASE } from '../../data/areas';
import { BUILDINGS_DATABASE } from '../../data/buildings';

interface RightActivityPanelProps {
  expeditions: ActiveExpedition[];
  buildings: ConstructedBuilding[];
  logs: LogMessage[];
}

export const RightActivityPanel: React.FC<RightActivityPanelProps> = ({
  expeditions,
  buildings,
  logs,
}) => {
  const underConstruction = buildings.filter(b => !b.isBuilt && b.buildProgressSeconds > 0);

  const getLogIcon = (type: LogMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />;
      case 'danger':
        return <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <aside className="w-72 bg-[#141c17] border-l border-[#24332b] flex flex-col p-3 gap-3 overflow-hidden z-10 shrink-0 text-[#e2d5bd]">
      {/* 1. Expeditions In Progress */}
      <div>
        <div className="flex items-center justify-between border-b border-[#223128] pb-1.5 mb-2">
          <span className="text-xs font-serif font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            Thám hiểm ({expeditions.length})
          </span>
        </div>

        {expeditions.length === 0 ? (
          <div className="p-2.5 rounded bg-[#18231d]/60 border border-[#233127] text-center text-xs text-[#7f9486]">
            Chưa có chuyến thám hiểm nào. Mở Bản đồ để khảo sát khu vực mới.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {expeditions.map(exp => {
              const area = AREAS_DATABASE[exp.areaId];
              const percent = Math.min(100, Math.round((exp.progressMinutes / exp.totalMinutes) * 100));
              const remainingMins = Math.max(0, Math.round(exp.totalMinutes - exp.progressMinutes));

              const getPhaseLabel = (p: ActiveExpedition['phase']) => {
                switch (p) {
                  case 'travel_out': return 'Đang tiến vào';
                  case 'exploring': return 'Đang khảo sát & thu lượm';
                  case 'travel_back': return 'Đang trở về trại';
                  case 'finished': return 'Hoàn tất';
                }
              };

              return (
                <div key={exp.id} className="p-2 rounded bg-[#19241e] border border-[#293b2f] text-xs">
                  <div className="flex justify-between font-medium text-[#f0e6d2] mb-1">
                    <span className="truncate">{area ? area.name : 'Vùng hoang dã'}</span>
                    <span className="text-amber-400 font-mono text-[11px]">{remainingMins}p</span>
                  </div>
                  <div className="text-[10px] text-emerald-300/80 mb-1.5">
                    {getPhaseLabel(exp.phase)} ({percent}%)
                  </div>
                  <div className="w-full bg-[#121914] h-1.5 rounded-full overflow-hidden border border-[#2b3c31]">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {exp.collectedLoot.length > 0 && (
                    <div className="mt-1.5 text-[10px] text-[#8ea596]">
                      Đã phát hiện {exp.collectedLoot.reduce((acc, l) => acc + l.quantity, 0)} mẫu vật phẩm.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Ongoing Construction */}
      {underConstruction.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-serif font-bold uppercase tracking-wider text-emerald-400/90 border-b border-[#223128] pb-1.5 mb-2">
            <Hammer className="w-3.5 h-3.5" />
            Đang xây dựng ({underConstruction.length})
          </div>
          <div className="flex flex-col gap-2">
            {underConstruction.map(bld => {
              const def = BUILDINGS_DATABASE[bld.buildingId];
              const pct = Math.min(100, Math.round((bld.buildProgressSeconds / bld.totalBuildSeconds) * 100));
              return (
                <div key={bld.id} className="p-2 rounded bg-[#19241e] border border-[#293b2f] text-xs">
                  <div className="flex justify-between font-medium text-[#f0e6d2] mb-1">
                    <span>{def ? def.name : 'Công trình'}</span>
                    <span className="text-amber-400 font-mono text-[11px]">{pct}%</span>
                  </div>
                  <div className="w-full bg-[#121914] h-1.5 rounded-full overflow-hidden border border-[#2b3c31]">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Camp Chronicle & Log Stream */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between border-b border-[#223128] pb-1.5 mb-2">
          <span className="text-xs font-serif font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Nhật ký sinh tồn
          </span>
          <span className="text-[10px] text-[#788e80] font-mono">{logs.length} mục</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {logs.map(log => (
            <div
              key={log.id}
              className="p-1.5 rounded bg-[#18231d]/70 border border-[#25352b] text-[11px] flex gap-1.5 leading-relaxed"
            >
              {getLogIcon(log.type)}
              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5 text-[9px] text-[#788e80] font-mono">
                  <span>Ngày {log.day}</span>
                  <span>{log.timeStr}</span>
                </div>
                <p className="text-[#d8ccb4] text-xs break-words">{log.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

import React from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Flame,
  AlertTriangle,
  Bell,
  Eye,
  Crosshair,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { GameState } from '../../types';

interface CampDefensesTabProps {
  state: GameState;
  onNavigateTab: (tab: string) => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const CampDefensesTab: React.FC<CampDefensesTabProps> = ({ state, onNavigateTab }) => {
  const { buildings, weather } = state;

  const hasCampfire = buildings.some(b => b.buildingId === 'BUILDING_CAMPFIRE_HEARTH' && b.isBuilt);
  const hasShelter = buildings.some(b => b.buildingId === 'BUILDING_LEAF_SHELTER' && b.isBuilt);

  // Calculate defense rating
  let defenseScore = 45;
  if (hasCampfire) defenseScore += 25;
  if (hasShelter) defenseScore += 15;
  if (weather.current === 'clear') defenseScore += 5;
  if (weather.current === 'storm') defenseScore -= 20;

  return (
    <div
      className="w-full h-full flex flex-col justify-between text-[#e8dfce] select-none pointer-events-auto"
      style={{
        fontFamily: UI_FONT,
      }}
    >
      {/* Top Banner */}
      <div className="camp-sunken-panel-soft flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="camp-sunken-slot p-1.5 text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#f5ecd8]">
              PHÒNG THỦ & AN NINH (CAMP DEFENSES)
            </h2>
            <p className="text-[11px] text-[#a9bcae]">
              Bảo vệ trại khỏi dã thú rừng rậm, báo đốm săn mồi ban đêm và thời tiết khắc nghiệt.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded camp-sunken-slot flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-[#a3bfae]">Chỉ số phòng hộ:</span>
            <span className="font-mono text-sm font-bold text-emerald-300">{defenseScore} / 100</span>
          </div>
        </div>
      </div>

      {/* Main Defense Systems Grid */}
      <div className="grid grid-cols-2 gap-3.5 mt-3 flex-1 min-h-0">
        {/* Defense 1: Perimeter Bamboo Fence */}
        <div className="camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 camp-groove-divider">
              <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                HÀNG RÀO CỌC TRE GAI (BAMBOO PERIMETER)
              </span>
              <span className="text-[11px] text-amber-400 font-semibold">Tuyến phòng thủ vòng ngoài</span>
            </div>

            <p className="text-xs text-[#9eb5a5] mt-2.5 leading-relaxed">
              Các cọc tre vót nhọn cắm nghiêng quanh chu vi khu trại. Giúp ngăn chặn lợn rừng và thú ăn thịt kích thước lớn bất ngờ lao vào lều trại lúc người sống sót đang ngủ.
            </p>

            <div className="mt-3 p-2.5 rounded camp-sunken-slot space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Giảm tỷ lệ thú tấn công:</span>
                <span className="font-semibold text-emerald-400">-60% nguy cơ thú đột kích đêm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Tình trạng:</span>
                <span className="font-semibold text-amber-300">Cần tre già và dây buộc để gia cố</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('buildings')}
            className="w-full py-2 rounded bg-[#1b3d2d] hover:bg-[#25523d] border border-[#2e5e45] text-xs font-semibold text-[#f1eadc] transition-colors cursor-pointer text-center shadow"
          >
            Xây dựng hàng rào bảo vệ
          </button>
        </div>

        {/* Defense 2: Night Perimeter Torches */}
        <div className="camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 camp-groove-divider">
              <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                ĐUỐC CẢNH GIỚI BAN ĐÊM (NIGHT TORCHES)
              </span>
              <span className={`text-[11px] font-semibold ${hasCampfire ? 'text-emerald-400' : 'text-amber-400'}`}>
                {hasCampfire ? 'Có ánh lửa' : 'Chưa có lửa'}
              </span>
            </div>

            <p className="text-xs text-[#9eb5a5] mt-2.5 leading-relaxed">
              Các cọc đuốc tẩm nhựa cây thắp sáng các góc khuất quanh trại. Ánh lửa xua đuổi các loài thú săn mồi sợ lửa và tăng tầm nhìn quan sát cho người gác đêm.
            </p>

            <div className="mt-3 p-2.5 rounded camp-sunken-slot space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Tầm chiếu sáng:</span>
                <span className="font-semibold text-amber-300">Bán kính 25m quanh trại</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Tác động tâm lý:</span>
                <span className="font-semibold text-emerald-400">+10 Morale cho người gác đêm</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('crafting')}
            className="w-full py-2 rounded bg-[#1b3d2d] hover:bg-[#25523d] border border-[#2e5e45] text-xs font-semibold text-[#f1eadc] transition-colors cursor-pointer text-center shadow"
          >
            Chế tạo đuốc phòng thủ
          </button>
        </div>

        {/* Defense 3: Bamboo Alarm Bell */}
        <div className="camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 camp-groove-divider">
              <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                CHUÔNG CẢNH BÁO BẰNG ỐNG TRE (ALARM CLAPPER)
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold">Cảnh báo sớm</span>
            </div>

            <p className="text-xs text-[#9eb5a5] mt-2.5 leading-relaxed">
              Hệ thống dây căng nối liền các ống tre khô gõ vào nhau khi có chuyển động xâm nhập vào rìa trại. Đánh thức toàn bộ trại viên chuẩn bị vũ khí chống trả.
            </p>

            <div className="mt-3 p-2.5 rounded camp-sunken-slot space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Phản ứng bất ngờ:</span>
                <span className="font-semibold text-emerald-400">Triệt tiêu trạng thái hoảng loạn</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Bảo trì:</span>
                <span className="font-semibold text-lime-300">Không tốn nhiên liệu</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('crafting')}
            className="w-full py-2 rounded bg-[#1b3d2d] hover:bg-[#25523d] border border-[#2e5e45] text-xs font-semibold text-[#f1eadc] transition-colors cursor-pointer text-center shadow"
          >
            Chế tạo hệ thống chuông báo
          </button>
        </div>

        {/* Defense 4: Spike Pit Traps */}
        <div className="camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 camp-groove-divider">
              <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-amber-400" />
                BẪY HỐ CHÔNG & DÂY THÒNG LỌNG (TRAPS)
              </span>
              <span className="text-[11px] text-amber-400 font-semibold">Tự động vô hiệu hoá</span>
            </div>

            <p className="text-xs text-[#9eb5a5] mt-2.5 leading-relaxed">
              Bẫy hố chôn chông tre ngụy trang bằng cành lá trên các lối mòn dẫn vào trại. Có thể bắt được thú rừng nhỏ để bổ sung thức ăn hoặc làm bị thương dã thú lớn.
            </p>

            <div className="mt-3 p-2.5 rounded camp-sunken-slot space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Chiến lợi phẩm:</span>
                <span className="font-semibold text-amber-300">Thu hoạch thịt & da thú định kỳ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Độ an toàn:</span>
                <span className="font-semibold text-emerald-400">Được đánh dấu tránh trại viên sập bẫy</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('crafting')}
            className="w-full py-2 rounded bg-[#1b3d2d] hover:bg-[#25523d] border border-[#2e5e45] text-xs font-semibold text-[#f1eadc] transition-colors cursor-pointer text-center shadow"
          >
            Đặt bẫy quanh khu trại
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { RotateCcw, Trash2, X, AlertTriangle } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmResetNewRun: () => void;
  onConfirmResetAllData: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmResetNewRun,
  onConfirmResetAllData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-[#18120c] border border-[#523c27] rounded-2xl max-w-md w-full p-5 flex flex-col gap-4 text-[#e5dbc8] shadow-[0_12px_36px_rgba(0,0,0,0.9)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#3b2a1a] pb-3">
          <div className="flex items-center gap-2.5 text-amber-400">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <h3 className="text-base font-serif font-bold text-[#f2e7d3]">
              Xác nhận Reset Game & Dữ liệu
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8f7a63] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#c2b299] leading-relaxed">
          Bạn đang yêu cầu khôi phục trò chơi về trạng thái ban đầu. Vui lòng lựa chọn hình thức reset bên dưới:
        </p>

        {/* Action Options */}
        <div className="space-y-3">
          {/* Option 1: Quick Reset New Run */}
          <button
            onClick={() => {
              onConfirmResetNewRun();
              onClose();
            }}
            className="w-full p-3.5 bg-[#261b11] hover:bg-[#362618] border border-[#5c4228] hover:border-amber-500/80 rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
          >
            <div className="p-2 bg-amber-950/80 rounded-lg border border-amber-800/50 text-amber-400 group-hover:scale-105 transition-transform shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#f5eee2] group-hover:text-amber-300 transition-colors">
                1. Chơi lại ván mới (Reset Tiến trình)
              </div>
              <div className="text-[11px] text-[#a18f77] mt-0.5">
                Xóa dữ liệu tự động lưu (Autosave) và bắt đầu lại Ngày 1. Các ô đã lưu thủ công (Slot 1-3) vẫn được giữ nguyên.
              </div>
            </div>
          </button>

          {/* Option 2: Full Wipe All Save Data */}
          <button
            onClick={() => {
              onConfirmResetAllData();
              onClose();
            }}
            className="w-full p-3.5 bg-[#2d1414] hover:bg-[#3f1c1c] border border-[#732a2a] hover:border-red-500/80 rounded-xl flex items-start gap-3 transition-all text-left group cursor-pointer"
          >
            <div className="p-2 bg-red-950/80 rounded-lg border border-red-800/50 text-red-400 group-hover:scale-105 transition-transform shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-red-200 group-hover:text-red-300 transition-colors">
                2. Xóa sạch TOÀN BỘ dữ liệu (Full Reset)
              </div>
              <div className="text-[11px] text-[#be8888] mt-0.5">
                Xóa sạch toàn bộ các ô lưu (Slot 1, 2, 3) và autosave khỏi trình duyệt, đưa trò chơi về trạng thái ban đầu.
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-[#3b2a1a] pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#b5a287] hover:text-white bg-[#20170f] hover:bg-[#2c2016] border border-[#403020] rounded-lg transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
};

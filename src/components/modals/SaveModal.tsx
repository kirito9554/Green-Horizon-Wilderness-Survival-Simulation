import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Upload, 
  Download, 
  Trash2, 
  X, 
  Check, 
  Clock, 
  Calendar,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { GameState } from '../../types';
import { saveManager, SaveMetadata } from '../../save/saveManager';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: GameState;
  onLoadState: (loaded: GameState) => void;
  onOpenResetConfirm?: () => void;
}

export const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  onClose,
  currentState,
  onLoadState,
  onOpenResetConfirm,
}) => {
  const [slots, setSlots] = useState<Array<SaveMetadata | null>>([null, null, null]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSlots(saveManager.listSlots());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSlot = (slotNumber: number) => {
    const success = saveManager.saveToSlot(slotNumber, currentState);
    if (success) {
      setSlots(saveManager.listSlots());
      setFeedback(`Đã lưu thành công vào Ô số ${slotNumber}!`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleLoadSlot = (slotNumber: number) => {
    const loaded = saveManager.loadFromSlot(slotNumber);
    if (loaded) {
      onLoadState(loaded);
      setFeedback(`Đã tải dữ liệu từ Ô số ${slotNumber}!`);
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 1000);
    }
  };

  const handleDeleteSlot = (slotNumber: number) => {
    saveManager.deleteSlot(slotNumber);
    setSlots(saveManager.listSlots());
    setFeedback(`Đã xóa Ô số ${slotNumber}.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleExportJSON = () => {
    saveManager.exportSaveJSON(currentState);
    setFeedback('Đã xuất file lưu trữ JSON!');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const loaded = saveManager.importSaveJSON(content);
      if (loaded) {
        onLoadState(loaded);
        setFeedback('Nhập file save thành công!');
        setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 1000);
      } else {
        setFeedback('File save không hợp lệ!');
        setTimeout(() => setFeedback(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#151f19] border border-[#2a3c30] rounded-2xl max-w-lg w-full p-5 flex flex-col gap-4 text-[#e2d5bd] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#24342a] pb-3">
          <div className="flex items-center gap-2">
            <Save className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-serif font-bold text-[#f2e7d3]">
              Hệ thống lưu trữ dữ liệu sinh tồn
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#788e80] hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="p-2 rounded bg-[#1e2e23] border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Save Slots */}
        <div className="space-y-2.5">
          {[1, 2, 3].map(slotNum => {
            const slotMeta = slots[slotNum - 1];

            return (
              <div
                key={slotNum}
                className="bg-[#18231d] border border-[#27382d] rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-xs text-[#f0e6d2]">
                      Ô lưu số {slotNum}
                    </span>
                    {slotMeta ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                        {slotMeta.campName}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#63796c] italic">
                        [Trống]
                      </span>
                    )}
                  </div>

                  {slotMeta ? (
                    <div className="flex items-center gap-3 text-[10px] text-[#8ea596]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#788e80]" />
                        Ngày {slotMeta.day} ({slotMeta.timeStr})
                      </span>
                      <span>• {slotMeta.survivorCount} người</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#63796c]">
                      Chưa có dữ liệu lưu
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleSaveSlot(slotNum)}
                    className="px-2.5 py-1 text-xs bg-[#1f2e24] hover:bg-[#283d30] text-emerald-300 rounded border border-[#2e4334] transition-colors"
                    title="Ghi đè dữ liệu hiện tại vào ô này"
                  >
                    Lưu (Save)
                  </button>

                  {slotMeta && (
                    <>
                      <button
                        onClick={() => handleLoadSlot(slotNum)}
                        className="px-2.5 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors"
                        title="Tải màn chơi từ ô này"
                      >
                        Tải (Load)
                      </button>
                      <button
                        onClick={() => handleDeleteSlot(slotNum)}
                        className="p-1 hover:bg-[#2e1d1d] text-[#788e80] hover:text-red-400 rounded transition-colors"
                        title="Xóa dữ liệu ô này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* File Import / Export JSON & Reset Game */}
        <div className="border-t border-[#24342a] pt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18231d] hover:bg-[#202f26] text-xs text-[#d8ccb4] rounded-lg border border-[#2b3c31] transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xuất file JSON</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18231d] hover:bg-[#202f26] text-xs text-[#d8ccb4] rounded-lg border border-[#2b3c31] cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Nhập file JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>

            {onOpenResetConfirm && (
              <button
                onClick={() => {
                  onClose();
                  onOpenResetConfirm();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d1717] hover:bg-[#3d1f1f] text-xs text-rose-300 rounded-lg border border-[#592626] transition-colors"
                title="Khôi phục trò chơi & xoá dữ liệu lưu"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Reset Game</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#a4b6aa] hover:text-white rounded bg-[#1c2720] border border-[#28382d]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

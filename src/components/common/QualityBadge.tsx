import React from 'react';
import { InventoryItem, ItemDefinition, ItemQuality } from '../../types';
import { QUALITY_CONFIG, getDominantQuality } from '../../utils/qualityUtils';
import { Shield, Sparkles, AlertCircle } from 'lucide-react';

interface QualityBadgeProps {
  item: InventoryItem;
  def: ItemDefinition;
  compact?: boolean;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({ item, def, compact = false }) => {
  const isTool = def.category === 'tool' || !!def.toolProperties;
  const breakdown = item.qualityBreakdown;
  const dominant = getDominantQuality(breakdown, item.quality);
  const meta = QUALITY_CONFIG[dominant];

  // Nếu là công cụ 1 cái (chỉ có 1 phẩm chất đơn)
  if (isTool || item.quality) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono rounded px-1.5 py-0.5 border text-[10px] font-medium`}
        style={{
          backgroundColor: meta.badgeBg,
          borderColor: meta.badgeBorder,
          color: meta.textColor,
        }}
        title={`${meta.nameVi} (${meta.nameEn}): ${meta.descriptionVi}`}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.colorHex }} />
        <span>{meta.nameVi}</span>
      </span>
    );
  }

  // Nếu là stack nhiều nguyên liệu (có breakdown)
  const crude = breakdown?.crude || 0;
  const standard = breakdown?.standard || 0;
  const prime = breakdown?.prime || 0;
  const masterwork = breakdown?.masterwork || 0;

  if (compact) {
    // Hiển thị mini bar tỉ lệ ở đáy card
    return (
      <div 
        className="w-full flex h-1.5 rounded-full overflow-hidden bg-[#111613] border border-[#233128]"
        title={`Phân bổ chất lượng: ${crude ? `Tạm bợ: ${crude} | ` : ''}Đạt chuẩn: ${standard}${prime ? ` | Tuyển chọn: ${prime}` : ''}${masterwork ? ` | Hoàn mỹ: ${masterwork}` : ''}`}
      >
        {crude > 0 && (
          <div 
            style={{ width: `${(crude / item.quantity) * 100}%`, backgroundColor: QUALITY_CONFIG.crude.colorHex }} 
            className="h-full" 
          />
        )}
        {standard > 0 && (
          <div 
            style={{ width: `${(standard / item.quantity) * 100}%`, backgroundColor: QUALITY_CONFIG.standard.colorHex }} 
            className="h-full" 
          />
        )}
        {prime > 0 && (
          <div 
            style={{ width: `${(prime / item.quantity) * 100}%`, backgroundColor: QUALITY_CONFIG.prime.colorHex }} 
            className="h-full" 
          />
        )}
        {masterwork > 0 && (
          <div 
            style={{ width: `${(masterwork / item.quantity) * 100}%`, backgroundColor: QUALITY_CONFIG.masterwork.colorHex }} 
            className="h-full" 
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full bg-[#121914] p-2 rounded-lg border border-[#243329]">
      <div className="flex items-center justify-between text-[11px] font-medium text-[#c5d5ca]">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Chất lượng trong đống đồ ({item.quantity})</span>
        </span>
        <span className="text-[10px] text-[#788e80] font-mono">Chi tiết phẩm chất</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        {masterwork > 0 && (
          <div 
            className="flex items-center justify-between px-2 py-1 rounded border text-[10px]"
            style={{ 
              backgroundColor: QUALITY_CONFIG.masterwork.badgeBg, 
              borderColor: QUALITY_CONFIG.masterwork.badgeBorder,
              color: QUALITY_CONFIG.masterwork.textColor 
            }}
          >
            <span className="font-semibold">✨ Hoàn mỹ</span>
            <span className="font-mono font-bold">x{masterwork}</span>
          </div>
        )}
        {prime > 0 && (
          <div 
            className="flex items-center justify-between px-2 py-1 rounded border text-[10px]"
            style={{ 
              backgroundColor: QUALITY_CONFIG.prime.badgeBg, 
              borderColor: QUALITY_CONFIG.prime.badgeBorder,
              color: QUALITY_CONFIG.prime.textColor 
            }}
          >
            <span className="font-semibold">🔸 Tuyển chọn</span>
            <span className="font-mono font-bold">x{prime}</span>
          </div>
        )}
        {standard > 0 && (
          <div 
            className="flex items-center justify-between px-2 py-1 rounded border text-[10px]"
            style={{ 
              backgroundColor: QUALITY_CONFIG.standard.badgeBg, 
              borderColor: QUALITY_CONFIG.standard.badgeBorder,
              color: QUALITY_CONFIG.standard.textColor 
            }}
          >
            <span className="font-semibold">🔹 Đạt chuẩn</span>
            <span className="font-mono font-bold">x{standard}</span>
          </div>
        )}
        {crude > 0 && (
          <div 
            className="flex items-center justify-between px-2 py-1 rounded border text-[10px]"
            style={{ 
              backgroundColor: QUALITY_CONFIG.crude.badgeBg, 
              borderColor: QUALITY_CONFIG.crude.badgeBorder,
              color: QUALITY_CONFIG.crude.textColor 
            }}
          >
            <span className="font-semibold">▫️ Tạm bợ</span>
            <span className="font-mono font-bold">x{crude}</span>
          </div>
        )}
      </div>
    </div>
  );
};

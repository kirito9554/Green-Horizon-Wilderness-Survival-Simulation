import { ItemQuality, QualityBreakdown } from '../types';

export interface QualityMetadata {
  id: ItemQuality;
  nameVi: string;
  nameEn: string;
  colorHex: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  descriptionVi: string;
  durabilityMultiplier: number;
  efficiencyMultiplier: number;
}

export const QUALITY_CONFIG: Record<ItemQuality, QualityMetadata> = {
  crude: {
    id: 'crude',
    nameVi: 'Tạm bợ',
    nameEn: 'Crude',
    colorHex: '#9ca3af', // Gray
    badgeBg: 'rgba(75, 85, 99, 0.25)',
    badgeBorder: '#4b5563',
    textColor: '#d1d5db',
    descriptionVi: 'Mục bở, nứt nẻ hoặc xơ non. Dễ hỏng, hao tốn nhiều sức khi thao tác.',
    durabilityMultiplier: 0.7,
    efficiencyMultiplier: 0.85,
  },
  standard: {
    id: 'standard',
    nameVi: 'Đạt chuẩn',
    nameEn: 'Standard',
    colorHex: '#34d399', // Emerald
    badgeBg: 'rgba(16, 185, 129, 0.2)',
    badgeBorder: '#059669',
    textColor: '#6ee7b7',
    descriptionVi: 'Vật liệu khô ráo, thớ thịt săn chắc, dây bện đều tay. Đủ bền cho việc hàng ngày.',
    durabilityMultiplier: 1.0,
    efficiencyMultiplier: 1.0,
  },
  prime: {
    id: 'prime',
    nameVi: 'Tuyển chọn',
    nameEn: 'Prime',
    colorHex: '#f59e0b', // Amber / Gold
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    badgeBorder: '#d97706',
    textColor: '#fcd34d',
    descriptionVi: 'Lõi gỗ cứng đanh, đá lửa sắc bén, xơ ngâm ráo dẻo dai. Hiệu suất vượt trội.',
    durabilityMultiplier: 1.5,
    efficiencyMultiplier: 1.25,
  },
  masterwork: {
    id: 'masterwork',
    nameVi: 'Hoàn mỹ',
    nameEn: 'Masterwork',
    colorHex: '#ec4899', // Rose/Purple-tinged Gold or Pink-Gold
    badgeBg: 'rgba(236, 72, 153, 0.2)',
    badgeBorder: '#be185d',
    textColor: '#f472b6',
    descriptionVi: 'Được ghè mài tỉ mỉ bởi thợ bậc thầy hoặc nguyên liệu hiếm có trong tự nhiên.',
    durabilityMultiplier: 2.2,
    efficiencyMultiplier: 1.6,
  },
};

/**
 * Trả về phẩm chất cao nhất có trong breakdown hoặc fallback
 */
export function getDominantQuality(breakdown?: QualityBreakdown, singleQuality?: ItemQuality): ItemQuality {
  if (singleQuality) return singleQuality;
  if (!breakdown) return 'standard';
  if ((breakdown.masterwork || 0) > 0) return 'masterwork';
  if ((breakdown.prime || 0) > 0) return 'prime';
  if ((breakdown.standard || 0) > 0) return 'standard';
  if ((breakdown.crude || 0) > 0) return 'crude';
  return 'standard';
}

/**
 * Phân bổ ngẫu nhiên phẩm chất khi thu nhặt nguyên liệu theo kỹ năng
 */
export function rollGatherQuality(foragingSkill: number = 1): ItemQuality {
  const roll = Math.random();
  // Kỹ năng cao hơn tăng tỉ lệ ra Prime / Masterwork
  const skillBonus = Math.min(0.25, (foragingSkill - 1) * 0.05);

  const masterworkThreshold = 0.02 + (skillBonus * 0.2); // 2% -> 7%
  const primeThreshold = 0.15 + skillBonus;              // 15% -> 40%
  const crudeThreshold = Math.max(0.08, 0.25 - skillBonus); // 25% -> 8%

  if (roll < masterworkThreshold) return 'masterwork';
  if (roll < masterworkThreshold + primeThreshold) return 'prime';
  if (roll < masterworkThreshold + primeThreshold + crudeThreshold) return 'crude';
  return 'standard';
}

/**
 * Gộp thêm phẩm chất vào một breakdown hiện có
 */
export function mergeQualityBreakdown(
  current: QualityBreakdown | undefined,
  quality: ItemQuality,
  amount: number
): QualityBreakdown {
  const result: QualityBreakdown = {
    crude: current?.crude || 0,
    standard: current?.standard || 0,
    prime: current?.prime || 0,
    masterwork: current?.masterwork || 0,
  };
  result[quality] = (result[quality] || 0) + amount;
  return result;
}

/**
 * Trừ bớt số lượng khỏi breakdown (ưu tiên trừ Crude trước để giữ đồ tốt, hoặc theo chỉ định)
 */
export function deductFromQualityBreakdown(
  breakdown: QualityBreakdown | undefined,
  amountToDeduct: number
): { updated: QualityBreakdown; deducted: Record<ItemQuality, number> } {
  const result: QualityBreakdown = {
    crude: breakdown?.crude || 0,
    standard: breakdown?.standard || 0,
    prime: breakdown?.prime || 0,
    masterwork: breakdown?.masterwork || 0,
  };
  const deducted: Record<ItemQuality, number> = {
    crude: 0,
    standard: 0,
    prime: 0,
    masterwork: 0,
  };

  let remaining = amountToDeduct;
  const order: ItemQuality[] = ['crude', 'standard', 'prime', 'masterwork'];

  for (const q of order) {
    if (remaining <= 0) break;
    const available = result[q] || 0;
    if (available > 0) {
      const take = Math.min(available, remaining);
      result[q] = available - take;
      deducted[q] += take;
      remaining -= take;
    }
  }

  return { updated: result, deducted };
}

export type FreshnessStage = 'fresh' | 'stale' | 'spoiled' | 'rotten';

export interface FreshnessMetadata {
  stage: FreshnessStage;
  labelVi: string;
  colorHex: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  nutritionMultiplier: number;
  moraleModifier: number;
  healthRiskPercent: number; // Tỉ lệ đau bụng/mất máu
  descriptionVi: string;
}

export const FRESHNESS_CONFIG: Record<FreshnessStage, FreshnessMetadata> = {
  fresh: {
    stage: 'fresh',
    labelVi: 'Tươi ngon',
    colorHex: '#10b981', // Emerald
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: '#059669',
    textColor: '#6ee7b7',
    nutritionMultiplier: 1.0,
    moraleModifier: 2,
    healthRiskPercent: 0,
    descriptionVi: 'Mọng nước, còn giữ nguyên hương vị tự nhiên và giá trị dinh dưỡng cao nhất.',
  },
  stale: {
    stage: 'stale',
    labelVi: 'Bắt đầu úa / ươn',
    colorHex: '#f59e0b', // Amber
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: '#d97706',
    textColor: '#fcd34d',
    nutritionMultiplier: 0.75,
    moraleModifier: 0,
    healthRiskPercent: 5,
    descriptionVi: 'Hơi khô héo hoặc có mùi chua nhẹ. Vẫn ăn được nhưng giảm chất lượng dinh dưỡng.',
  },
  spoiled: {
    stage: 'spoiled',
    labelVi: 'Ôi thiu / biến chất',
    colorHex: '#ef4444', // Red
    badgeBg: 'rgba(239, 68, 68, 0.2)',
    badgeBorder: '#dc2626',
    textColor: '#fca5a5',
    nutritionMultiplier: 0.4,
    moraleModifier: -8,
    healthRiskPercent: 40,
    descriptionVi: 'Nổi mốc nhớt, bốc mùi hôi thối. Ăn vào có nguy cơ ngộ độc và sụt giảm thể lực.',
  },
  rotten: {
    stage: 'rotten',
    labelVi: 'Đã phân rã',
    colorHex: '#78716c', // Stone
    badgeBg: 'rgba(120, 113, 108, 0.25)',
    badgeBorder: '#57534e',
    textColor: '#d6d3d1',
    nutritionMultiplier: 0,
    moraleModifier: -15,
    healthRiskPercent: 100,
    descriptionVi: 'Đã hoàn toàn hóa thành mùn hữu cơ, chỉ còn giá trị ủ phân bón hoặc làm mồi bẫy.',
  },
};

export function getFreshnessStage(freshness: number = 100): FreshnessStage {
  if (freshness <= 0) return 'rotten';
  if (freshness < 25) return 'spoiled';
  if (freshness < 65) return 'stale';
  return 'fresh';
}

export type ConditionStage = 'pristine' | 'worn' | 'chipped' | 'critical' | 'broken';

export interface ConditionMetadata {
  stage: ConditionStage;
  labelVi: string;
  colorHex: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  efficiencyMultiplier: number;
  descriptionVi: string;
}

export const CONDITION_CONFIG: Record<ConditionStage, ConditionMetadata> = {
  pristine: {
    stage: 'pristine',
    labelVi: 'Sắc bén / Chắc chắn',
    colorHex: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: '#059669',
    textColor: '#6ee7b7',
    efficiencyMultiplier: 1.0,
    descriptionVi: 'Lưỡi đá mài bén, cán gỗ đẽo bóng và dây bện căng chắc.',
  },
  worn: {
    stage: 'worn',
    labelVi: 'Mòn đều',
    colorHex: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeBorder: '#2563eb',
    textColor: '#93c5fd',
    efficiencyMultiplier: 0.9,
    descriptionVi: 'Lưỡi có vết xước nhẹ qua quá trình thao tác, vẫn hoạt động tốt.',
  },
  chipped: {
    stage: 'chipped',
    labelVi: 'Mẻ cạnh / Lỏng cán',
    colorHex: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: '#d97706',
    textColor: '#fcd34d',
    efficiencyMultiplier: 0.75,
    descriptionVi: 'Lưỡi mẻ nhiều mảng nhỏ, dây thừng bắt đầu dão. Cần bảo dưỡng sớm.',
  },
  critical: {
    stage: 'critical',
    labelVi: 'Sắp gãy nát',
    colorHex: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.2)',
    badgeBorder: '#dc2626',
    textColor: '#fca5a5',
    efficiencyMultiplier: 0.5,
    descriptionVi: 'Cán gỗ đã nứt dọc và đầu đá lung lay dữ dội. Có thể vỡ bất cứ lúc nào.',
  },
  broken: {
    stage: 'broken',
    labelVi: 'Đã gãy hỏng',
    colorHex: '#71717a',
    badgeBg: 'rgba(113, 113, 122, 0.2)',
    badgeBorder: '#52525b',
    textColor: '#a1a1aa',
    efficiencyMultiplier: 0.1,
    descriptionVi: 'Không còn khả năng sử dụng, chỉ còn giá trị tháo dỡ lấy phế liệu.',
  },
};

export function getConditionStage(condition: number = 100, maxCondition: number = 100): ConditionStage {
  if (condition <= 0) return 'broken';
  const ratio = Math.max(0, Math.min(1, condition / Math.max(1, maxCondition)));
  if (ratio < 0.15) return 'critical';
  if (ratio < 0.40) return 'chipped';
  if (ratio < 0.75) return 'worn';
  return 'pristine';
}

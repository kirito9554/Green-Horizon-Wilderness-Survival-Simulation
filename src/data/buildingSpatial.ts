import type { ClusterType } from '../types/buildingSimulation';

export interface ClusterDefinition {
  type: ClusterType;
  name: string;
  subtitle: string;
  description: string;
  minAreaM2: number;
  preferredAreaM2: number;
  maxAreaM2: number;
  preferred: string[];
  avoid: string[];
  weights: {
    bearing: number;
    drainage: number;
    floodSafety: number;
    flatness: number;
    sunlight: number;
    shelter: number;
    waterAccess: number;
    fireSafety: number;
    fertility: number;
  };
}

export interface BuildingSpatialProfile {
  footprintAreaM2: number;
  compatibleClusters: ClusterType[];
  minBearing: number;
  maxSlope: number;
  maxFloodRisk: number;
  preferredDrainage: number;
  placementPriority: Array<'bearing' | 'drainage' | 'flatness' | 'fireSafety' | 'sunlight' | 'shelter' | 'waterAccess'>;
}

export const CLUSTER_DEFINITIONS: Record<ClusterType, ClusterDefinition> = {
  shelter: {
    type: 'shelter',
    name: 'Khu Nhà Ở',
    subtitle: 'Shelter Cluster',
    description: 'Khu nghỉ ngơi, ngủ và sinh hoạt cá nhân. Ưu tiên nền khô, ổn định và tránh gió mạnh.',
    minAreaM2: 75,
    preferredAreaM2: 125,
    maxAreaM2: 225,
    preferred: ['Nền ổn định', 'Thoát nước tốt', 'Ít gió trực diện'],
    avoid: ['Ngập nước', 'Sườn dốc mạnh'],
    weights: { bearing: 1.1, drainage: 1.2, floodSafety: 1.4, flatness: 1.2, sunlight: 0.4, shelter: 0.8, waterAccess: 0.3, fireSafety: 0.5, fertility: 0.1 },
  },
  storage: {
    type: 'storage',
    name: 'Khu Kho Bãi',
    subtitle: 'Storage Yard',
    description: 'Không gian lưu trữ vật tư khô, tập kết hàng hóa và hỗ trợ logistics trong trại.',
    minAreaM2: 60,
    preferredAreaM2: 100,
    maxAreaM2: 200,
    preferred: ['Nền khô', 'Đường tiếp cận tốt', 'Đất chịu tải tốt'],
    avoid: ['Ẩm thấp', 'Ngập nước'],
    weights: { bearing: 1.4, drainage: 1.2, floodSafety: 1.3, flatness: 1.0, sunlight: 0.2, shelter: 0.4, waterAccess: 0.1, fireSafety: 0.6, fertility: 0.1 },
  },
  cooking: {
    type: 'cooking',
    name: 'Khu Nấu Nướng',
    subtitle: 'Cooking Cluster',
    description: 'Khu bếp, sơ chế thực phẩm và các hoạt động dùng lửa. Cần thông thoáng nhưng đủ an toàn cháy.',
    minAreaM2: 50,
    preferredAreaM2: 90,
    maxAreaM2: 160,
    preferred: ['Thông thoáng', 'Nền khô', 'Ít vật liệu cháy quanh bếp'],
    avoid: ['Tán cây quá dày', 'Gió mạnh', 'Sát vùng ở'],
    weights: { bearing: 0.8, drainage: 0.9, floodSafety: 0.9, flatness: 0.8, sunlight: 0.5, shelter: 0.2, waterAccess: 0.5, fireSafety: 1.5, fertility: 0.0 },
  },
  farming: {
    type: 'farming',
    name: 'Khu Trồng Trọt',
    subtitle: 'Farming Patch',
    description: 'Khu đất canh tác, cây lương thực và cây thân gỗ. Ưu tiên ánh sáng, đất tốt và nguồn nước thuận tiện.',
    minAreaM2: 100,
    preferredAreaM2: 175,
    maxAreaM2: 350,
    preferred: ['Đất màu mỡ', 'Nắng tốt', 'Gần nguồn nước'],
    avoid: ['Đá lộ thiên', 'Bóng râm dày'],
    weights: { bearing: 0.2, drainage: 0.8, floodSafety: 0.7, flatness: 0.6, sunlight: 1.5, shelter: 0.1, waterAccess: 1.0, fireSafety: 0.1, fertility: 1.6 },
  },
  utility: {
    type: 'utility',
    name: 'Khu Tiện Ích',
    subtitle: 'Utility Area',
    description: 'Không gian cho nước, giặt rửa, xử lý và các công trình tiện ích chung.',
    minAreaM2: 60,
    preferredAreaM2: 100,
    maxAreaM2: 200,
    preferred: ['Gần nước', 'Thoát nước tốt', 'Dễ tiếp cận'],
    avoid: ['Nền quá yếu'],
    weights: { bearing: 0.8, drainage: 1.3, floodSafety: 0.7, flatness: 0.6, sunlight: 0.4, shelter: 0.2, waterAccess: 1.4, fireSafety: 0.3, fertility: 0.0 },
  },
  defense: {
    type: 'defense',
    name: 'Vành Đai Phòng Thủ',
    subtitle: 'Defensive Edge',
    description: 'Khu phòng thủ, cảnh giới và kiểm soát lối tiếp cận quanh trại.',
    minAreaM2: 75,
    preferredAreaM2: 125,
    maxAreaM2: 250,
    preferred: ['Tầm nhìn tốt', 'Nền chắc', 'Rìa trại'],
    avoid: ['Vũng thấp', 'Vegetation dày'],
    weights: { bearing: 1.1, drainage: 0.7, floodSafety: 0.9, flatness: 0.5, sunlight: 0.8, shelter: 0.1, waterAccess: 0.0, fireSafety: 0.3, fertility: 0.0 },
  },
  livestock: {
    type: 'livestock',
    name: 'Khu Chăn Nuôi',
    subtitle: 'Livestock Pen',
    description: 'Khu nuôi giữ động vật và chuồng trại. Ưu tiên nền tương đối phẳng, thoát nước và gần nguồn nước.',
    minAreaM2: 90,
    preferredAreaM2: 150,
    maxAreaM2: 300,
    preferred: ['Nền phẳng', 'Thoát nước', 'Gần nước'],
    avoid: ['Đất lầy', 'Sát nơi ở'],
    weights: { bearing: 0.8, drainage: 1.1, floodSafety: 1.0, flatness: 1.2, sunlight: 0.7, shelter: 0.2, waterAccess: 1.0, fireSafety: 0.2, fertility: 0.2 },
  },
  research: {
    type: 'research',
    name: 'Khu Nghiên Cứu',
    subtitle: 'Research Area',
    description: 'Khu làm việc chính xác, nghiên cứu vật liệu và chế tác chuyên sâu. Cần nền ổn định và môi trường tương đối khô.',
    minAreaM2: 60,
    preferredAreaM2: 100,
    maxAreaM2: 180,
    preferred: ['Nền ổn định', 'Khô ráo', 'Ít rung chấn'],
    avoid: ['Ngập', 'Đất mềm'],
    weights: { bearing: 1.5, drainage: 1.0, floodSafety: 1.2, flatness: 1.1, sunlight: 0.5, shelter: 0.6, waterAccess: 0.2, fireSafety: 0.4, fertility: 0.0 },
  },
};

export const BUILDING_SPATIAL_PROFILES: Record<string, BuildingSpatialProfile> = {
  BUILDING_CAMPFIRE_HEARTH: {
    footprintAreaM2: 6,
    compatibleClusters: ['cooking', 'utility'],
    minBearing: 25,
    maxSlope: 18,
    maxFloodRisk: 55,
    preferredDrainage: 45,
    placementPriority: ['fireSafety', 'flatness', 'drainage'],
  },
  BUILDING_LEAF_SHELTER: {
    footprintAreaM2: 18,
    compatibleClusters: ['shelter'],
    minBearing: 40,
    maxSlope: 14,
    maxFloodRisk: 40,
    preferredDrainage: 60,
    placementPriority: ['flatness', 'drainage', 'shelter', 'bearing'],
  },
  BUILDING_WOVEN_BASKET_RACK: {
    footprintAreaM2: 8,
    compatibleClusters: ['storage', 'shelter', 'cooking'],
    minBearing: 40,
    maxSlope: 14,
    maxFloodRisk: 45,
    preferredDrainage: 60,
    placementPriority: ['bearing', 'drainage', 'flatness'],
  },
  BUILDING_RAIN_COLLECTOR: {
    footprintAreaM2: 10,
    compatibleClusters: ['utility', 'shelter'],
    minBearing: 30,
    maxSlope: 18,
    maxFloodRisk: 60,
    preferredDrainage: 45,
    placementPriority: ['waterAccess', 'flatness', 'bearing'],
  },
  BUILDING_CARPENTER_BENCH: {
    footprintAreaM2: 10,
    compatibleClusters: ['research', 'storage', 'shelter'],
    minBearing: 55,
    maxSlope: 10,
    maxFloodRisk: 35,
    preferredDrainage: 65,
    placementPriority: ['bearing', 'flatness', 'drainage', 'shelter'],
  },
};

export function getSpatialProfile(buildingId: string): BuildingSpatialProfile {
  return BUILDING_SPATIAL_PROFILES[buildingId] || {
    footprintAreaM2: 10,
    compatibleClusters: ['utility'],
    minBearing: 35,
    maxSlope: 15,
    maxFloodRisk: 55,
    preferredDrainage: 50,
    placementPriority: ['bearing', 'flatness', 'drainage'],
  };
}
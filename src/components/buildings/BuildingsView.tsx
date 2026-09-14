import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Check,
  ChevronRight,
  Clock3,
  Droplets,
  Flame,
  FlaskConical,
  Hammer,
  Home,
  Leaf,
  MapPin,
  Package,
  Pause,
  PawPrint,
  Play,
  Plus,
  Shield,
  Shovel,
  Trash2,
  Trees,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { GameState } from '../../types';
import type {
  CampCluster,
  ClusterType,
  SiteRating,
  StructureConstructionJob,
} from '../../types/buildingSimulation';
import type { StructureWorkJob } from '../../types/structureMaintenanceSimulation';
import '../../types/buildingSimulation';
import '../../types/structureSimulation';
import '../../types/structureMaintenanceSimulation';
import { BUILDINGS_DATABASE } from '../../data/buildings';
import { CLUSTER_DEFINITIONS } from '../../data/buildingSpatial';
import { ITEMS_DATABASE } from '../../data/items';
import {
  getAvailableStructureModifications,
  STRUCTURE_MODIFICATIONS,
} from '../../data/structureModifications';
import {
  compatibleBuildingsForCluster,
  deriveClusterStats,
  findStructurePlacement,
  getClusterSiteCandidates,
} from '../../simulation/buildingClusterSystem';
import { deriveStructurePerformance } from '../../simulation/structureComponentSystem';
import { getAvailableInventoryStock } from '../../simulation/inventorySystem';

interface BuildingsViewProps {
  state: GameState;
  onStartConstruction: (survivorId: string, buildingId: string) => void;
}

type BuildingMode = 'clusters' | 'structures';

const CAMP_POI_ID = 'AREA_CAMP_CLEARING';
const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const CLUSTER_ORDER: ClusterType[] = ['shelter', 'storage', 'cooking', 'farming', 'utility', 'defense', 'livestock', 'research'];

const clusterIcons: Record<ClusterType, React.ComponentType<{ className?: string }>> = {
  shelter: Home,
  storage: Package,
  cooking: Flame,
  farming: Leaf,
  utility: Droplets,
  defense: Shield,
  livestock: PawPrint,
  research: FlaskConical,
};

const clusterAccent: Record<ClusterType, string> = {
  shelter: '#e8c66a',
  storage: '#d0aa58',
  cooking: '#f59e0b',
  farming: '#8dcf69',
  utility: '#64c5dc',
  defense: '#c9b15a',
  livestock: '#d39b68',
  research: '#9bc7a8',
};

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(4,34,31,.92), rgba(2,22,22,.96))',
  border: '1px solid rgba(116,139,102,.38)',
  boxShadow: 'inset 0 5px 14px rgba(0,0,0,.34), inset 0 1px rgba(255,255,255,.025)',
};

const raisedStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(9,48,42,.92), rgba(3,29,27,.96))',
  border: '1px solid rgba(126,153,107,.34)',
  boxShadow: '0 2px 8px rgba(0,0,0,.25), inset 0 1px rgba(255,255,255,.025)',
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function ratingMeta(rating: SiteRating) {
  if (rating === 'excellent') return { label: 'Rất phù hợp', color: '#7ee36a', icon: Check };
  if (rating === 'suitable') return { label: 'Phù hợp', color: '#a9d96f', icon: Check };
  if (rating === 'preparation_required') return { label: 'Cần chuẩn bị', color: '#f3c85b', icon: AlertTriangle };
  return { label: 'Không phù hợp', color: '#ef6d5d', icon: X };
}

function placementLabel(status: ReturnType<typeof findStructurePlacement>['status']) {
  if (status === 'available') return { label: 'Sẵn sàng', color: '#7ee36a' };
  if (status === 'preparation_required') return { label: 'Chuẩn bị nhẹ', color: '#f3c85b' };
  if (status === 'cluster_not_ready') return { label: 'Cluster chưa sẵn sàng', color: '#f3c85b' };
  if (status === 'incompatible') return { label: 'Không phù hợp', color: '#ef6d5d' };
  return { label: 'Không đủ mặt bằng', color: '#ef6d5d' };
}

function prepLabel(type: string) {
  const labels: Record<string, string> = {
    clear_vegetation: 'Dọn thảm thực vật',
    remove_roots: 'Đào bỏ rễ cây',
    remove_rocks: 'Dọn đá',
    clear_debris: 'Dọn mảnh vụn',
    drain_ground: 'Thoát nước mặt bằng',
    level_ground: 'San nền',
    compact_ground: 'Đầm nền',
  };
  return labels[type] || type;
}

function structureIcon(category: string) {
  if (category === 'shelter') return Home;
  if (category === 'storage') return Package;
  if (category === 'water') return Droplets;
  if (category === 'food') return Flame;
  if (category === 'production') return Wrench;
  return Box;
}

function componentLabel(kind: string) {
  const labels: Record<string, string> = {
    ground: 'Nền chuẩn bị',
    foundation: 'Móng / điểm neo',
    posts: 'Cột chính',
    frame: 'Khung chịu lực',
    bindings: 'Mối buộc & liên kết',
    surface: 'Bề mặt / sàn',
    roof: 'Mái che',
    fixture: 'Bộ phận chức năng',
    drainage: 'Thoát nước',
    hearth: 'Cụm bếp',
    other: 'Bộ phận khác',
  };
  return labels[kind] || kind;
}

function constructionStatus(job: StructureConstructionJob) {
  const labels: Record<StructureConstructionJob['status'], { label: string; color: string }> = {
    waiting_materials: { label: 'Chờ vật liệu', color: '#e5b95c' },
    waiting_hauling: { label: 'Chờ vận chuyển', color: '#d5c36c' },
    hauling: { label: 'Đang vận chuyển', color: '#6ecad2' },
    waiting_worker: { label: 'Chờ thợ', color: '#c8b878' },
    waiting_tool: { label: 'Thiếu công cụ', color: '#ed9c56' },
    waiting_weather: { label: 'Chờ thời tiết', color: '#72b6d7' },
    in_progress: { label: 'Đang thi công', color: '#78d96c' },
    paused: { label: 'Tạm dừng', color: '#a9a99f' },
    completed: { label: 'Hoàn thành', color: '#78d96c' },
  };
  return labels[job.status];
}

function constructionProgress(job: StructureConstructionJob) {
  if (!job.materialsDelivered) {
    if (job.haulTotalSeconds <= 0) return 0;
    return clampPercent(job.haulProgressSeconds / job.haulTotalSeconds * 100);
  }
  const total = job.phases.reduce((sum, phase) => sum + phase.totalSeconds, 0);
  const done = job.phases.reduce((sum, phase) => sum + (phase.status === 'completed' ? phase.totalSeconds : phase.progressSeconds), 0);
  return total > 0 ? clampPercent(done / total * 100) : 100;
}

function structureWorkStatus(job: StructureWorkJob) {
  if (job.status === 'waiting_materials') return { label: 'Chờ vật liệu', color: '#e5b95c' };
  if (job.status === 'waiting_worker') return { label: 'Chờ thợ', color: '#c8b878' };
  if (job.status === 'in_progress') return { label: 'Đang làm', color: '#78d96c' };
  if (job.status === 'paused') return { label: 'Tạm dừng', color: '#a9a99f' };
  return { label: 'Hoàn thành', color: '#78d96c' };
}

function structureWorkName(job: StructureWorkJob) {
  if (job.kind === 'modification') return STRUCTURE_MODIFICATIONS[job.modificationId || '']?.name || 'Cải tạo công trình';
  if (job.maintenanceMode === 'replace') return 'Thay thế bộ phận';
  if (job.maintenanceMode === 'repair') return 'Sửa chữa bộ phận';
  return 'Vá tạm bộ phận';
}

export const BuildingsView: React.FC<BuildingsViewProps> = ({ state, onStartConstruction }) => {
  const simulation = state.buildingSimulation;
  const clusters = simulation?.clusters.filter(cluster => cluster.poiId === CAMP_POI_ID) || [];
  const prepJobs = simulation?.preparationJobs || [];
  const constructionJobs = simulation?.constructionJobs || [];
  const structureWorkJobs = simulation?.structureWorkJobs || [];

  const [mode, setMode] = useState<BuildingMode>('clusters');
  const [clusterType, setClusterType] = useState<ClusterType>('shelter');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(clusters[0]?.id || null);
  const [selectedBuildingInstanceId, setSelectedBuildingInstanceId] = useState<string | null>(null);
  const [assignedSurvivorId, setAssignedSurvivorId] = useState<string>(
    state.survivors.find(survivor => survivor.currentAction.type === 'idle')?.id || state.survivors[0]?.id || '',
  );

  const candidates = useMemo(
    () => getClusterSiteCandidates(state, CAMP_POI_ID, clusterType),
    [state, clusterType],
  );

  useEffect(() => {
    if (!selectedSiteId || !candidates.some(candidate => candidate.id === selectedSiteId)) {
      setSelectedSiteId(candidates.find(candidate => candidate.rating !== 'unsuitable')?.id || candidates[0]?.id || null);
    }
  }, [candidates, selectedSiteId]);

  useEffect(() => {
    if (!selectedClusterId || !clusters.some(cluster => cluster.id === selectedClusterId)) {
      setSelectedClusterId(clusters[0]?.id || null);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    if (!assignedSurvivorId || !state.survivors.some(survivor => survivor.id === assignedSurvivorId)) {
      setAssignedSurvivorId(state.survivors[0]?.id || '');
    }
  }, [assignedSurvivorId, state.survivors]);

  useEffect(() => {
    if (selectedBuildingInstanceId && !state.buildings.some(building => building.id === selectedBuildingInstanceId)) {
      setSelectedBuildingInstanceId(null);
    }
  }, [selectedBuildingInstanceId, state.buildings]);

  const selectedSite = candidates.find(candidate => candidate.id === selectedSiteId) || candidates[0];
  const selectedCluster = clusters.find(cluster => cluster.id === selectedClusterId) || clusters[0];
  const selectedClusterStats = selectedCluster ? deriveClusterStats(state, selectedCluster.id) : null;
  const selectedStructure = selectedBuildingInstanceId
    ? state.buildings.find(building => building.id === selectedBuildingInstanceId)
    : undefined;

  const clusterStructures = selectedCluster
    ? state.buildings.filter(building => building.clusterId === selectedCluster.id)
    : [];
  const legacyStructures = state.buildings.filter(building => !building.clusterId);
  const structureLibrary = selectedCluster
    ? compatibleBuildingsForCluster(selectedCluster.type).map(buildingId => ({
        definition: BUILDINGS_DATABASE[buildingId],
        placement: findStructurePlacement(state, selectedCluster.id, buildingId),
      })).filter(entry => Boolean(entry.definition))
    : [];

  const selectedWorker = state.survivors.find(survivor => survivor.id === assignedSurvivorId);
  const activePrepJobs = prepJobs.filter(job => job.status !== 'completed');
  const activeConstructionJobs = constructionJobs.filter(job => job.status !== 'completed');
  const activeStructureWorkJobs = structureWorkJobs.filter(job => job.status !== 'completed');
  const totalBuilt = state.buildings.filter(building => building.isBuilt).length;
  const totalUnderConstruction = state.buildings.filter(building => !building.isBuilt).length;
  const idleBuilders = state.survivors.filter(survivor => survivor.currentAction.type === 'idle' && survivor.jobPriorities.build !== 'disabled').length;
  const queueCount = activePrepJobs.length + activeConstructionJobs.length + activeStructureWorkJobs.length;

  const totalStock = (itemId: string) => {
    const poi = state.poiStorages?.[CAMP_POI_ID];
    return getAvailableInventoryStock(state.inventory, itemId) + (poi ? getAvailableInventoryStock(poi, itemId) : 0);
  };

  const runBuildingCommand = (command: string) => {
    onStartConstruction(assignedSurvivorId, command);
  };

  const handleEstablishCluster = () => {
    if (!selectedSite || selectedSite.rating === 'unsuitable') return;
    runBuildingCommand(`__cluster_establish__:${CAMP_POI_ID}:${clusterType}:${selectedSite.id}`);
  };

  const handleBuildStructure = (cluster: CampCluster, buildingId: string) => {
    runBuildingCommand(`__cluster_build__:${cluster.id}:${buildingId}`);
  };

  const renderConstructionJob = (job: StructureConstructionJob) => {
    const building = state.buildings.find(candidate => candidate.id === job.buildingInstanceId);
    const def = BUILDINGS_DATABASE[job.buildingId];
    const status = constructionStatus(job);
    const progress = constructionProgress(job);
    const phase = job.phases[job.currentPhaseIndex];
    const worker = job.assignedSurvivorId ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId) : undefined;
    return (
      <div key={job.id} className="rounded-md px-2.5 py-2" style={raisedStyle}>
        <div className="flex items-start gap-2">
          <Hammer className="w-4 h-4 text-[#d7b85d] mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                if (building) {
                  setSelectedBuildingInstanceId(building.id);
                  setSelectedClusterId(building.clusterId || selectedClusterId);
                  setMode('structures');
                }
              }}
              className="text-left w-full"
            >
              <div className="text-[12px] text-[#e7dfcc] truncate">{def?.name || job.buildingId}</div>
              <div className="text-[10px] truncate" style={{ color: status.color }}>
                {status.label}{worker ? ` · ${worker.name}` : ''}{phase && job.materialsDelivered ? ` · ${phase.name}` : ''}
              </div>
            </button>
            {job.blockedReasons[0] && <div className="text-[9px] text-[#d0a45d] truncate mt-0.5">{job.blockedReasons[0]}</div>}
            <div className="h-1.5 rounded-full bg-black/35 mt-1.5 overflow-hidden">
              <div className="h-full bg-[#6ecad2]" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] text-[#789286]">{Math.round(progress)}%</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => runBuildingCommand(`__construction_pause__:${job.id}`)}
                  className="px-1.5 py-1 rounded border border-[#66796d]/45 text-[#b6c1ba] hover:bg-white/5"
                  title={job.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
                >
                  {job.status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => runBuildingCommand(`__construction_cancel__:${job.id}`)}
                  className="px-1.5 py-1 rounded border border-[#885c4c]/45 text-[#d89476] hover:bg-[#4a251d]/30"
                  title="Hủy công trình"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStructureWorkJob = (job: StructureWorkJob) => {
    const building = state.buildings.find(candidate => candidate.id === job.buildingInstanceId);
    const status = structureWorkStatus(job);
    const progress = job.totalSeconds > 0 ? clampPercent(job.progressSeconds / job.totalSeconds * 100) : 0;
    return (
      <div key={job.id} className="rounded-md px-2.5 py-2" style={raisedStyle}>
        <div className="flex items-start gap-2">
          <Wrench className="w-4 h-4 text-[#d7b85d] mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                if (building) {
                  setSelectedBuildingInstanceId(building.id);
                  setSelectedClusterId(building.clusterId || selectedClusterId);
                  setMode('structures');
                }
              }}
              className="text-left w-full"
            >
              <div className="text-[12px] text-[#e7dfcc] truncate">{structureWorkName(job)}</div>
              <div className="text-[10px] truncate" style={{ color: status.color }}>
                {status.label} · {building ? BUILDINGS_DATABASE[building.buildingId]?.name || building.buildingId : 'Công trình'}
              </div>
            </button>
            {job.blockedReasons[0] && <div className="text-[9px] text-[#d0a45d] truncate mt-0.5">{job.blockedReasons[0]}</div>}
            <div className="h-1.5 rounded-full bg-black/35 mt-1.5 overflow-hidden">
              <div className="h-full bg-[#93c66d]" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] text-[#789286]">{Math.round(progress)}%</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => runBuildingCommand(`__structure_work_pause__:${job.id}`)}
                  className="px-1.5 py-1 rounded border border-[#66796d]/45 text-[#b6c1ba] hover:bg-white/5"
                  title={job.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
                >
                  {job.status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => runBuildingCommand(`__structure_work_cancel__:${job.id}`)}
                  className="px-1.5 py-1 rounded border border-[#885c4c]/45 text-[#d89476] hover:bg-[#4a251d]/30"
                  title="Hủy công việc"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQueue = () => (
    <div className="space-y-2">
      {activePrepJobs.slice(0, 3).map(job => {
        const cluster = simulation?.clusters.find(item => item.id === job.clusterId);
        const progress = job.totalSeconds > 0 ? clampPercent(job.progressSeconds / job.totalSeconds * 100) : 0;
        return (
          <div key={job.id} className="rounded-md px-2.5 py-2" style={raisedStyle}>
            <div className="flex items-start gap-2">
              <Shovel className="w-4 h-4 text-[#d7b85d] mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-[#e7dfcc] truncate">{prepLabel(job.type)}</div>
                <div className="text-[10px] text-[#84a696] truncate">{cluster?.name || 'Cluster'} · {job.status === 'in_progress' ? 'Đang làm' : 'Chờ nhân lực'}</div>
                <div className="h-1.5 rounded-full bg-black/35 mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#9dcc69]" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <span className="text-[10px] text-[#d8c270]">{Math.round(progress)}%</span>
            </div>
          </div>
        );
      })}
      {activeConstructionJobs.map(renderConstructionJob)}
      {activeStructureWorkJobs.map(renderStructureWorkJob)}
      {queueCount === 0 && <div className="text-[11px] text-[#718f82] text-center py-4">Không có công việc xây dựng đang chờ.</div>}
    </div>
  );

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-2.5 text-[#e8e1cf]" style={{ fontFamily: UI_FONT }}>
      <style>{`
        .building-scroll { scrollbar-width: thin; scrollbar-color: rgba(127,151,110,.75) rgba(0,0,0,.18); }
        .building-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .building-scroll::-webkit-scrollbar-thumb { background: rgba(127,151,110,.72); border-radius: 999px; }
        .building-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,.16); }
      `}</style>

      <div className="shrink-0 rounded-lg px-3 py-2 flex items-center justify-between gap-3" style={panelStyle}>
        <div className="min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center border border-[#9a7b3d]/50 bg-[#162d25]">
            <Hammer className="w-6 h-6 text-[#ead7a0]" />
          </div>
          <div className="min-w-0">
            <div className="text-[18px] font-semibold tracking-wide text-[#f0e5c9]">QUẢN LÝ XÂY DỰNG</div>
            <div className="text-[11px] text-[#91aa9d]">Quy hoạch cluster, vận chuyển vật liệu, thi công theo phase và bảo trì từng bộ phận vật lý.</div>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-md bg-black/20 border border-[#526c5d]/35">
          <button
            type="button"
            onClick={() => setMode('clusters')}
            className={`px-4 py-2 rounded text-[12px] flex items-center gap-2 transition-all ${mode === 'clusters' ? 'bg-[#224c35] border border-[#d8b849]/65 text-[#ffe79a]' : 'text-[#9fb2a6] hover:bg-white/5'}`}
          >
            <Trees className="w-4 h-4" /> XÂY CLUSTER
          </button>
          <button
            type="button"
            onClick={() => setMode('structures')}
            className={`px-4 py-2 rounded text-[12px] flex items-center gap-2 transition-all ${mode === 'structures' ? 'bg-[#224c35] border border-[#d8b849]/65 text-[#ffe79a]' : 'text-[#9fb2a6] hover:bg-white/5'}`}
          >
            <Hammer className="w-4 h-4" /> CÔNG TRÌNH & BẢO TRÌ
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7f998c]">Ưu tiên thợ</span>
          <select
            value={assignedSurvivorId}
            onChange={event => setAssignedSurvivorId(event.target.value)}
            className="bg-[#082925] border border-[#516b5d]/55 rounded px-2.5 py-1.5 text-[11px] text-[#e8e1cf] outline-none"
          >
            {state.survivors.map(survivor => (
              <option key={survivor.id} value={survivor.id}>{survivor.name} · Build {Math.round(survivor.skills.building || 0)}</option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'clusters' ? (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_300px] gap-2.5">
          <div className="min-h-0 flex flex-col gap-2.5">
            <div className="rounded-lg p-3 shrink-0" style={panelStyle}>
              <div className="flex items-end justify-between mb-2.5">
                <div>
                  <div className="text-[12px] font-semibold tracking-wide text-[#e7dcc0]">CHỌN CLUSTER</div>
                  <div className="text-[10px] text-[#799487]">Chọn chức năng; solver tự tìm các vùng địa hình liền kề phù hợp trong POI.</div>
                </div>
                <div className="text-[10px] text-[#748f82]">Build Grid ẩn · deterministic theo world seed</div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {CLUSTER_ORDER.map(type => {
                  const def = CLUSTER_DEFINITIONS[type];
                  const Icon = clusterIcons[type];
                  const active = clusterType === type;
                  const count = clusters.filter(cluster => cluster.type === type).length;
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setClusterType(type)}
                      className="text-left rounded-md p-2.5 min-h-[94px] transition-all"
                      style={{
                        ...raisedStyle,
                        borderColor: active ? '#d9bb48' : 'rgba(126,153,107,.34)',
                        boxShadow: active ? 'inset 0 0 0 1px rgba(226,196,76,.24), 0 0 12px rgba(204,170,55,.14)' : raisedStyle.boxShadow,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] text-[#789184]">{count ? `${count} khu` : 'Chưa có'}</span>
                      </div>
                      <div className="text-[13px] font-semibold mt-1" style={{ color: active ? '#f7e39a' : '#ddd6c4' }}>{def.name}</div>
                      <div className="text-[9px] uppercase tracking-wide text-[#6fa297]">{def.subtitle}</div>
                      <div className="text-[10px] text-[#89a094] mt-1 line-clamp-2">{def.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-[0.92fr_1.08fr] gap-2.5">
              <div className="rounded-lg p-3 min-h-0 overflow-auto building-scroll" style={panelStyle}>
                {(() => {
                  const def = CLUSTER_DEFINITIONS[clusterType];
                  const Icon = clusterIcons[clusterType];
                  return (
                    <>
                      <div className="flex items-start gap-3 pb-3 border-b border-[#58705f]/30">
                        <div className="w-14 h-14 rounded-md flex items-center justify-center" style={{ ...raisedStyle, color: clusterAccent[clusterType] }}>
                          <Icon className="w-8 h-8" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[18px] font-semibold text-[#f0e4c7]">{def.name}</div>
                          <div className="text-[10px] uppercase tracking-[.14em] text-[#73a69c]">{def.subtitle}</div>
                          <p className="text-[11px] text-[#a8b7ae] mt-2 leading-relaxed">{def.description}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <div className="text-[10px] uppercase text-[#738e81] mb-1.5">Điều kiện ưu tiên</div>
                          <div className="space-y-1.5">{def.preferred.map(text => <div key={text} className="text-[11px] flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#7edd6b]" />{text}</div>)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[#738e81] mb-1.5">Nên tránh</div>
                          <div className="space-y-1.5">{def.avoid.map(text => <div key={text} className="text-[11px] flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-[#e9bb54]" />{text}</div>)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="rounded-md p-2 text-center" style={raisedStyle}><div className="text-[9px] text-[#759085]">Tối thiểu</div><div className="text-[14px] text-[#e8d68f]">{def.minAreaM2} m²</div></div>
                        <div className="rounded-md p-2 text-center" style={raisedStyle}><div className="text-[9px] text-[#759085]">Khuyến nghị</div><div className="text-[14px] text-[#e8d68f]">{def.preferredAreaM2} m²</div></div>
                        <div className="rounded-md p-2 text-center" style={raisedStyle}><div className="text-[9px] text-[#759085]">Tối đa</div><div className="text-[14px] text-[#e8d68f]">{def.maxAreaM2} m²</div></div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="rounded-lg p-3 min-h-0 flex flex-col" style={panelStyle}>
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <div><div className="text-[12px] font-semibold text-[#e7dcc0]">VỊ TRÍ KHẢ DỤNG</div><div className="text-[10px] text-[#789286]">Solver đã gom các ô liền kề thành lựa chọn dễ hiểu.</div></div>
                  <MapPin className="w-5 h-5 text-[#d9bc61]" />
                </div>
                <div className="mt-2.5 space-y-2 overflow-auto building-scroll pr-1 flex-1 min-h-0">
                  {candidates.map((candidate, index) => {
                    const meta = ratingMeta(candidate.rating);
                    const RatingIcon = meta.icon;
                    const selected = candidate.id === selectedSite?.id;
                    return (
                      <button
                        type="button"
                        key={candidate.id}
                        onClick={() => setSelectedSiteId(candidate.id)}
                        className="w-full rounded-md p-2.5 text-left transition-all"
                        style={{ ...raisedStyle, borderColor: selected ? '#d8b94f' : 'rgba(126,153,107,.34)', opacity: candidate.rating === 'unsuitable' ? 0.66 : 1 }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="w-8 h-8 rounded flex items-center justify-center text-[13px] font-semibold bg-black/20 border border-[#596f60]/45">{String.fromCharCode(65 + index)}</div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2"><span className="text-[12px] font-semibold">Khu {String.fromCharCode(65 + index)}</span><span className="text-[10px]" style={{ color: meta.color }}><RatingIcon className="w-3 h-3 inline mr-1" />{meta.label}</span></div>
                              <div className="text-[10px] text-[#789589] mt-0.5">{candidate.usableAreaM2} m² khả dụng · điểm nền {Math.round(candidate.score)}/100</div>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#738d81] shrink-0" />
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {candidate.advantages.slice(0, 3).map(text => <span key={text} className="px-1.5 py-0.5 rounded bg-[#173b2c] text-[#9ed08b] text-[9px]">+ {text}</span>)}
                          {candidate.warnings.slice(0, 2).map(text => <span key={text} className="px-1.5 py-0.5 rounded bg-[#3b2d18] text-[#e2bb69] text-[9px]">! {text}</span>)}
                        </div>
                      </button>
                    );
                  })}
                  {candidates.length === 0 && <div className="text-[11px] text-[#718f82] text-center py-10">Không còn đủ diện tích liền kề để tạo cluster loại này.</div>}
                </div>

                {selectedSite && (
                  <div className="mt-2.5 pt-2.5 border-t border-[#58705f]/30 shrink-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-[10px] text-[#8ca398]">{selectedSite.preparation.length ? `Chuẩn bị: ${selectedSite.preparation.map(task => prepLabel(task.type)).join(' · ')}` : 'Không cần chuẩn bị mặt bằng đáng kể.'}</div>
                      <div className="text-[10px] text-[#7e988c]">~{selectedSite.preparation.reduce((sum, task) => sum + task.estimatedSeconds, 0)}s prep</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleEstablishCluster}
                      disabled={selectedSite.rating === 'unsuitable'}
                      className="w-full rounded-md py-2.5 text-[12px] font-semibold flex items-center justify-center gap-2 border transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(180deg,#315f2d,#174428)', borderColor: '#cbb547', color: '#fff0b1' }}
                    >
                      <Hammer className="w-4 h-4" /> THIẾT LẬP {CLUSTER_DEFINITIONS[clusterType].name.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="min-h-0 flex flex-col gap-2.5">
            <div className="rounded-lg p-3 shrink-0" style={panelStyle}>
              <div className="text-[12px] font-semibold text-[#e7dcc0] mb-2.5">THÔNG TIN TRẠI</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md p-2" style={raisedStyle}><div className="text-[9px] text-[#789184]">Clusters</div><div className="text-[16px] text-[#e4cf72]">{clusters.length}</div></div>
                <div className="rounded-md p-2" style={raisedStyle}><div className="text-[9px] text-[#789184]">Công trình</div><div className="text-[16px] text-[#e4cf72]">{totalBuilt}</div></div>
                <div className="rounded-md p-2" style={raisedStyle}><div className="text-[9px] text-[#789184]">Thợ rảnh</div><div className="text-[16px] text-[#e4cf72]">{idleBuilders}</div></div>
                <div className="rounded-md p-2" style={raisedStyle}><div className="text-[9px] text-[#789184]">Đang thi công</div><div className="text-[16px] text-[#e4cf72]">{totalUnderConstruction}</div></div>
              </div>
            </div>
            <div className="rounded-lg p-3 flex-1 min-h-0 overflow-auto building-scroll" style={panelStyle}>
              <div className="flex items-center justify-between mb-2.5"><div className="text-[12px] font-semibold text-[#e7dcc0]">HÀNG ĐỢI CÔNG VIỆC</div><span className="text-[10px] text-[#d7bd67]">{queueCount}</span></div>
              {renderQueue()}
            </div>
            <div className="rounded-lg p-3 shrink-0" style={panelStyle}>
              <div className="text-[11px] font-semibold text-[#e7dcc0] mb-1.5">NGUYÊN TẮC BỐ TRÍ</div>
              <p className="text-[10px] leading-relaxed text-[#80988d]">Grid, footprint, nền đất và micro-prep được solver xử lý. Người chơi quyết định chức năng, site, ưu tiên lao động và cách bảo trì.</p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_360px] gap-2.5">
          <div className="min-h-0 flex flex-col gap-2.5">
            <div className="rounded-lg px-3 py-2.5 shrink-0 flex items-center gap-3" style={panelStyle}>
              <div className="text-[11px] text-[#82998e]">Khu vực cắm trại</div>
              <ChevronRight className="w-4 h-4 text-[#5e776a]" />
              <select
                value={selectedCluster?.id || ''}
                onChange={event => {
                  setSelectedClusterId(event.target.value);
                  setSelectedBuildingInstanceId(null);
                }}
                className="flex-1 bg-[#082925] border border-[#526c5d]/55 rounded px-3 py-2 text-[12px] outline-none"
              >
                {clusters.map(cluster => <option key={cluster.id} value={cluster.id}>{cluster.name} · {cluster.state}</option>)}
                {!clusters.length && <option value="">Chưa có cluster</option>}
              </select>
              <button type="button" onClick={() => setMode('clusters')} className="px-3 py-2 rounded border border-[#66806f]/45 text-[11px] text-[#b5c1b9] hover:bg-white/5"><MapPin className="w-4 h-4 inline mr-1.5" />Quy hoạch cluster</button>
            </div>

            {!selectedCluster ? (
              <div className="flex-1 rounded-lg flex items-center justify-center" style={panelStyle}>
                <div className="text-center max-w-sm"><Trees className="w-10 h-10 mx-auto text-[#708d7d] mb-3" /><div className="text-[15px] text-[#dcd4bf]">Chưa có cluster</div><p className="text-[11px] text-[#789085] mt-1">Hãy tạo một cluster trước; công trình mới sẽ được solver bố trí bên trong khu chức năng đó.</p></div>
              </div>
            ) : (
              <>
                <div className="rounded-lg p-3 flex-1 min-h-0 overflow-auto building-scroll" style={panelStyle}>
                  <div className="flex items-center justify-between border-b border-[#58705f]/30 pb-2 mb-2">
                    <div><div className="text-[13px] font-semibold text-[#e7dcc0]">CÔNG TRÌNH TRONG CLUSTER</div><div className="text-[10px] text-[#779084]">{selectedCluster.name} · {selectedCluster.state === 'active' ? 'Đang hoạt động' : 'Đang chuẩn bị mặt bằng'}</div></div>
                    <div className="text-[10px] text-[#8ba095]">{clusterStructures.filter(building => building.isBuilt).length} hoàn thành / {clusterStructures.length} tổng</div>
                  </div>

                  <div className="space-y-1.5">
                    {clusterStructures.map(building => {
                      const def = BUILDINGS_DATABASE[building.buildingId];
                      const Icon = structureIcon(def?.category || 'infrastructure');
                      const selected = selectedBuildingInstanceId === building.id;
                      const job = building.constructionJobId ? constructionJobs.find(candidate => candidate.id === building.constructionJobId) : undefined;
                      const status = building.isBuilt ? { label: '● Hoạt động', color: '#79d86c' } : job ? constructionStatus(job) : { label: '○ Legacy', color: '#e5bb5b' };
                      return (
                        <button
                          type="button"
                          key={building.id}
                          onClick={() => setSelectedBuildingInstanceId(building.id)}
                          className="w-full grid grid-cols-[44px_minmax(0,1.35fr)_120px_95px_90px] items-center gap-2 rounded-md px-2 py-2 text-left"
                          style={{ ...raisedStyle, borderColor: selected ? '#d2b84f' : 'rgba(126,153,107,.34)' }}
                        >
                          <div className="w-10 h-10 rounded flex items-center justify-center bg-black/20 border border-[#5b7364]/45"><Icon className="w-5 h-5 text-[#d8c48b]" /></div>
                          <div className="min-w-0"><div className="text-[12px] text-[#e9e1cf] truncate">{def?.name || building.buildingId}</div><div className="text-[9px] text-[#708b7e] truncate">{building.footprintAreaM2 ? `${building.footprintAreaM2} m²` : 'Legacy structure'}</div></div>
                          <div className="text-[10px] truncate" style={{ color: status.color }}>{status.label}</div>
                          <div className="text-[10px] text-[#bac2b7]">Độ bền {Math.round(building.condition)}%</div>
                          <div className="text-[10px] text-[#8ca397]">{building.placementScore ? `Site ${Math.round(building.placementScore)}` : 'Legacy'}</div>
                        </button>
                      );
                    })}
                    {!clusterStructures.length && <div className="text-[11px] text-[#718f82] text-center py-7">Cluster chưa có công trình. Chọn từ thư viện bên dưới.</div>}
                  </div>

                  {legacyStructures.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#58705f]/30">
                      <div className="text-[10px] text-[#ba9d59] mb-1.5">CÔNG TRÌNH LEGACY / CHƯA PHÂN CỤM ({legacyStructures.length})</div>
                      <div className="text-[9px] text-[#70887c]">Được giữ nguyên để tương thích save cũ; công trình mới dùng spatial cluster system.</div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg p-3 shrink-0" style={panelStyle}>
                  <div className="flex items-center justify-between mb-2"><div><div className="text-[12px] font-semibold">THƯ VIỆN CÔNG TRÌNH</div><div className="text-[9px] text-[#748e82]">Có thể lên kế hoạch cả khi thiếu vật liệu hoặc thợ đang bận.</div></div><span className="text-[10px] text-[#7f998c]">{structureLibrary.length} mẫu</span></div>
                  <div className="grid grid-cols-5 gap-2">
                    {structureLibrary.map(({ definition, placement }) => {
                      if (!definition) return null;
                      const Icon = structureIcon(definition.category);
                      const status = placementLabel(placement.status);
                      const affordable = definition.cost.every(cost => totalStock(cost.itemId) >= cost.quantity);
                      const canPlan = ['available', 'preparation_required'].includes(placement.status) && Boolean(assignedSurvivorId);
                      return (
                        <div key={definition.id} className="rounded-md p-2 flex flex-col min-h-[142px]" style={raisedStyle}>
                          <div className="flex items-start justify-between"><div className="w-8 h-8 rounded flex items-center justify-center bg-black/20 border border-[#5b7364]/45"><Icon className="w-4 h-4 text-[#d8c48b]" /></div><span className="text-[9px]" style={{ color: status.color }}>{status.label}</span></div>
                          <div className="text-[11px] font-semibold mt-1.5 text-[#e7decb] leading-tight">{definition.name}</div>
                          <div className="text-[9px] text-[#789084] mt-1">{placement.footprintAreaM2} m² · {definition.buildTimeSeconds}s</div>
                          <div className={`text-[9px] mt-1 ${affordable ? 'text-[#78c973]' : 'text-[#d3a75c]'}`}>{affordable ? 'Đủ vật liệu hiện tại' : 'Thiếu vật liệu · sẽ chờ kho'}</div>
                          <div className="mt-auto pt-2">
                            <button
                              type="button"
                              disabled={!canPlan}
                              onClick={() => handleBuildStructure(selectedCluster, definition.id)}
                              className="w-full rounded py-1.5 text-[10px] border disabled:opacity-35 disabled:cursor-not-allowed"
                              style={{ background: canPlan ? '#1b4a2c' : '#173028', borderColor: canPlan ? '#c6b04d' : '#52685b', color: canPlan ? '#f2df91' : '#81988c' }}
                            >
                              <Plus className="w-3 h-3 inline mr-1" />Lên kế hoạch
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!structureLibrary.length && <div className="col-span-5 text-[10px] text-[#718f82] py-4 text-center">Chưa có công trình nào phù hợp với loại cluster này trong database hiện tại.</div>}
                  </div>
                </div>
              </>
            )}
          </div>

          <aside className="min-h-0 flex flex-col gap-2.5">
            <div className="rounded-lg p-3 flex-1 min-h-0 overflow-auto building-scroll" style={panelStyle}>
              {selectedStructure ? (() => {
                const def = BUILDINGS_DATABASE[selectedStructure.buildingId];
                const Icon = structureIcon(def?.category || 'infrastructure');
                const constructionJob = selectedStructure.constructionJobId
                  ? constructionJobs.find(job => job.id === selectedStructure.constructionJobId)
                  : undefined;
                const activeWork = activeStructureWorkJobs.filter(job => job.buildingInstanceId === selectedStructure.id);
                const workBusy = activeWork.length > 0;
                const performance = selectedStructure.structurePerformance || deriveStructurePerformance(state, selectedStructure);
                const availableMods = def
                  ? getAvailableStructureModifications(selectedStructure.buildingId, def.category)
                  : [];
                const appliedModIds = new Set((selectedStructure.structureModifications || []).map(record => record.modificationId));

                return (
                  <>
                    <div className="flex items-start gap-3 pb-3 border-b border-[#58705f]/30">
                      <div className="w-16 h-16 rounded-md flex items-center justify-center" style={raisedStyle}><Icon className="w-8 h-8 text-[#d8c48b]" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[17px] font-semibold">{def?.name || selectedStructure.buildingId}</div>
                        <div className="text-[10px] text-[#7aa096]">{selectedStructure.isBuilt ? 'Hoạt động' : constructionJob ? constructionStatus(constructionJob).label : 'Đang thi công'}</div>
                        <div className="text-[10px] text-[#7d9489] mt-1">Footprint {selectedStructure.footprintAreaM2 || '—'} m² · Site {selectedStructure.placementScore ? Math.round(selectedStructure.placementScore) : '—'}</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#9dac9f] leading-relaxed mt-3">{def?.description}</p>

                    {!selectedStructure.isBuilt && constructionJob ? (
                      <div className="mt-3 space-y-2">
                        <div className="rounded-md p-2.5" style={raisedStyle}>
                          <div className="flex items-center justify-between"><span className="text-[10px] text-[#81998d]">Trạng thái</span><span className="text-[10px]" style={{ color: constructionStatus(constructionJob).color }}>{constructionStatus(constructionJob).label}</span></div>
                          <div className="flex items-center justify-between mt-1.5"><span className="text-[10px] text-[#81998d]">Vận chuyển</span><span className="text-[10px]">{constructionJob.materialsDelivered ? 'Đã staging' : `${Math.round(constructionJob.haulProgressSeconds)}/${Math.round(constructionJob.haulTotalSeconds)}s`}</span></div>
                          {constructionJob.blockedReasons[0] && <div className="text-[9px] text-[#d1a85f] mt-1.5">{constructionJob.blockedReasons.join(' · ')}</div>}
                        </div>
                        <div className="space-y-1">
                          {constructionJob.phases.map((phase, index) => (
                            <div key={phase.id} className="rounded px-2 py-1.5 border border-[#52685b]/30 bg-black/10">
                              <div className="flex justify-between text-[9px]"><span className={index === constructionJob.currentPhaseIndex ? 'text-[#e5cf77]' : 'text-[#93a69c]'}>{index + 1}. {phase.name}</span><span>{phase.status === 'completed' ? '✓' : `${Math.round(phase.progressSeconds)}/${Math.round(phase.totalSeconds)}s`}</span></div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button type="button" onClick={() => runBuildingCommand(`__construction_pause__:${constructionJob.id}`)} className="rounded py-2 text-[10px] border border-[#6a7b70]/45 hover:bg-white/5">{constructionJob.status === 'paused' ? <Play className="w-3 h-3 inline mr-1" /> : <Pause className="w-3 h-3 inline mr-1" />}{constructionJob.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}</button>
                          <button type="button" onClick={() => runBuildingCommand(`__construction_cancel__:${constructionJob.id}`)} className="rounded py-2 text-[10px] border border-[#875747]/55 text-[#df9878] hover:bg-[#4a251d]/25"><Trash2 className="w-3 h-3 inline mr-1" />Hủy công trình</button>
                        </div>
                      </div>
                    ) : selectedStructure.isBuilt ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {[
                            ['Kết cấu', performance.structuralIntegrity],
                            ['Che thời tiết', performance.weatherProtection],
                            ['An toàn cháy', performance.fireSafety],
                            ['Chức năng', performance.functionality],
                          ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-md p-2" style={raisedStyle}>
                              <div className="flex justify-between text-[9px]"><span className="text-[#81998d]">{label}</span><span>{Math.round(Number(value))}%</span></div>
                              <div className="h-1.5 rounded bg-black/35 overflow-hidden mt-1"><div className="h-full bg-[#8dcc6d]" style={{ width: `${clampPercent(Number(value))}%` }} /></div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-1.5"><div className="text-[10px] font-semibold text-[#d8c169]">BỘ PHẬN VẬT LÝ</div><span className="text-[9px] text-[#789286]">{selectedStructure.structureComponents?.length || 0} components</span></div>
                          <div className="space-y-2">
                            {(selectedStructure.structureComponents || []).map(component => {
                              const ratio = component.conditionMax > 0 ? clampPercent(component.condition / component.conditionMax * 100) : 0;
                              const componentBusy = workBusy;
                              const repairable = component.condition < component.conditionMax - 0.01;
                              const replaceUseful = component.permanentDamage > 0 || component.rot > 30 || ratio < 50;
                              return (
                                <div key={component.id} className="rounded-md p-2.5" style={raisedStyle}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div><div className="text-[11px] text-[#e7dfcc]">{componentLabel(component.kind)}</div><div className="text-[9px] text-[#789286]">Workmanship {Math.round(component.workmanship)} · trần {Math.round(component.conditionMax)}/{Math.round(component.originalConditionMax)}</div></div>
                                    <span className="text-[10px] text-[#d8c270]">{Math.round(ratio)}%</span>
                                  </div>
                                  <div className="h-1.5 rounded bg-black/35 overflow-hidden mt-1.5"><div className="h-full bg-[#7fc770]" style={{ width: `${ratio}%` }} /></div>
                                  <div className="grid grid-cols-3 gap-1.5 mt-2 text-[9px]">
                                    <div className="rounded bg-black/15 px-1.5 py-1"><span className="text-[#718c80]">Ẩm </span>{Math.round(component.moisture)}%</div>
                                    <div className="rounded bg-black/15 px-1.5 py-1"><span className="text-[#718c80]">Mục </span>{Math.round(component.rot)}%</div>
                                    <div className="rounded bg-black/15 px-1.5 py-1"><span className="text-[#718c80]">Hư vĩnh viễn </span>{Math.round(component.permanentDamage)}</div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                                    <button disabled={componentBusy || !repairable} onClick={() => runBuildingCommand(`__structure_maintenance__:patch:${selectedStructure.id}:${component.id}`)} type="button" className="rounded py-1.5 text-[9px] border border-[#7d7044]/50 text-[#d8bd73] disabled:opacity-30 disabled:cursor-not-allowed">Vá nhanh</button>
                                    <button disabled={componentBusy || !repairable} onClick={() => runBuildingCommand(`__structure_maintenance__:repair:${selectedStructure.id}:${component.id}`)} type="button" className="rounded py-1.5 text-[9px] border border-[#587b61]/55 text-[#9fca9b] disabled:opacity-30 disabled:cursor-not-allowed">Sửa chữa</button>
                                    <button disabled={componentBusy || !replaceUseful} onClick={() => runBuildingCommand(`__structure_maintenance__:replace:${selectedStructure.id}:${component.id}`)} type="button" className="rounded py-1.5 text-[9px] border border-[#755e4c]/55 text-[#d4a681] disabled:opacity-30 disabled:cursor-not-allowed">Thay thế</button>
                                  </div>
                                </div>
                              );
                            })}
                            {!selectedStructure.structureComponents?.length && <div className="text-[9px] text-[#718f82] py-3 text-center">Công trình legacy chưa có component graph; lifecycle chỉ áp dụng cho construction mới.</div>}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#58705f]/30">
                          <div className="flex items-center justify-between mb-1.5"><div className="text-[10px] font-semibold text-[#d8c169]">CẢI TẠO VẬT LÝ</div><span className="text-[9px] text-[#789286]">Không dùng Upgrade Lv.</span></div>
                          <div className="space-y-2">
                            {availableMods.map(modification => {
                              const applied = appliedModIds.has(modification.id);
                              const affordable = modification.cost.every(cost => totalStock(cost.itemId) >= cost.quantity);
                              return (
                                <div key={modification.id} className="rounded-md p-2" style={raisedStyle}>
                                  <div className="flex items-start justify-between gap-2"><div><div className="text-[10px] text-[#e4ddca]">{modification.name}</div><div className="text-[9px] text-[#7f978b] mt-0.5 leading-relaxed">{modification.description}</div></div><span className={`text-[9px] shrink-0 ${applied ? 'text-[#77ce70]' : affordable ? 'text-[#a9ca87]' : 'text-[#d0a45d]'}`}>{applied ? 'Đã lắp' : affordable ? 'Đủ vật liệu' : 'Chờ vật liệu'}</span></div>
                                  <div className="text-[9px] text-[#8c9d94] mt-1.5">{modification.cost.map(cost => `${ITEMS_DATABASE[cost.itemId]?.name || cost.itemId} ${totalStock(cost.itemId)}/${cost.quantity}`).join(' · ')}</div>
                                  <button disabled={applied || workBusy} onClick={() => runBuildingCommand(`__structure_modify__:${selectedStructure.id}:${modification.id}`)} type="button" className="w-full mt-2 rounded py-1.5 text-[9px] border border-[#7b7547]/55 text-[#daca80] disabled:opacity-30 disabled:cursor-not-allowed"><Hammer className="w-3 h-3 inline mr-1" />{applied ? 'Đã hoàn thành' : 'Lên kế hoạch cải tạo'}</button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {activeWork.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-[#58705f]/30">
                            <div className="text-[10px] font-semibold text-[#d8c169] mb-1.5">CÔNG VIỆC ĐANG CHẠY</div>
                            {activeWork.map(renderStructureWorkJob)}
                          </div>
                        )}
                      </>
                    ) : null}
                  </>
                );
              })() : selectedCluster ? (
                <>
                  <div className="flex items-start gap-3 pb-3 border-b border-[#58705f]/30">
                    {React.createElement(clusterIcons[selectedCluster.type], { className: 'w-7 h-7 text-[#d8c48b]' })}
                    <div><div className="text-[17px] font-semibold">{selectedCluster.name}</div><div className="text-[10px] uppercase tracking-wide text-[#72a095]">{CLUSTER_DEFINITIONS[selectedCluster.type].subtitle}</div></div>
                  </div>
                  <p className="text-[11px] text-[#9dac9f] mt-3 leading-relaxed">{CLUSTER_DEFINITIONS[selectedCluster.type].description}</p>
                  <div className="mt-3 rounded-md p-2.5" style={raisedStyle}>
                    <div className="flex justify-between text-[10px]"><span className="text-[#80988c]">Trạng thái</span><span className={selectedCluster.state === 'active' ? 'text-[#78db6d]' : 'text-[#e5bb5b]'}>{selectedCluster.state}</span></div>
                    <div className="flex justify-between text-[10px] mt-1.5"><span className="text-[#80988c]">Điểm địa hình</span><span>{Math.round(selectedCluster.siteScore)}/100</span></div>
                    <div className="flex justify-between text-[10px] mt-1.5"><span className="text-[#80988c]">Diện tích khả dụng</span><span>{selectedCluster.usableAreaM2} m²</span></div>
                  </div>
                  {selectedCluster.state === 'preparing' && (
                    <div className="mt-3">
                      <div className="text-[10px] font-semibold text-[#d4b85d] mb-1.5">CHUẨN BỊ MẶT BẰNG</div>
                      {prepJobs.filter(job => job.clusterId === selectedCluster.id && job.status !== 'completed').map(job => (
                        <div key={job.id} className="flex items-center justify-between text-[10px] py-1 border-b border-[#52685b]/20"><span>{prepLabel(job.type)}</span><span className="text-[#81998d]">{job.status === 'in_progress' ? 'Đang làm' : 'Chờ thợ'}</span></div>
                      ))}
                    </div>
                  )}
                </>
              ) : <div className="text-[11px] text-[#718f82] text-center py-8">Chọn một cluster để xem thông tin.</div>}
            </div>

            <div className="rounded-lg p-3 max-h-[255px] overflow-auto building-scroll shrink-0" style={panelStyle}>
              <div className="flex items-center justify-between mb-2.5"><div className="text-[12px] font-semibold text-[#e7dcc0]">HÀNG ĐỢI CÔNG VIỆC</div><span className="text-[10px] text-[#d7bd67]">{queueCount}</span></div>
              {renderQueue()}
            </div>

            {selectedClusterStats && (
              <div className="rounded-lg p-3 shrink-0" style={panelStyle}>
                <div className="text-[12px] font-semibold mb-2.5">THỐNG KÊ CLUSTER</div>
                <div className="space-y-2 text-[10px]">
                  {[
                    ['Diện tích trống', `${Math.round(selectedClusterStats.freeAreaM2)} m²`, selectedClusterStats.usableAreaM2 ? (selectedClusterStats.freeAreaM2 / selectedClusterStats.usableAreaM2) * 100 : 0],
                    ['Độ bền công trình', `${selectedClusterStats.averageCondition}%`, selectedClusterStats.averageCondition],
                    ['An toàn cháy', `${selectedClusterStats.fireSafety}%`, selectedClusterStats.fireSafety],
                    ['Thoát nước', `${selectedClusterStats.drainage}%`, selectedClusterStats.drainage],
                    ['Tiếp cận', `${selectedClusterStats.accessibility}%`, selectedClusterStats.accessibility],
                  ].map(([label, value, pct]) => (
                    <div key={String(label)}>
                      <div className="flex justify-between"><span className="text-[#81998d]">{label}</span><span>{value}</span></div>
                      <div className="h-1.5 mt-1 rounded bg-black/35 overflow-hidden"><div className="h-full bg-[#8dcf69]" style={{ width: `${clampPercent(Number(pct))}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
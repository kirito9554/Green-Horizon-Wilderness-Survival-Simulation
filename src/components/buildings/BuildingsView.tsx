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
  PawPrint,
  Plus,
  Shield,
  Shovel,
  Trees,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { GameState } from '../../types';
import type { CampCluster, ClusterSiteCandidate, ClusterType, SiteRating } from '../../types/buildingSimulation';
import '../../types/buildingSimulation';
import { BUILDINGS_DATABASE } from '../../data/buildings';
import { CLUSTER_DEFINITIONS } from '../../data/buildingSpatial';
import { ITEMS_DATABASE } from '../../data/items';
import {
  compatibleBuildingsForCluster,
  deriveClusterStats,
  findStructurePlacement,
  getClusterSiteCandidates,
} from '../../simulation/buildingClusterSystem';
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

function ratingMeta(rating: SiteRating) {
  if (rating === 'excellent') return { label: 'Rất phù hợp', color: '#7ee36a', icon: Check };
  if (rating === 'suitable') return { label: 'Phù hợp', color: '#a9d96f', icon: Check };
  if (rating === 'preparation_required') return { label: 'Cần chuẩn bị', color: '#f3c85b', icon: AlertTriangle };
  return { label: 'Không phù hợp', color: '#ef6d5d', icon: X };
}

function placementLabel(status: ReturnType<typeof findStructurePlacement>['status']) {
  if (status === 'available') return { label: 'Sẵn sàng', color: '#7ee36a' };
  if (status === 'preparation_required') return { label: 'Chuẩn bị nhẹ', color: '#f3c85b' };
  if (status === 'cluster_not_ready') return { label: 'Đang chuẩn bị cluster', color: '#f3c85b' };
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

export const BuildingsView: React.FC<BuildingsViewProps> = ({ state, onStartConstruction }) => {
  const simulation = state.buildingSimulation;
  const clusters = simulation?.clusters.filter(cluster => cluster.poiId === CAMP_POI_ID) || [];
  const prepJobs = simulation?.preparationJobs || [];

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
  const selectedWorkerIdle = selectedWorker?.currentAction.type === 'idle';
  const totalBuilt = state.buildings.filter(building => building.isBuilt).length;
  const totalUnderConstruction = state.buildings.filter(building => !building.isBuilt).length;
  const activePrepJobs = prepJobs.filter(job => job.status !== 'completed');
  const idleBuilders = state.survivors.filter(survivor => survivor.currentAction.type === 'idle' && survivor.jobPriorities.build !== 'disabled').length;

  const totalStock = (itemId: string) => {
    const poi = state.poiStorages?.[CAMP_POI_ID];
    return getAvailableInventoryStock(state.inventory, itemId) + (poi ? getAvailableInventoryStock(poi, itemId) : 0);
  };

  const handleEstablishCluster = () => {
    if (!selectedSite || selectedSite.rating === 'unsuitable') return;
    onStartConstruction(
      assignedSurvivorId,
      `__cluster_establish__:${CAMP_POI_ID}:${clusterType}:${selectedSite.id}`,
    );
  };

  const handleBuildStructure = (cluster: CampCluster, buildingId: string) => {
    onStartConstruction(assignedSurvivorId, `__cluster_build__:${cluster.id}:${buildingId}`);
  };

  const renderQueue = () => {
    const construction = state.buildings.filter(building => !building.isBuilt);
    return (
      <div className="space-y-2">
        {activePrepJobs.slice(0, 3).map(job => {
          const cluster = simulation?.clusters.find(item => item.id === job.clusterId);
          const progress = job.totalSeconds > 0 ? Math.min(100, Math.round((job.progressSeconds / job.totalSeconds) * 100)) : 0;
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
                <span className="text-[10px] text-[#d8c270]">{progress}%</span>
              </div>
            </div>
          );
        })}
        {construction.slice(0, 3).map(building => {
          const def = BUILDINGS_DATABASE[building.buildingId];
          const worker = state.survivors.find(survivor => survivor.currentAction.type === 'building' && survivor.currentAction.targetId === building.id);
          const progress = worker
            ? Math.min(100, Math.round((worker.currentAction.progressSeconds / Math.max(1, worker.currentAction.totalSeconds)) * 100))
            : Math.min(100, Math.round((building.buildProgressSeconds / Math.max(1, building.totalBuildSeconds)) * 100));
          return (
            <div key={building.id} className="rounded-md px-2.5 py-2" style={raisedStyle}>
              <div className="flex items-center gap-2">
                <Hammer className="w-4 h-4 text-[#d7b85d] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[#e7dfcc] truncate">{def?.name || building.buildingId}</div>
                  <div className="text-[10px] text-[#84a696]">{worker ? worker.name : 'Đang chờ thợ'}</div>
                  <div className="h-1.5 rounded-full bg-black/35 mt-1.5 overflow-hidden">
                    <div className="h-full bg-[#6ecad2]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-[#d8c270]">{progress}%</span>
              </div>
            </div>
          );
        })}
        {activePrepJobs.length === 0 && construction.length === 0 && (
          <div className="text-[11px] text-[#718f82] text-center py-4">Không có công việc xây dựng đang chờ.</div>
        )}
      </div>
    );
  };

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
            <div className="text-[11px] text-[#91aa9d]">Quy hoạch cluster, chuẩn bị mặt bằng và bố trí công trình theo điều kiện địa hình.</div>
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
            <Hammer className="w-4 h-4" /> XÂY DỰNG & BỐ TRÍ
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7f998c]">Thợ phụ trách</span>
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
                  <div className="text-[10px] text-[#799487]">Chọn chức năng; hệ thống sẽ tự tìm các nhóm ô địa hình phù hợp trong POI.</div>
                </div>
                <div className="text-[10px] text-[#748f82]">Grid địa hình được xử lý ẩn · không cần bố trí thủ công</div>
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
                          <div className="space-y-1.5">
                            {def.preferred.map(text => <div key={text} className="text-[11px] flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#7edd6b]" />{text}</div>)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[#738e81] mb-1.5">Nên tránh</div>
                          <div className="space-y-1.5">
                            {def.avoid.map(text => <div key={text} className="text-[11px] flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-[#e9bb54]" />{text}</div>)}
                          </div>
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
                  <div>
                    <div className="text-[12px] font-semibold text-[#e7dcc0]">VỊ TRÍ KHẢ DỤNG</div>
                    <div className="text-[10px] text-[#789286]">Solver đã gom các ô liền kề thành lựa chọn dễ hiểu.</div>
                  </div>
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
                        style={{
                          ...raisedStyle,
                          borderColor: selected ? '#d8b94f' : 'rgba(126,153,107,.34)',
                          opacity: candidate.rating === 'unsuitable' ? 0.66 : 1,
                        }}
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
                      <div className="text-[10px] text-[#8ca398]">
                        {selectedSite.preparation.length
                          ? `Chuẩn bị: ${selectedSite.preparation.map(task => prepLabel(task.type)).join(' · ')}`
                          : 'Không cần chuẩn bị mặt bằng đáng kể.'}
                      </div>
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
              <div className="flex items-center justify-between mb-2.5"><div className="text-[12px] font-semibold text-[#e7dcc0]">HÀNG ĐỢI XÂY DỰNG</div><span className="text-[10px] text-[#d7bd67]">{activePrepJobs.length + totalUnderConstruction}</span></div>
              {renderQueue()}
            </div>

            <div className="rounded-lg p-3 shrink-0" style={panelStyle}>
              <div className="text-[11px] font-semibold text-[#e7dcc0] mb-1.5">NGUYÊN TẮC BỐ TRÍ</div>
              <p className="text-[10px] leading-relaxed text-[#80988d]">Game tự xử lý grid, footprint và địa hình. Người chơi chỉ chọn cluster/site; vị trí cụ thể được solver ưu tiên theo độ phù hợp và khả năng mở rộng.</p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_310px] gap-2.5">
          <div className="min-h-0 flex flex-col gap-2.5">
            <div className="rounded-lg px-3 py-2.5 shrink-0 flex items-center gap-3" style={panelStyle}>
              <div className="text-[11px] text-[#82998e]">Khu vực cắm trại</div>
              <ChevronRight className="w-4 h-4 text-[#5e776a]" />
              <select
                value={selectedCluster?.id || ''}
                onChange={event => setSelectedClusterId(event.target.value)}
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
                      const worker = state.survivors.find(survivor => survivor.currentAction.type === 'building' && survivor.currentAction.targetId === building.id);
                      return (
                        <button
                          type="button"
                          key={building.id}
                          onClick={() => setSelectedBuildingInstanceId(building.id)}
                          className="w-full grid grid-cols-[44px_minmax(0,1.4fr)_110px_90px_90px] items-center gap-2 rounded-md px-2 py-2 text-left"
                          style={{ ...raisedStyle, borderColor: selected ? '#d2b84f' : 'rgba(126,153,107,.34)' }}
                        >
                          <div className="w-10 h-10 rounded flex items-center justify-center bg-black/20 border border-[#5b7364]/45"><Icon className="w-5 h-5 text-[#d8c48b]" /></div>
                          <div className="min-w-0"><div className="text-[12px] text-[#e9e1cf] truncate">{def?.name || building.buildingId}</div><div className="text-[9px] text-[#708b7e] truncate">{building.footprintAreaM2 ? `${building.footprintAreaM2} m²` : 'Legacy structure'}</div></div>
                          <div className={`text-[10px] ${building.isBuilt ? 'text-[#79d86c]' : 'text-[#e5bb5b]'}`}>{building.isBuilt ? '● Hoạt động' : worker ? '◐ Đang xây' : '○ Chờ thợ'}</div>
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
                      <div className="text-[9px] text-[#70887c]">Được giữ nguyên để tương thích save cũ; công trình mới sẽ dùng spatial cluster system.</div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg p-3 shrink-0" style={panelStyle}>
                  <div className="flex items-center justify-between mb-2"><div><div className="text-[12px] font-semibold">THƯ VIỆN CÔNG TRÌNH</div><div className="text-[9px] text-[#748e82]">Chỉ hiện công trình phù hợp với cluster này.</div></div><span className="text-[10px] text-[#7f998c]">{structureLibrary.length} mẫu</span></div>
                  <div className="grid grid-cols-5 gap-2">
                    {structureLibrary.map(({ definition, placement }) => {
                      if (!definition) return null;
                      const Icon = structureIcon(definition.category);
                      const status = placementLabel(placement.status);
                      const affordable = definition.cost.every(cost => totalStock(cost.itemId) >= cost.quantity);
                      const canStart = ['available', 'preparation_required'].includes(placement.status) && affordable && Boolean(selectedWorker) && selectedWorkerIdle;
                      return (
                        <div key={definition.id} className="rounded-md p-2 flex flex-col min-h-[132px]" style={raisedStyle}>
                          <div className="flex items-start justify-between"><div className="w-8 h-8 rounded flex items-center justify-center bg-black/20 border border-[#5b7364]/45"><Icon className="w-4 h-4 text-[#d8c48b]" /></div><span className="text-[9px]" style={{ color: status.color }}>{status.label}</span></div>
                          <div className="text-[11px] font-semibold mt-1.5 text-[#e7decb] leading-tight">{definition.name}</div>
                          <div className="text-[9px] text-[#789084] mt-1">{placement.footprintAreaM2} m² · {definition.buildTimeSeconds}s</div>
                          <div className="mt-auto pt-2">
                            <button
                              type="button"
                              disabled={!canStart}
                              onClick={() => handleBuildStructure(selectedCluster, definition.id)}
                              className="w-full rounded py-1.5 text-[10px] border disabled:opacity-35 disabled:cursor-not-allowed"
                              style={{ background: canStart ? '#1b4a2c' : '#173028', borderColor: canStart ? '#c6b04d' : '#52685b', color: canStart ? '#f2df91' : '#81988c' }}
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
                return (
                  <>
                    <div className="flex items-start gap-3 pb-3 border-b border-[#58705f]/30">
                      <div className="w-16 h-16 rounded-md flex items-center justify-center" style={raisedStyle}><Icon className="w-8 h-8 text-[#d8c48b]" /></div>
                      <div className="min-w-0"><div className="text-[17px] font-semibold">{def?.name || selectedStructure.buildingId}</div><div className="text-[10px] text-[#7aa096]">{selectedStructure.isBuilt ? 'Hoạt động' : 'Đang thi công'}</div><div className="text-[10px] text-[#7d9489] mt-1">Footprint {selectedStructure.footprintAreaM2 || '—'} m²</div></div>
                    </div>
                    <p className="text-[11px] text-[#9dac9f] leading-relaxed mt-3">{def?.description}</p>
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-[10px]"><span className="text-[#80988c]">Độ bền tổng</span><span>{Math.round(selectedStructure.condition)}%</span></div>
                      <div className="h-1.5 rounded bg-black/35 overflow-hidden"><div className="h-full bg-[#79d86c]" style={{ width: `${selectedStructure.condition}%` }} /></div>
                      <div className="flex justify-between text-[10px]"><span className="text-[#80988c]">Độ phù hợp vị trí</span><span>{selectedStructure.placementScore ? `${Math.round(selectedStructure.placementScore)}/100` : 'Legacy'}</span></div>
                    </div>
                    <div className="mt-4 rounded-md p-2.5 border border-[#8b7637]/35 bg-[#362f16]/25">
                      <div className="text-[10px] text-[#d4b85d] font-semibold">COMPONENT / MODIFY</div>
                      <p className="text-[9px] text-[#968c6d] mt-1 leading-relaxed">Structure component, Repair/Replace và Modification sẽ gắn trực tiếp vào instance này trong milestone dài hạn; không dùng nút Upgrade Lv. giả.</p>
                    </div>
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
                      <div className="h-1.5 mt-1 rounded bg-black/35 overflow-hidden"><div className="h-full bg-[#8dcf69]" style={{ width: `${Math.max(0, Math.min(100, Number(pct)))}%` }} /></div>
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
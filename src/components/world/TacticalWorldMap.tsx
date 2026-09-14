import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Flame,
  Lock,
  MapPin,
  Upload,
  Users,
} from 'lucide-react';
import type { AreaDefinition, GameState } from '../../types';
import '../../data/mainMapAreaOverrides';
import { TropicalMapClock } from './TropicalMapClock';
import { MainMapWaterShader, MAIN_MAP_WATER_TUNING } from './MainMapWaterShader';
import { MapAmbientEffects } from './MapAmbientEffects';
import { MapParticleEffects } from './MapParticleEffects';
import type { MapShaderEnvironment } from './MapShaderEnvironment';
import { MAIN_MAP_AREA_IDS } from './MainMapGeometry';
import { preloadImage, preloadImages } from '../../utils/imageCache';

const ENABLE_SECTOR_NAVIGATION = false;

const WORLD_MAP_UI = {
  reference: { width: 953, height: 846 },
  box: { x: 476.5, y: 425.5, w: 973, h: 841, radiusPx: 6 },
  // main.png contains fewer, larger POIs than the old center map. A lower zoom
  // preserves more context while keeping the square tactical frame fully covered.
  imageScale: 1.08,
  pan: {
    enabled: true,
    initialX: 0,
    initialY: 0,
    dragSpeed: 1,
    clampToImageBounds: true,
    resetOnSectorChange: true,
    doubleClickToReset: true,
  },
} as const;

export type MapSector = 'center' | 'up' | 'down' | 'left' | 'right';

interface TacticalWorldMapProps {
  state: GameState;
  areas: Record<string, AreaDefinition>;
  selectedAreaId: string;
  onSelectArea: (areaId: string) => void;
}

interface SectorMeta {
  id: MapSector;
  nameVi: string;
  nameEn: string;
  defaultImage: string;
  description: string;
  neighbors: {
    up?: { target: MapSector; label: string };
    down?: { target: MapSector; label: string };
    left?: { target: MapSector; label: string };
    right?: { target: MapSector; label: string };
  };
}

/**
 * Multi-map infrastructure intentionally stays intact. Only the currently exposed
 * central region is promoted to main.png; outer sector navigation is hidden by a
 * feature flag until those maps are ready for gameplay.
 */
const SECTOR_CONFIG: Record<MapSector, SectorMeta> = {
  center: {
    id: 'center',
    nameVi: 'Đảo Chính • Khu Vực Sinh Tồn',
    nameEn: 'Primary Survival Region',
    defaultImage: '/maps/main.png',
    description: 'Xác máy bay, rừng mưa, thung lũng tre, vùng ngập, hang đá vôi và hẻm sông.',
    neighbors: {
      up: { target: 'up', label: 'Bắc • Núi Đỉnh Mây' },
      down: { target: 'down', label: 'Nam • Rừng Ngập Mặn' },
      left: { target: 'left', label: 'Tây • Đầm Lầy & Vịnh' },
      right: { target: 'right', label: 'Đông • Rừng Cổ Thụ' },
    },
  },
  up: {
    id: 'up',
    nameVi: 'Phía Bắc • Cao Nguyên & Núi Đỉnh Mây',
    nameEn: 'Highlands & Cloud Peak (North)',
    defaultImage: '/maps/up.png',
    description: 'Đỉnh núi sương mù, thác đầu nguồn, bậc thang đá hắc diện và di tích cổ.',
    neighbors: { down: { target: 'center', label: 'Nam • Về Đảo Chính' } },
  },
  down: {
    id: 'down',
    nameVi: 'Phía Nam • Rừng Ngập Mặn & Vịnh San Hô',
    nameEn: 'Mangroves & Coral Inlet (South)',
    defaultImage: '/maps/down.png',
    description: 'Vùng đầm lầy ngập mặn, bãi đá ngầm san hô, làng cọc nước và bãi vỏ sò.',
    neighbors: { up: { target: 'center', label: 'Bắc • Về Đảo Chính' } },
  },
  left: {
    id: 'left',
    nameVi: 'Phía Tây • Đầm Lầy, Thác Sấm & Vịnh Trăng',
    nameEn: 'Thunder Falls & Crescent Lagoon (West)',
    defaultImage: '/maps/left.png',
    description: 'Thác sấm gầm, thềm đất sét đỏ, hố sụt cenote và bãi biển rùa đẻ.',
    neighbors: { right: { target: 'center', label: 'Đông • Về Đảo Chính' } },
  },
  right: {
    id: 'right',
    nameVi: 'Phía Đông • Rừng Cổ Thụ & Vòm Cây Khổng Lồ',
    nameEn: 'Giant Kapok & Eastern Bluffs (East)',
    defaultImage: '/maps/right.png',
    description: 'Rừng cây Kapok vạn niên, đền thờ lãng quên, vách đá ngắm biển và bãi trăng.',
    neighbors: { left: { target: 'center', label: 'Tây • Về Đảo Chính' } },
  },
};

const DEFAULT_MAP_URLS = Array.from(new Set(Object.values(SECTOR_CONFIG).map((s) => s.defaultImage)));
const MAIN_AREA_SET = new Set<string>(MAIN_MAP_AREA_IDS);

type MapCenteredBox = { x: number; y: number; w: number; h: number };
const mapViewportStyle = (box: MapCenteredBox): React.CSSProperties => {
  const leftPx = box.x - box.w / 2;
  const topPx = box.y - box.h / 2;
  return {
    left: `${(leftPx / WORLD_MAP_UI.reference.width) * 100}%`,
    top: `${(topPx / WORLD_MAP_UI.reference.height) * 100}%`,
    width: `${(box.w / WORLD_MAP_UI.reference.width) * 100}%`,
    height: `${(box.h / WORLD_MAP_UI.reference.height) * 100}%`,
  };
};

export const TacticalWorldMap: React.FC<TacticalWorldMapProps> = ({
  state,
  areas,
  selectedAreaId,
  onSelectArea,
}) => {
  const [currentSector, setCurrentSector] = useState<MapSector>('center');
  const [hoveredAreaId, setHoveredAreaId] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [displayedImageSrc, setDisplayedImageSrc] = useState<string | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [mapViewportSize, setMapViewportSize] = useState({ width: 0, height: 0 });
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [customImages, setCustomImages] = useState<Record<MapSector, string>>({
    center: '', up: '', down: '', left: '', right: '',
  });

  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const panDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const lastSelectedAreaIdRef = useRef(selectedAreaId);

  const shaderEnvironment: MapShaderEnvironment = useMemo(() => ({
    timeOfDayMinutes: state.gameTime.minuteOfDay,
    rainIntensity: state.weather.rainIntensity ?? 0,
    cloudCover: state.weather.cloudCover ?? 0.1,
    windSpeedKmh: state.weather.wind?.speedKmh ?? 8,
    windDirectionDeg: state.weather.wind?.directionDeg ?? 45,
    humidityPercent: state.weather.humidityPercent ?? 65,
    temperatureC: state.weather.temperatureC ?? 30,
  }), [
    state.gameTime.minuteOfDay,
    state.weather.rainIntensity,
    state.weather.cloudCover,
    state.weather.wind?.speedKmh,
    state.weather.wind?.directionDeg,
    state.weather.humidityPercent,
    state.weather.temperatureC,
  ]);

  useEffect(() => { void preloadImages(DEFAULT_MAP_URLS, { concurrency: 2 }); }, []);

  useEffect(() => {
    if (lastSelectedAreaIdRef.current === selectedAreaId) return;
    lastSelectedAreaIdRef.current = selectedAreaId;
    const area = areas[selectedAreaId];
    const sector = (area?.sector || 'center') as MapSector;
    if (SECTOR_CONFIG[sector] && sector !== currentSector) setCurrentSector(sector);
  }, [selectedAreaId, areas, currentSector]);

  // V2 key deliberately ignores old center-map uploads that would otherwise mask main.png.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ISLAND_CUSTOM_MAPS_V2');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') setCustomImages((prev) => ({ ...prev, ...parsed }));
    } catch {
      // Ignore malformed local cache.
    }
  }, []);

  const sectorMeta = SECTOR_CONFIG[currentSector];
  const targetImageSrc = customImages[currentSector] || sectorMeta.defaultImage;

  useEffect(() => {
    if (!WORLD_MAP_UI.pan.resetOnSectorChange) return;
    setMapPan({ x: WORLD_MAP_UI.pan.initialX, y: WORLD_MAP_UI.pan.initialY });
    setIsPanning(false);
    panDragRef.current = null;
  }, [currentSector, targetImageSrc]);

  useEffect(() => {
    setIsLoadingImage(true);
    setImageError(false);
    let cancelled = false;
    preloadImage(targetImageSrc)
      .then((img) => {
        if (cancelled) return;
        setImageNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        setDisplayedImageSrc(targetImageSrc);
        setIsLoadingImage(false);
      })
      .catch(() => {
        if (cancelled) return;
        setImageError(true);
        setIsLoadingImage(false);
      });
    return () => { cancelled = true; };
  }, [targetImageSrc]);

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      setMapViewportSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const handleCustomImageUpload = (event: React.ChangeEvent<HTMLInputElement>, sector: MapSector) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result as string;
      if (!result) return;
      setCustomImages((prev) => {
        const updated = { ...prev, [sector]: result };
        try { localStorage.setItem('ISLAND_CUSTOM_MAPS_V2', JSON.stringify(updated)); } catch { /* quota */ }
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const getPeopleCountAtArea = (areaId: string) => {
    const expeditionPeople = state.expeditions
      .filter((e) => e.areaId === areaId && e.phase !== 'finished')
      .reduce((sum, e) => sum + (e.survivorIds?.length || 0), 0);
    if (areaId !== 'AREA_CAMP_CLEARING') return expeditionPeople;
    const away = state.expeditions
      .filter((e) => e.phase !== 'finished')
      .reduce((sum, e) => sum + (e.survivorIds?.length || 0), 0);
    return Math.max(0, state.survivors.length - away);
  };

  const currentAreas = useMemo(() => {
    const all = Object.values(areas) as AreaDefinition[];
    if (currentSector === 'center') return all.filter((area) => MAIN_AREA_SET.has(area.id));
    return all.filter((area) => (area.sector || 'center') === currentSector);
  }, [areas, currentSector]);

  const occupiedPoiLights = useMemo(() => currentAreas
    .map((area) => {
      const peopleCount = state.expeditions
        .filter((e) => e.areaId === area.id && e.phase !== 'finished')
        .reduce((sum, e) => sum + (e.survivorIds?.length || 0), 0);
      return {
        area,
        peopleCount,
        xPercent: area.mapX ?? 50,
        yPercent: area.mapY ?? 50,
        radiusPercent: Math.max(3.8, Math.min(6.5, (area.boxW ?? 7) * .65)),
        intensity: Math.min(1.2, .48 + Math.sqrt(peopleCount) * .22),
      };
    })
    .filter((light) => light.peopleCount > 0 && light.area.id !== 'AREA_CAMP_CLEARING')
    .sort((a, b) => b.peopleCount - a.peopleCount)
    .map(({ xPercent, yPercent, radiusPercent, intensity }) => ({ xPercent, yPercent, radiusPercent, intensity })),
  [currentAreas, state.expeditions]);

  const sourceWidth = imageNaturalSize.width;
  const sourceHeight = imageNaturalSize.height;
  const viewportWidth = mapViewportSize.width;
  const viewportHeight = mapViewportSize.height;
  const minimumCoverScale = sourceWidth > 0 && sourceHeight > 0 && viewportWidth > 0 && viewportHeight > 0
    ? Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight)
    : 1;
  const coverScale = minimumCoverScale * Math.max(1, WORLD_MAP_UI.imageScale);
  const renderedMapWidth = sourceWidth > 0 ? sourceWidth * coverScale : viewportWidth;
  const renderedMapHeight = sourceHeight > 0 ? sourceHeight * coverScale : viewportHeight;
  const maxPanX = Math.max(0, (renderedMapWidth - viewportWidth) / 2);
  const maxPanY = Math.max(0, (renderedMapHeight - viewportHeight) / 2);
  const clampPanAxis = (value: number, max: number) => WORLD_MAP_UI.pan.clampToImageBounds
    ? Math.max(-max, Math.min(max, value))
    : value;
  const effectivePanX = clampPanAxis(mapPan.x, maxPanX);
  const effectivePanY = clampPanAxis(mapPan.y, maxPanY);

  const mapPlaneStyle: React.CSSProperties = {
    position: 'absolute',
    width: renderedMapWidth,
    height: renderedMapHeight,
    left: (viewportWidth - renderedMapWidth) / 2,
    top: (viewportHeight - renderedMapHeight) / 2,
    transform: `translate3d(${effectivePanX}px, ${effectivePanY}px, 0)`,
    transformOrigin: 'center center',
    willChange: isPanning ? 'transform' : undefined,
  };

  const isPanBlockedTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button, input, label, [data-map-poi="true"]'));

  const handleMapPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!WORLD_MAP_UI.pan.enabled || isLoadingImage || imageError || isPanBlockedTarget(event.target)) return;
    panDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: effectivePanX,
      startPanY: effectivePanY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPanning(true);
  };

  const handleMapPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setMapPan({
      x: clampPanAxis(drag.startPanX + (event.clientX - drag.startClientX) * WORLD_MAP_UI.pan.dragSpeed, maxPanX),
      y: clampPanAxis(drag.startPanY + (event.clientY - drag.startClientY) * WORLD_MAP_UI.pan.dragSpeed, maxPanY),
    });
  };

  const finishMapPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
    panDragRef.current = null;
    setIsPanning(false);
  };

  const resetMapPan = () => setMapPan({ x: WORLD_MAP_UI.pan.initialX, y: WORLD_MAP_UI.pan.initialY });

  const renderPoi = (area: AreaDefinition) => {
    const posX = area.mapX ?? 50;
    const posY = area.mapY ?? 50;
    const boxW = area.boxW ?? 8;
    const boxH = area.boxH ?? 3;
    const selected = area.id === selectedAreaId;
    const hovered = area.id === hoveredAreaId;
    const peopleCount = getPeopleCountAtArea(area.id);

    return (
      <div
        key={area.id}
        data-map-poi="true"
        onClick={(event) => { event.stopPropagation(); onSelectArea(area.id); }}
        onMouseEnter={() => setHoveredAreaId(area.id)}
        onMouseLeave={() => setHoveredAreaId(null)}
        style={{
          left: `${posX}%`,
          top: `${posY}%`,
          width: `${Math.max(boxW + .9, 6.5)}%`,
          height: `${Math.max(boxH + .9, 3.1)}%`,
          transform: 'translate(-50%, -50%)',
        }}
        title={area.name}
        className="absolute pointer-events-auto cursor-pointer group flex items-center justify-center transition-[filter] duration-200 ease-out"
      >
        {!selected && !hovered && (
          <div className="w-full h-full rounded-md border border-amber-100/15 bg-black/[0.015] opacity-15 transition-opacity duration-200 group-hover:opacity-60" />
        )}

        {peopleCount > 0 && (
          <div className="absolute -top-3 -right-2 z-20 flex items-center gap-0.5 rounded-full border border-amber-300/75 bg-[#0b110d]/92 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-100 shadow-[0_2px_7px_rgba(0,0,0,.75)] pointer-events-none">
            <Users className="w-2.5 h-2.5 text-amber-300" />
            <span>{peopleCount}</span>
          </div>
        )}

        {hovered && !selected && (
          <>
            <div className="absolute -inset-0.5 rounded-md border border-amber-100/70 bg-amber-100/[0.035] shadow-[0_0_11px_rgba(233,190,112,.26),inset_0_0_9px_rgba(255,239,204,.05)] backdrop-brightness-[1.06] pointer-events-none">
              <span className="absolute -top-px -left-px w-2 h-2 border-t border-l border-amber-100" />
              <span className="absolute -top-px -right-px w-2 h-2 border-t border-r border-amber-100" />
              <span className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-amber-100" />
              <span className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-amber-100" />
            </div>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-[#c5a16a]/50 bg-[#08120d]/90 px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-[#f3e8d3] shadow-md pointer-events-none">
              {area.name}
            </div>
          </>
        )}

        {selected && (
          <>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 whitespace-nowrap rounded-sm border border-amber-100/70 bg-[#0b120d]/94 px-1.5 py-0.5 shadow-[0_2px_8px_rgba(0,0,0,.72)] pointer-events-none">
              <MapPin className="w-3 h-3 text-amber-100 fill-amber-500/20 stroke-[1.6]" />
              <span className="text-[8px] font-bold tracking-wide text-[#fff0d2]">{area.name}</span>
            </div>
            <div className="absolute -inset-1 rounded-md border border-amber-100/75 bg-amber-200/[0.045] shadow-[0_0_14px_rgba(235,191,111,.30),inset_0_0_10px_rgba(255,240,204,.05)] pointer-events-none z-10">
              <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-amber-100" />
              <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-amber-100" />
              <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-amber-100" />
              <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-amber-100" />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full overflow-visible select-none">
      <div
        ref={mapViewportRef}
        className="absolute overflow-hidden bg-[#070b08] shadow-inner"
        style={{
          ...mapViewportStyle(WORLD_MAP_UI.box),
          borderRadius: WORLD_MAP_UI.box.radiusPx,
          cursor: WORLD_MAP_UI.pan.enabled ? (isPanning ? 'grabbing' : 'grab') : 'default',
          touchAction: WORLD_MAP_UI.pan.enabled ? 'none' : 'auto',
        }}
        onPointerDown={handleMapPointerDown}
        onPointerMove={handleMapPointerMove}
        onPointerUp={finishMapPan}
        onPointerCancel={finishMapPan}
        onDoubleClick={WORLD_MAP_UI.pan.doubleClickToReset ? resetMapPan : undefined}
      >
        <div className="relative w-full h-full overflow-hidden">
          <TropicalMapClock gameTime={state.gameTime} weather={state.weather} />

          {isLoadingImage && !displayedImageSrc && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#070b08] text-center">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-400 border-r-amber-400 animate-spin" />
                <Compass className="w-7 h-7 text-amber-300 absolute animate-pulse" />
              </div>
              <span className="text-xs font-serif font-bold tracking-widest text-amber-200/90 mt-3">{sectorMeta.nameVi}</span>
              <span className="text-[10px] text-[#8e9f92] mt-0.5 font-mono">Đang nạp hải đồ...</span>
            </div>
          )}

          {!imageError && displayedImageSrc ? (
            <div className="absolute" style={mapPlaneStyle}>
              <img
                src={displayedImageSrc}
                alt={sectorMeta.nameVi}
                loading="eager"
                decoding="async"
                draggable={false}
                className="absolute inset-0 w-full h-full select-none pointer-events-none filter contrast-[1.03] brightness-95"
                style={{ objectFit: 'fill', maxWidth: 'none', maxHeight: 'none' }}
              />

              {currentSector === 'center' && (
                <>
                  <MainMapWaterShader
                    src={displayedImageSrc}
                    strength={MAIN_MAP_WATER_TUNING.strength}
                    riverStrength={MAIN_MAP_WATER_TUNING.riverStrength}
                    environment={shaderEnvironment}
                  />
                  <MapAmbientEffects
                    src={displayedImageSrc}
                    strength={1}
                    environment={shaderEnvironment}
                    poiLights={occupiedPoiLights}
                  />
                  <MapParticleEffects strength={1} environment={shaderEnvironment} />
                </>
              )}

              {!isLoadingImage && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {currentAreas.map(renderPoi)}
                </div>
              )}
            </div>
          ) : imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#122218] via-[#1a2d21] to-[#0e1712] p-6 text-center">
              <div className="max-w-md rounded-xl border border-[#b8945f]/50 bg-[#0c1410]/90 p-4 shadow-2xl">
                <Compass className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                <h3 className="text-sm font-serif font-bold text-amber-200">{sectorMeta.nameVi}</h3>
                <p className="text-xs text-[#a3b8aa] leading-relaxed my-2">
                  Không thể nạp <code className="text-amber-300 font-mono">public{sectorMeta.defaultImage}</code>.
                </p>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer border border-emerald-500/50">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn ảnh {currentSector}.png</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCustomImageUpload(e, currentSector)} />
                </label>
              </div>
            </div>
          ) : null}

          {currentSector !== 'center' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-5 text-center backdrop-blur-[2px] pointer-events-auto">
              <div className="max-w-sm rounded-2xl border-2 border-[#b8945f]/70 bg-[#120d09]/95 p-5 shadow-2xl flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-400/60 flex items-center justify-center mb-3">
                  <Lock className="w-7 h-7 text-amber-300" />
                </div>
                <span className="text-xl font-serif font-black tracking-widest text-amber-200 uppercase">Coming Soon</span>
                <div className="text-sm font-serif font-bold text-[#f2e2ca] mt-1.5">{sectorMeta.nameVi}</div>
                <div className="text-[11px] text-amber-400/80 font-mono">{sectorMeta.nameEn}</div>
                <p className="text-xs text-[#a99881] leading-relaxed max-w-xs my-4">
                  Sector này vẫn được giữ trong hệ thống multi-map nhưng tạm thời chưa mở cho gameplay hiện tại.
                </p>
                <button
                  onClick={() => { setCurrentSector('center'); onSelectArea('AREA_CAMP_CLEARING'); }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#78350f] hover:bg-[#92400e] text-[#fef3c7] font-serif font-bold text-xs uppercase tracking-wider border border-amber-400/60 cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  <span>Trở về đảo chính</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {ENABLE_SECTOR_NAVIGATION && sectorMeta.neighbors.up && (
          <button onClick={() => setCurrentSector(sectorMeta.neighbors.up!.target)} title={sectorMeta.neighbors.up.label} className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 p-2 rounded-full bg-[#160f09]/90 border border-[#d4a359]/80 text-amber-300 cursor-pointer">
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
        {ENABLE_SECTOR_NAVIGATION && sectorMeta.neighbors.down && (
          <button onClick={() => setCurrentSector(sectorMeta.neighbors.down!.target)} title={sectorMeta.neighbors.down.label} className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 p-2 rounded-full bg-[#160f09]/90 border border-[#d4a359]/80 text-amber-300 cursor-pointer">
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
        {ENABLE_SECTOR_NAVIGATION && sectorMeta.neighbors.left && (
          <button onClick={() => setCurrentSector(sectorMeta.neighbors.left!.target)} title={sectorMeta.neighbors.left.label} className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-[#160f09]/90 border border-[#d4a359]/80 text-amber-300 cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {ENABLE_SECTOR_NAVIGATION && sectorMeta.neighbors.right && (
          <button onClick={() => setCurrentSector(sectorMeta.neighbors.right!.target)} title={sectorMeta.neighbors.right.label} className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-[#160f09]/90 border border-[#d4a359]/80 text-amber-300 cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

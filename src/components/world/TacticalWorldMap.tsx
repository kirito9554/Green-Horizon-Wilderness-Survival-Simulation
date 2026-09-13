import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Flame, 
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Upload,
  MapPin,
  Users,
  Lock
} from 'lucide-react';
import { AreaDefinition, GameState } from '../../types';
import { TropicalMapClock } from './TropicalMapClock';
import { MapWaterShader, WATER_TUNING } from './MapWaterShader';
import { MapAmbientEffects } from './MapAmbientEffects';
import { MapParticleEffects } from './MapParticleEffects';
import { MapShaderEnvironment } from './MapShaderEnvironment';
import { preloadImage, preloadImages } from '../../utils/imageCache';

/**
 * =============================================================================
 * WORLD MAP - QUICK TUNING
 * =============================================================================
 * Chỉ cần chỉnh 2 nhóm này để căn map theo background:
 *
 * 1) box: vùng hiển thị/cắt map, dùng DESIGN PIXEL theo reference bên dưới.
 *    x / y = TÂM của box.
 *    w / h = KÍCH THƯỚC TỔNG của box.
 *
 *    Quan trọng: khi tăng w hoặc h, box sẽ nở ĐỀU ra hai phía quanh tâm x/y.
 *    Ví dụ w: 953 -> 1000 sẽ tăng ~23.5 px bên trái + ~23.5 px bên phải.
 *    Muốn di chuyển cả box thì chỉnh x / y, không cần tính lại left/right.
 *
 * 2) imageScale: zoom thêm cho ảnh map nhưng LUÔN giữ nguyên tỉ lệ gốc.
 *    1.00 = cover tối thiểu để ảnh phủ kín box.
 *    1.10 = zoom thêm 10%, 1.25 = zoom thêm 25%...
 *
 * 3) pan: kéo map bằng chuột / touch để xem phần ảnh đang bị crop.
 *    Ảnh + toàn bộ POI di chuyển cùng nhau và mặc định bị clamp để không lộ nền trống.
 * =============================================================================
 */
const WORLD_MAP_UI = {
  // Hệ tọa độ của vùng World Map trong background.
  // Thường giữ nguyên sau khi đã đo đúng BG.
  reference: {
    width: 953,
    height: 846,
  },

  // (1) BOX HIỂN THỊ MAP
  // x/y là TÂM box, không phải góc trên-trái.
  box: {
    x: 476.5,
    y: 425.5,
    w: 973,
    h: 841,
    radiusPx: 6,
  },

  // (2) SCALE ẢNH MAP
  // 1.00 = cover tối thiểu, luôn phủ kín box và giữ đúng tỉ lệ ảnh.
  // > 1.00 = zoom IN và cho phép pan xa hơn.
  imageScale: 1.25,

  // (3) PAN MAP
  pan: {
    enabled: true,
    // Vị trí bắt đầu tính theo CSS pixel của viewport sau khi render.
    // 0 / 0 = ảnh nằm giữa. Dương X = kéo ảnh sang phải; dương Y = kéo xuống.
    initialX: 0,
    initialY: 0,
    dragSpeed: 1.0,
    // true = không cho kéo quá mép để lộ nền trống.
    clampToImageBounds: true,
    // Khi đổi sector/map thì trở về vị trí pan ban đầu.
    resetOnSectorChange: true,
    // Double click / double tap để đưa map về tâm.
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

const SECTOR_CONFIG: Record<MapSector, SectorMeta> = {
  center: {
    id: 'center',
    nameVi: 'Trung Tâm • Trại Khai Hoang',
    nameEn: 'Base Camp Region (Central)',
    defaultImage: '/maps/center.png',
    description: 'Trại sinh tồn, suối nguồn, tàn tích cổ đại và thung lũng trung tâm đảo.',
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
    neighbors: {
      down: { target: 'center', label: 'Nam • Về Trại Trung Tâm' },
    },
  },
  down: {
    id: 'down',
    nameVi: 'Phía Nam • Rừng Ngập Mặn & Vịnh San Hô',
    nameEn: 'Mangroves & Coral Inlet (South)',
    defaultImage: '/maps/down.png',
    description: 'Vùng đầm lầy ngập mặn, bãi đá ngầm san hô, làng cọc nước và bãi vỏ sò.',
    neighbors: {
      up: { target: 'center', label: 'Bắc • Về Trại Trung Tâm' },
    },
  },
  left: {
    id: 'left',
    nameVi: 'Phía Tây • Đầm Lầy, Thác Sấm & Vịnh Trăng',
    nameEn: 'Thunder Falls & Crescent Lagoon (West)',
    defaultImage: '/maps/left.png',
    description: 'Thác sấm gầm, thềm đất sét đỏ, hố sụt cenote và bãi biển rùa đẻ.',
    neighbors: {
      right: { target: 'center', label: 'Đông • Về Trại Trung Tâm' },
    },
  },
  right: {
    id: 'right',
    nameVi: 'Phía Đông • Rừng Cổ Thụ & Vòm Cây Khổng Lồ',
    nameEn: 'Giant Kapok & Eastern Bluffs (East)',
    defaultImage: '/maps/right.png',
    description: 'Rừng cây Kapok vạn niên, đền thờ lãng quên, vách đá ngắm biển và bãi trăng.',
    neighbors: {
      left: { target: 'center', label: 'Tây • Về Trại Trung Tâm' },
    },
  },
};

const DEFAULT_MAP_URLS = Array.from(
  new Set(Object.values(SECTOR_CONFIG).map((sector) => sector.defaultImage)),
);


type MapCenteredBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// x/y là tâm của viewport theo design pixel. left/top được suy ra từ w/h,
// vì vậy tăng w hoặc h sẽ nở đều về hai phía thay vì chỉ kéo một cạnh.
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
  const [imageError, setImageError] = useState<boolean>(false);
  const [customImages, setCustomImages] = useState<Record<MapSector, string>>({
    center: '',
    up: '',
    down: '',
    left: '',
    right: '',
  });

  // Image loading state: Clears old image immediately and shows circular spinner
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(true);
  const [displayedImageSrc, setDisplayedImageSrc] = useState<string | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [mapViewportSize, setMapViewportSize] = useState({ width: 0, height: 0 });
  const mapViewportRef = useRef<HTMLDivElement | null>(null);

  // Interactive map pan. Values are CSS pixels inside the rendered viewport.
  const [mapPan, setMapPan] = useState({
    x: WORLD_MAP_UI.pan.initialX,
    y: WORLD_MAP_UI.pan.initialY,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Reactive shader environment: passes dynamic time, wind, rain, and humidity into WebGL shaders
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

  // Decode/cache every built-in sector map once. The shared cache deduplicates
  // this with the active-map loader below, so center.png is never loaded twice.
  useEffect(() => {
    void preloadImages(DEFAULT_MAP_URLS, { concurrency: 2 });
  }, []);

  // Automatically adjust sector ONLY when user or external component explicitly selects a new area
  const lastSelectedAreaIdRef = useRef<string>(selectedAreaId);
  useEffect(() => {
    if (lastSelectedAreaIdRef.current !== selectedAreaId) {
      lastSelectedAreaIdRef.current = selectedAreaId;
      const area = areas[selectedAreaId];
      if (area && area.sector && area.sector !== currentSector) {
        setCurrentSector(area.sector);
      }
    }
  }, [selectedAreaId, areas, currentSector]);

  // Load custom images from localStorage if any were uploaded
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ISLAND_CUSTOM_MAPS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setCustomImages(prev => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // ignore
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

  // Whenever sector or target image changes, reuse the shared decoded-image cache.
  // Keep the previous map visible until the next one is decoded, then swap in one step.
  useEffect(() => {
    setIsLoadingImage(true);
    setImageError(false);

    let cancelled = false;

    preloadImage(targetImageSrc)
      .then((img) => {
        if (cancelled) return;

        setImageNaturalSize({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
        setDisplayedImageSrc(targetImageSrc);
        setIsLoadingImage(false);
      })
      .catch(() => {
        if (cancelled) return;
        setImageError(true);
        setIsLoadingImage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetImageSrc]);


  // Measure the visible map box. This lets us calculate a true aspect-ratio-safe
  // "cover" rectangle instead of stretching the image with object-fill.
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

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>, sector: MapSector) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCustomImages(prev => {
          const updated = { ...prev, [sector]: result };
          try {
            localStorage.setItem('ISLAND_CUSTOM_MAPS', JSON.stringify(updated));
          } catch {
            // Ignore quota
          }
          return updated;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Calculate how many people are currently located at an area
  const getPeopleCountAtArea = (areaId: string): number => {
    // Check survivors on expedition to this area
    const expeditionPeople = state.expeditions
      .filter(e => e.areaId === areaId && e.phase !== 'finished')
      .reduce((sum, e) => sum + (e.survivorIds?.length || 0), 0);

    if (areaId === 'AREA_CAMP_CLEARING') {
      // At Base Camp: total survivors minus those away on expedition
      const awayCount = state.expeditions
        .filter(e => e.phase !== 'finished')
        .reduce((sum, e) => sum + (e.survivorIds?.length || 0), 0);
      return Math.max(0, state.survivors.length - awayCount);
    }

    return expeditionPeople;
  };

  // Filter POIs that belong to the active sector
  const currentAreas: AreaDefinition[] = useMemo(
    () => (Object.values(areas) as AreaDefinition[]).filter(
      (area: AreaDefinition) => (area.sector || 'center') === currentSector
    ),
    [areas,currentSector],
  );

  // Only occupied expedition POIs become local light sources. Base Camp is
  // excluded because its painted campfire already provides the local glow.
  const occupiedPoiLights = useMemo(() => {
    const peopleAt=(areaId:string)=>state.expeditions
      .filter(expedition=>expedition.areaId===areaId&&expedition.phase!=='finished')
      .reduce((sum,expedition)=>sum+(expedition.survivorIds?.length||0),0);
    return currentAreas
      .map((area) => {
        const peopleCount=peopleAt(area.id);
        return {
          area,
          peopleCount,
          xPercent:area.mapX??50,
          yPercent:area.mapY??50,
          radiusPercent:Math.max(3.8,Math.min(6.5,(area.boxW??7)*.65)),
          intensity:Math.min(1.2,.48+Math.sqrt(peopleCount)*.22),
        };
      })
      .filter((light) => light.peopleCount>0&&light.area.id!=='AREA_CAMP_CLEARING')
      .sort((a,b)=>b.peopleCount-a.peopleCount)
      .map(({xPercent,yPercent,radiusPercent,intensity})=>({
        xPercent,
        yPercent,
        radiusPercent,
        intensity,
      }));
  },[currentAreas,state.expeditions]);

  // Preserve the source image ratio while guaranteeing full viewport coverage.
  // imageScale starts at 1.00: the minimum cover size. Any cropped area can then
  // be inspected by panning instead of shrinking the image and exposing empty bars.
  const sourceWidth = imageNaturalSize.width;
  const sourceHeight = imageNaturalSize.height;
  const viewportWidth = mapViewportSize.width;
  const viewportHeight = mapViewportSize.height;
  const imageZoom = Math.max(1, WORLD_MAP_UI.imageScale);

  const minimumCoverScale =
    sourceWidth > 0 && sourceHeight > 0 && viewportWidth > 0 && viewportHeight > 0
      ? Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight)
      : 1;

  const coverScale = minimumCoverScale * imageZoom;

  const renderedMapWidth = sourceWidth > 0 ? sourceWidth * coverScale : viewportWidth;
  const renderedMapHeight = sourceHeight > 0 ? sourceHeight * coverScale : viewportHeight;

  // Maximum legal pan while keeping every viewport pixel covered by the image.
  const maxPanX = Math.max(0, (renderedMapWidth - viewportWidth) / 2);
  const maxPanY = Math.max(0, (renderedMapHeight - viewportHeight) / 2);
  const clampPanAxis = (value: number, max: number) =>
    WORLD_MAP_UI.pan.clampToImageBounds ? Math.max(-max, Math.min(max, value)) : value;

  const effectivePanX = clampPanAxis(mapPan.x, maxPanX);
  const effectivePanY = clampPanAxis(mapPan.y, maxPanY);

  // One shared compositor plane for BOTH the raster map and every POI/selected marker.
  // Pan is applied only once to this parent transform, so the selected marker cannot lag
  // one React frame behind the image while dragging.
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

  const isPanBlockedTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('button, input, label, [data-map-poi="true"]'));
  };

  const handleMapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!WORLD_MAP_UI.pan.enabled || isLoadingImage || imageError || isPanBlockedTarget(e.target)) return;

    panDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: effectivePanX,
      startPanY: effectivePanY,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsPanning(true);
  };

  const handleMapPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const nextX = drag.startPanX + (e.clientX - drag.startClientX) * WORLD_MAP_UI.pan.dragSpeed;
    const nextY = drag.startPanY + (e.clientY - drag.startClientY) * WORLD_MAP_UI.pan.dragSpeed;

    setMapPan({
      x: clampPanAxis(nextX, maxPanX),
      y: clampPanAxis(nextY, maxPanY),
    });
  };

  const finishMapPan = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    panDragRef.current = null;
    setIsPanning(false);
  };

  const resetMapPan = () => {
    setMapPan({ x: WORLD_MAP_UI.pan.initialX, y: WORLD_MAP_UI.pan.initialY });
  };

  return (
    <div className="relative w-full h-full overflow-visible select-none">
      {/* Visible/cropping box. Tune WORLD_MAP_UI.box at the top of this file. */}
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
        {/* Everything below is clipped to the viewport box. */}
        <div className="relative w-full h-full overflow-hidden">

          {/* Fixed HUD overlay: follows simulation time/weather, never the pannable map plane. */}
          <TropicalMapClock gameTime={state.gameTime} weather={state.weather} />

          {/* 1. CIRCULAR LOADING STATE: Displayed when switching map until the new image finishes loading */}
          {isLoadingImage && !displayedImageSrc && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#070b08] text-center">
              {/* Outer Golden Compass Ring Spinner */}
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-400 border-r-amber-400 animate-spin" />
                <Compass className="w-7 h-7 text-amber-300 absolute animate-pulse" />
              </div>
              <span className="text-xs font-serif font-bold tracking-widest text-amber-200/90 mt-3 drop-shadow">
                {sectorMeta.nameVi}
              </span>
              <span className="text-[10px] text-[#8e9f92] mt-0.5 font-mono">
                Đang nạp hải đồ...
              </span>
            </div>
          )}

          {isLoadingImage && displayedImageSrc && (
            <div className="absolute top-3 right-3 z-40 pointer-events-none flex items-center gap-2 rounded-full bg-black/55 border border-amber-400/30 px-2.5 py-1.5 backdrop-blur-sm">
              <div className="w-3.5 h-3.5 rounded-full border border-amber-500/25 border-t-amber-300 animate-spin" />
              <span className="text-[9px] text-amber-100/80 font-mono">Loading map…</span>
            </div>
          )}

          {/* 2 + 3. SHARED MAP PLANE: image + POIs pan as one compositor layer. */}
          {!imageError && displayedImageSrc ? (
            <div
              className="absolute"
              style={mapPlaneStyle}
            >
              <img
                src={displayedImageSrc}
                alt={sectorMeta.nameVi}
                loading="eager"
                decoding="async"
                className="absolute inset-0 w-full h-full select-none pointer-events-none filter contrast-[1.03] brightness-95 animate-fadeIn duration-300"
                style={{
                  objectFit: 'fill',
                  maxWidth: 'none',
                  maxHeight: 'none',
                }}
              />

              {/* The center map may be the bundled URL or the same image loaded from localStorage. */}
              {currentSector === 'center' && (
                <>
                  <MapWaterShader
                    src={displayedImageSrc}
                    strength={WATER_TUNING.strength}
                    environment={shaderEnvironment}
                  />
                  <MapAmbientEffects
                    src={displayedImageSrc}
                    strength={1}
                    environment={shaderEnvironment}
                    poiLights={occupiedPoiLights}
                  />
                  <MapParticleEffects
                    strength={1}
                    environment={shaderEnvironment}
                  />
                </>
              )}

              {/* POI coordinates live on the exact same plane as the raster image. */}
              {!isLoadingImage && currentSector === 'center' && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {currentAreas.map((area) => {
                    const posX = area.mapX ?? 50;
                    const posY = area.mapY ?? 50;
                    const boxW = area.boxW ?? 7.5;
                    const boxH = area.boxH ?? 2.1;
                    const isSelected = area.id === selectedAreaId;
                    const isHovered = area.id === hoveredAreaId;
                    const peopleCount = getPeopleCountAtArea(area.id);

                    return (
                      <div
                        key={area.id}
                        data-map-poi="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectArea(area.id);
                        }}
                        onMouseEnter={() => setHoveredAreaId(area.id)}
                        onMouseLeave={() => setHoveredAreaId(null)}
                        style={{
                          left: `${posX}%`,
                          top: `${posY}%`,
                          width: `${Math.max(boxW + 0.8, 6.0)}%`,
                          height: `${Math.max(boxH + 0.8, 2.8)}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        title={area.name}
                        className="absolute pointer-events-auto cursor-pointer group flex items-center justify-center transition-colors duration-150"
                      >
                        {/* Subtle Idle Marker (When Not Selected) */}
                        {!isSelected && !isHovered && (
                          <div className="w-full h-full rounded-md transition-opacity duration-300 opacity-25 group-hover:opacity-100 border border-amber-300/30" />
                        )}

                        {/* PEOPLE COUNT BADGE */}
                        {peopleCount > 0 && (
                          <div
                            className="absolute -top-3 -right-2.5 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#120d09]/95 border border-amber-400/90 text-amber-200 text-[9px] font-mono font-bold shadow-[0_2px_8px_rgba(0,0,0,0.85)] pointer-events-none"
                            title={`${peopleCount} người đang ở ${area.name}`}
                          >
                            <Users className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            <span className="leading-none">{peopleCount}</span>
                          </div>
                        )}

                        {/* HOVER HIGHLIGHT */}
                        {isHovered && !isSelected && (
                          <div className="absolute inset-0 rounded-md border border-amber-300/90 bg-amber-400/15 shadow-[0_0_12px_rgba(251,191,36,0.6)] backdrop-brightness-110 pointer-events-none animate-pulse">
                            <span className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 bg-amber-300" />
                            <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-300" />
                          </div>
                        )}

                        {/* SELECTED / ACTIVE */}
                        {isSelected && (
                          <>
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center">
                              <div className="relative flex items-center justify-center animate-bounce">
                                <MapPin className="w-6 h-6 text-rose-500 fill-rose-600 stroke-amber-200 stroke-[1.5] drop-shadow-[0_2px_8px_rgba(225,29,72,0.9)]" />
                                <div className="absolute top-[5px] w-2 h-2 rounded-full bg-amber-100 shadow-sm" />
                              </div>
                              <div className="w-2.5 h-1 rounded-full bg-black/70 blur-[0.6px] -mt-0.5" />
                            </div>

                            <div className="absolute -inset-1 rounded-md border-2 border-amber-400 bg-amber-400/20 shadow-[0_0_18px_rgba(245,158,11,0.8)] pointer-events-none z-10">
                              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-200" />
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-200" />
                              <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-200" />
                              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-200" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : imageError ? (
            // Fallback if image file is not found
            <div className="w-full h-full relative bg-gradient-to-br from-[#122218] via-[#1a2d21] to-[#0e1712] flex items-center justify-center p-6 text-center">
              <div className="relative z-10 max-w-md bg-[#0c1410]/90 border border-[#b8945f]/50 p-4 rounded-xl shadow-2xl backdrop-blur-sm">
                <Compass className="w-10 h-10 text-amber-400 mx-auto mb-2 animate-pulse" />
                <h3 className="text-sm font-serif font-bold text-amber-200 mb-1">
                  {sectorMeta.nameVi}
                </h3>
                <p className="text-xs text-[#a3b8aa] leading-relaxed mb-3">
                  Đang nạp file ảnh <code className="text-amber-300 font-mono">public{sectorMeta.defaultImage}</code>.
                </p>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer shadow border border-emerald-500/50 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn ảnh ({currentSector}.png) từ máy</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCustomImageUpload(e, currentSector)}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {/* 4. SECTOR LOCK OVERLAY & COMING SOON BANNER (When viewing any of the 4 outer sectors) */}
          {currentSector !== 'center' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 sm:p-6 text-center bg-black/70 backdrop-blur-[2px] select-none pointer-events-auto animate-in fade-in duration-300">
              <div className="relative max-w-sm w-full mx-auto p-5 sm:p-6 rounded-2xl bg-[#120d09]/95 border-2 border-[#b8945f]/70 shadow-[0_12px_36px_rgba(0,0,0,0.9)] flex flex-col items-center">
                {/* Glowing Lock Badge */}
                <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-400/60 flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.35)] mb-3 animate-pulse">
                  <Lock className="w-7 h-7 text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                </div>

                {/* Coming Soon Title */}
                <span className="text-xl sm:text-2xl font-serif font-black tracking-widest text-amber-200 uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                  Coming Soon
                </span>

                {/* Sector Name */}
                <div className="text-sm font-serif font-bold text-[#f2e2ca] mt-1.5 drop-shadow">
                  {sectorMeta.nameVi}
                </div>
                <div className="text-[11px] text-amber-400/80 font-mono mt-0.5">
                  {sectorMeta.nameEn}
                </div>

                {/* Ornamental divider */}
                <div className="w-28 h-px bg-gradient-to-r from-transparent via-[#b8945f]/80 to-transparent my-3.5" />

                {/* Description Text */}
                <p className="text-xs text-[#a99881] leading-relaxed max-w-xs mb-4">
                  Vùng hải đồ này đang được thám hiểm vẽ chi tiết và tạm thời bị khóa. Bạn không thể chọn địa điểm tại đây.
                </p>

                {/* Direct Return Button */}
                <button
                  onClick={() => {
                    setCurrentSector('center');
                    onSelectArea('AREA_CAMP_CLEARING');
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#78350f] via-[#92400e] to-[#78350f] hover:from-[#92400e] hover:to-[#b45309] text-[#fef3c7] font-serif font-bold text-xs uppercase tracking-wider border border-amber-400/60 shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  <span>Trở Về Trại Trung Tâm</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* TACTICAL NAVIGATION ARROWS (CLEAN - ARROWS ONLY) */}
        {/* ========================================================================= */}

        {/* 1. TOP ARROW (NORTH) */}
        {sectorMeta.neighbors.up && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => setCurrentSector(sectorMeta.neighbors.up!.target)}
              title={sectorMeta.neighbors.up.label}
              className="group p-2 rounded-full bg-[#160f09]/90 hover:bg-[#2a1b10] border border-[#d4a359]/80 hover:border-[#fcd34d] text-amber-300 shadow-[0_4px_16px_rgba(0,0,0,0.85)] transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <ChevronUp className="w-5 h-5 text-amber-400 group-hover:-translate-y-0.5 transition-transform animate-bounce" />
            </button>
          </div>
        )}

        {/* 2. BOTTOM ARROW (SOUTH) */}
        {sectorMeta.neighbors.down && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => setCurrentSector(sectorMeta.neighbors.down!.target)}
              title={sectorMeta.neighbors.down.label}
              className="group p-2 rounded-full bg-[#160f09]/90 hover:bg-[#2a1b10] border border-[#d4a359]/80 hover:border-[#fcd34d] text-amber-300 shadow-[0_4px_16px_rgba(0,0,0,0.85)] transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <ChevronDown className="w-5 h-5 text-amber-400 group-hover:translate-y-0.5 transition-transform animate-bounce" />
            </button>
          </div>
        )}

        {/* 3. LEFT ARROW (WEST) */}
        {sectorMeta.neighbors.left && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => setCurrentSector(sectorMeta.neighbors.left!.target)}
              title={sectorMeta.neighbors.left.label}
              className="group p-2 rounded-full bg-[#160f09]/90 hover:bg-[#2a1b10] border border-[#d4a359]/80 hover:border-[#fcd34d] text-amber-300 shadow-[0_4px_16px_rgba(0,0,0,0.85)] transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-amber-400 group-hover:-translate-x-0.5 transition-transform animate-pulse" />
            </button>
          </div>
        )}

        {/* 4. RIGHT ARROW (EAST) */}
        {sectorMeta.neighbors.right && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => setCurrentSector(sectorMeta.neighbors.right!.target)}
              title={sectorMeta.neighbors.right.label}
              className="group p-2 rounded-full bg-[#160f09]/90 hover:bg-[#2a1b10] border border-[#d4a359]/80 hover:border-[#fcd34d] text-amber-300 shadow-[0_4px_16px_rgba(0,0,0,0.85)] transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-0.5 transition-transform animate-pulse" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

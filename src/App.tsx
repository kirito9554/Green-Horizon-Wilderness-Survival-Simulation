import React, { useState, useEffect, useRef } from 'react';
import { GameState, JobPriority, JobType, WeatherType } from './types';
import { 
  INITIAL_GAME_STATE, 
  tickSimulation, 
  startGatheringTask, 
  startCraftingTask, 
  startConstructionTask, 
  launchExpedition,
  addItemToInventory,
  deductItemFromInventory,
  repairToolItem,
  formatTimeOfDay,
  startOrResumeResearch,
  pauseResearch,
  addCraftingQueueItem,
  cancelCraftingQueueItem,
  togglePauseCraftingQueueItem,
  reorderCraftingQueue,
  assignArtisanToQueueItem,
  transferItemBetweenInventories,
  transferAllItems,
  getOrCreatePoiStorage,
  WEATHER_BASELINES,
} from './simulation/simEngine';
import { saveManager } from './save/saveManager';
import { ITEMS_DATABASE } from './data/items';
import { AREAS_DATABASE } from './data/areas';
import { generateRecruitSurvivor } from './data/survivors';

// Layout & Tactical Components
import { TopHeader } from './components/layout/TopHeader';
import { HeaderTacticalHUD } from './components/layout/HeaderTacticalHUD';
import { TacticalWorldMap } from './components/world/TacticalWorldMap';
import { TacticalCenterColumn } from './components/layout/TacticalCenterColumn';
import { TacticalPartyColumn } from './components/layout/TacticalPartyColumn';

// Modals
import { ManageCampModal } from './components/modals/ManageCampModal';
import { InspectLocationModal } from './components/modals/InspectLocationModal';
import { SaveModal } from './components/modals/SaveModal';
import { DevPanel } from './components/modals/DevPanel';
import { ResetConfirmModal } from './components/modals/ResetConfirmModal';

// Encounter System
import { EncounterScreen } from './components/encounter/EncounterScreen';
import { createLeopardEncounter } from './encounter/encounterData';
import { resolveEncounterAction } from './encounter/encounterEngine';
import type { EncounterInstance } from './encounter/encounterTypes';

export default function App() {
  // Initialize from autosave or default initial state
  const [gameState, setGameState] = useState<GameState>(() => {
    const auto = saveManager.loadAutoSave();
    if (auto && auto.survivors && auto.survivors.length > 0) {
      return auto;
    }
    return JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
  });

  const [selectedAreaId, setSelectedAreaId] = useState<string>('AREA_CAMP_CLEARING');
  const [selectedSurvivorId, setSelectedSurvivorId] = useState<string | null>(null);
  
  // Modals state
  const [isManageCampModalOpen, setIsManageCampModalOpen] = useState(false);
  const [isInspectLocationModalOpen, setIsInspectLocationModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Active Tactical Encounter state
  const [activeEncounter, setActiveEncounter] = useState<EncounterInstance | null>(null);
  const previousSpeedRef = useRef<number>(1);

  const handleTriggerDevEncounter = () => {
    const absoluteMinute = (gameState.gameTime.day - 1) * 1440 + gameState.gameTime.minuteOfDay;
    const partyIds = gameState.survivors.slice(0, 4).map((s) => s.id);
    const enc = createLeopardEncounter(absoluteMinute, partyIds);
    if (gameState.gameTime.speed > 0) {
      previousSpeedRef.current = gameState.gameTime.speed;
    }
    setGameState(prev => ({
      ...prev,
      gameTime: { ...prev.gameTime, speed: 0 },
    }));
    setActiveEncounter(enc);
    setIsDevPanelOpen(false);
  };

  const handleEncounterAction = (actionId: string) => {
    if (!activeEncounter) return;
    const resolved = resolveEncounterAction(activeEncounter, gameState, actionId);
    if (!resolved) return;
    setActiveEncounter(resolved.encounter);
    setGameState(resolved.gameState);
  };

  const handleExitEncounter = () => {
    setActiveEncounter(null);
    setGameState(prev => ({
      ...prev,
      gameTime: { ...prev.gameTime, speed: previousSpeedRef.current || 1 },
    }));
  };

  // Support direct query param ?encounter=1 without full page reload
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('encounter') === '1') {
      params.delete('encounter');
      const newRelative = window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + window.location.hash;
      window.history.replaceState(null, '', newRelative);
      handleTriggerDevEncounter();
    }
  }, []);

  // Keep ref to gameState for simulation tick and interval
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  // Real-time Simulation Engine Loop (Ticks every 1000ms real-time)
  useEffect(() => {
    let lastTime = Date.now();
    let autosaveCounter = 0;

    const interval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.min(2, (now - lastTime) / 1000);
      lastTime = now;

      const current = stateRef.current;
      if (current.gameTime.speed > 0) {
        const nextState = tickSimulation(current, deltaSeconds);
        setGameState(nextState);

        // Autosave every ~30 seconds of active simulation
        autosaveCounter += deltaSeconds;
        if (autosaveCounter >= 30) {
          autosaveCounter = 0;
          saveManager.autoSave(nextState);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handlers for Simulation State Modifications
  const handleSetSpeed = (speed: 0 | 1 | 2 | 4) => {
    setGameState(prev => ({
      ...prev,
      gameTime: {
        ...prev.gameTime,
        speed,
      },
    }));
  };

  const handleStartGathering = (survivorId: string, nodeId: string, targetAreaId?: string) => {
    setGameState(prev => startGatheringTask(prev, survivorId, nodeId, targetAreaId));
  };

  const handleTransferItem = (
    areaId: string,
    instanceId: string,
    quantity: number,
    direction: 'party_to_poi' | 'poi_to_party'
  ) => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as GameState;
      const poiStorage = getOrCreatePoiStorage(next, areaId);
      const source = direction === 'party_to_poi' ? next.inventory : poiStorage;
      const target = direction === 'party_to_poi' ? poiStorage : next.inventory;

      const res = transferItemBetweenInventories(source, target, instanceId, quantity);
      const areaName = AREAS_DATABASE[areaId]?.name || 'kho bãi POI';
      const log = {
        id: `tr_${Date.now()}_${Math.random()}`,
        day: prev.gameTime.day,
        timeStr: formatTimeOfDay(prev.gameTime.minuteOfDay),
        text: direction === 'party_to_poi'
          ? `[Cất đồ] ${res.message} ➔ Kho bãi ${areaName}`
          : `[Rút đồ] ${res.message} ➔ Túi hành trang`,
        type: (res.success ? 'info' : 'warning') as 'info' | 'warning',
      };

      return {
        ...next,
        logs: [log, ...next.logs.slice(0, 34)],
      };
    });
  };

  const handleTransferAllItems = (
    areaId: string,
    direction: 'party_to_poi' | 'poi_to_party'
  ) => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as GameState;
      const poiStorage = getOrCreatePoiStorage(next, areaId);
      const source = direction === 'party_to_poi' ? next.inventory : poiStorage;
      const target = direction === 'party_to_poi' ? poiStorage : next.inventory;

      const res = transferAllItems(source, target);
      const areaName = AREAS_DATABASE[areaId]?.name || 'kho bãi POI';
      const log = {
        id: `tr_all_${Date.now()}_${Math.random()}`,
        day: prev.gameTime.day,
        timeStr: formatTimeOfDay(prev.gameTime.minuteOfDay),
        text: direction === 'party_to_poi'
          ? `[Dỡ kho] Đã dỡ đồ vào Kho bãi ${areaName}: ${res.message}`
          : `[Lấy đồ] Đã lấy đồ từ Kho bãi ${areaName} vào túi: ${res.message}`,
        type: (res.success ? 'success' : 'warning') as 'success' | 'warning',
      };

      return {
        ...next,
        logs: [log, ...next.logs.slice(0, 34)],
      };
    });
  };

  const handleStartPoiConstruction = (survivorId: string, buildingId: string, areaId: string) => {
    setGameState(prev => startConstructionTask(prev, survivorId, buildingId, areaId));
  };

  const handleStartCrafting = (survivorId: string, recipeId: string) => {
    setGameState(prev => startCraftingTask(prev, survivorId, recipeId));
  };

  const handleStartResearch = (recipeId: string, survivorId: string) => {
    setGameState(prev => startOrResumeResearch(prev, recipeId, survivorId));
  };

  const handlePauseResearch = (recipeId: string) => {
    setGameState(prev => pauseResearch(prev, recipeId));
  };

  const handleAddToCraftingQueue = (recipeId: string, quantity: number, assignedSurvivorId?: string) => {
    setGameState(prev => addCraftingQueueItem(prev, recipeId, quantity, assignedSurvivorId));
  };

  const handleCancelQueueItem = (queueItemId: string) => {
    setGameState(prev => cancelCraftingQueueItem(prev, queueItemId));
  };

  const handleTogglePauseQueueItem = (queueItemId: string) => {
    setGameState(prev => togglePauseCraftingQueueItem(prev, queueItemId));
  };

  const handleReorderQueue = (queueItemId: string, direction: 'up' | 'down') => {
    setGameState(prev => reorderCraftingQueue(prev, queueItemId, direction));
  };

  const handleAssignSurvivorToQueue = (queueItemId: string, survivorId?: string) => {
    setGameState(prev => assignArtisanToQueueItem(prev, queueItemId, survivorId));
  };

  const handleStartConstruction = (survivorId: string, buildingId: string) => {
    setGameState(prev => startConstructionTask(prev, survivorId, buildingId));
  };

  const handleLaunchExpedition = (
    areaId: string, 
    survivorIds: string[], 
    rationItemId?: string, 
    waterContainerItemId?: string
  ) => {
    setGameState(prev => launchExpedition(prev, areaId, survivorIds, rationItemId, waterContainerItemId));
  };

  const handleRestSurvivor = (survivorId: string) => {
    setGameState(prev => ({
      ...prev,
      survivors: prev.survivors.map(s => {
        if (s.id === survivorId) {
          return {
            ...s,
            currentAction: {
              type: 'resting',
              description: 'Đang ngủ nghỉ hồi phục thể lực',
              progressSeconds: 0,
              totalSeconds: 30,
            },
          };
        }
        return s;
      }),
    }));
  };

  const handleConsumeItem = (instanceId: string, targetSurvivorId?: string) => {
    setGameState(prev => {
      const item = prev.inventory.items.find(i => i.instanceId === instanceId);
      if (!item) return prev;

      const def = ITEMS_DATABASE[item.itemId];
      if (!def) return prev;

      const survivor = prev.survivors.find(s => s.id === (targetSurvivorId || prev.survivors[0]?.id));
      if (!survivor) return prev;

      // Calculate nutrition/hydration benefits
      const calories = def.nutrition?.calories || (def.category === 'food' ? 200 : 0);
      const hydration = def.nutrition?.hydration || (def.category === 'water' ? 300 : 0);

      // Deduct 1 item
      const newInventory = JSON.parse(JSON.stringify(prev.inventory));
      deductItemFromInventory(newInventory, item.itemId, 1);

      // Update survivor stats
      const updatedSurvivors = prev.survivors.map(s => {
        if (s.id === survivor.id) {
          return {
            ...s,
            hunger: Math.max(0, s.hunger - (calories / 15)),
            thirst: Math.max(0, s.thirst - (hydration / 12)),
            morale: Math.min(100, s.morale + 5),
            health: Math.min(100, s.health + 2),
          };
        }
        return s;
      });

      if (item.itemId === 'ITEM_OPEN_COCONUT' || item.itemId === 'ITEM_BOILED_WATER_BOWL') {
        addItemToInventory(newInventory, 'ITEM_COCONUT_BOWL', 1);
      }

      const logEntry = {
        id: `log_${Date.now()}_${Math.random()}`,
        day: prev.gameTime.day,
        timeStr: formatTimeOfDay(prev.gameTime.minuteOfDay),
        text: `${survivor.name} đã dùng 1 ${def.name}.`,
        type: 'info' as const,
      };

      return {
        ...prev,
        inventory: newInventory,
        survivors: updatedSurvivors,
        logs: [logEntry, ...prev.logs.slice(0, 34)],
      };
    });
  };

  const handleDiscardItem = (instanceId: string, quantity: number) => {
    setGameState(prev => {
      const item = prev.inventory.items.find(i => i.instanceId === instanceId);
      if (!item) return prev;

      const newInv = JSON.parse(JSON.stringify(prev.inventory));
      deductItemFromInventory(newInv, item.itemId, quantity);
      const def = ITEMS_DATABASE[item.itemId];

      const log = {
        id: `log_${Date.now()}_${Math.random()}`,
        day: prev.gameTime.day,
        timeStr: formatTimeOfDay(prev.gameTime.minuteOfDay),
        text: `Đã loại bỏ ${quantity}x ${def ? def.name : item.itemId} khỏi túi hành trang.`,
        type: 'warning' as const,
      };

      return {
        ...prev,
        inventory: newInv,
        logs: [log, ...prev.logs.slice(0, 34)],
      };
    });
  };

  const handleRepairItem = (instanceId: string) => {
    setGameState(prev => {
      const newInv = JSON.parse(JSON.stringify(prev.inventory));
      const res = repairToolItem(newInv, instanceId);
      const log = {
        id: `log_${Date.now()}_${Math.random()}`,
        day: prev.gameTime.day,
        timeStr: formatTimeOfDay(prev.gameTime.minuteOfDay),
        text: res.message,
        type: (res.success ? 'success' : 'warning') as 'success' | 'warning',
      };
      return {
        ...prev,
        inventory: newInv,
        logs: [log, ...prev.logs.slice(0, 34)],
      };
    });
  };

  const handleUpdateJobPriority = (survivorId: string, job: JobType, priority: JobPriority) => {
    setGameState(prev => ({
      ...prev,
      survivors: prev.survivors.map(s => {
        if (s.id === survivorId) {
          return {
            ...s,
            jobPriorities: {
              ...s.jobPriorities,
              [job]: priority,
            },
          };
        }
        return s;
      }),
    }));
  };

  const handleUpdatePolicy = (policyKey: 'foodPolicy' | 'waterPolicy', value: 'ration' | 'normal' | 'generous') => {
    setGameState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [policyKey]: value,
      },
    }));
  };

  const handleUpdateSurvivorPortrait = (survivorId: string, portraitIndex: number) => {
    setGameState(prev => ({
      ...prev,
      survivors: prev.survivors.map(s => (s.id === survivorId ? { ...s, portraitIndex } : s)),
    }));
  };

  const handleRecruitSurvivor = () => {
    setGameState(prev => {
      if (prev.survivors.length >= 4) return prev;
      const newSurvivor = generateRecruitSurvivor(prev.survivors);
      const logEntry = {
        id: `log_${Date.now()}_${Math.random()}`,
        day: prev.gameTime.day,
        timeStr: formatTimeOfDay(prev.gameTime.minuteOfDay),
        text: `Người sống sót mới ${newSurvivor.name} (${newSurvivor.role}) đã gia nhập đội nhóm!`,
        type: 'success' as const,
      };
      const updated = {
        ...prev,
        survivors: [...prev.survivors, newSurvivor],
        logs: [logEntry, ...prev.logs.slice(0, 34)],
      };
      saveManager.autoSave(updated);
      return updated;
    });
  };

  const handleOpenResetModal = () => {
    setIsResetConfirmOpen(true);
  };

  const handleResetNewRun = () => {
    const fresh = saveManager.resetGame();
    setGameState(fresh);
    setSelectedSurvivorId(fresh.survivors[0]?.id || null);
    setSelectedAreaId('AREA_CAMP_CLEARING');
    saveManager.autoSave(fresh);
  };

  const handleResetAllData = () => {
    saveManager.clearAllData();
    const fresh = saveManager.resetGame();
    setGameState(fresh);
    setSelectedSurvivorId(fresh.survivors[0]?.id || null);
    setSelectedAreaId('AREA_CAMP_CLEARING');
    saveManager.autoSave(fresh);
  };

  // Dev Sandbox Handlers
  const handleDevAddResource = (itemId: string, quantity: number) => {
    setGameState(prev => {
      const nextInv = JSON.parse(JSON.stringify(prev.inventory));
      addItemToInventory(nextInv, itemId, quantity);
      return {
        ...prev,
        inventory: nextInv,
      };
    });
  };

  const handleDevFastForward = (hours: number) => {
    setGameState(prev => {
      let current = prev;
      for (let i = 0; i < hours * 60; i++) {
        current = tickSimulation(current, 1);
      }
      return current;
    });
  };

  const handleDevHealAll = () => {
    setGameState(prev => ({
      ...prev,
      survivors: prev.survivors.map(s => ({
        ...s,
        health: 100,
        hunger: 0,
        thirst: 0,
        fatigue: 0,
        morale: 100,
      })),
    }));
  };

  const handleDevChangeWeather = (weather: WeatherType) => {
    const base = WEATHER_BASELINES[weather] || WEATHER_BASELINES.clear;
    setGameState(prev => ({
      ...prev,
      weather: {
        ...prev.weather,
        previous: prev.weather.current,
        current: weather,
        next: weather === 'clear' ? 'cloudy' : 'clear',
        temperatureC: base.temperatureC,
        humidityPercent: base.humidityPercent,
        rainIntensity: base.rainIntensity,
        cloudCover: base.cloudCover,
        totalDurationMinutes: 180,
        durationRemainingMinutes: 180,
        transitionProgress: 0,
        wind: {
          speedKmh: base.windSpeedKmh,
          gustKmh: Math.round(base.windSpeedKmh * 1.3),
          directionDeg: base.windDirectionDeg,
          cardinal: 'NE',
        },
      },
    }));
  };

  const selectedArea = AREAS_DATABASE[selectedAreaId] || AREAS_DATABASE.AREA_CAMP_CLEARING;

  return (
    <div className="relative flex items-center justify-center h-screen w-screen overflow-hidden bg-[#070b08] text-[#e5dbc8] font-sans select-none">
      {/* 16:9 Aspect-Locked Tactical Canvas Container */}
      <div 
        className="relative overflow-hidden shadow-2xl bg-center bg-no-repeat"
        style={{ 
          width: '100vw',
          height: '56.25vw',
          maxWidth: '177.7778vh',
          maxHeight: '100vh',
          backgroundImage: "url('/UI-BG.png')", 
          backgroundSize: '100% 100%' 
        }}
      >
        {/* 1. Top Header Bar (Action buttons: Fullscreen, Menu, etc.) */}
        <div className="absolute top-0 left-0 w-full h-[11%] z-20 pointer-events-none">
          <TopHeader
            state={gameState}
            onSetSpeed={handleSetSpeed}
            onOpenSaveModal={() => setIsSaveModalOpen(true)}
            onToggleDevPanel={() => setIsDevPanelOpen(!isDevPanelOpen)}
            onResetGame={handleOpenResetModal}
          />
        </div>

        {/* 1.1 Tactical HUD (Separated from Header, Layered above header with z-30 to avoid clipping) */}
        <div className="absolute left-[18.4%] top-[0.3%] w-[61.6%] h-[10.6%] z-30 pointer-events-auto overflow-visible">
          <HeaderTacticalHUD
            weather={gameState.weather}
            gameTime={gameState.gameTime}
          />
        </div>

        {/* 2. Left Column: Tactical World Map (Pinned precisely inside the large wooden frame) */}
        <div className={`absolute left-[1.7%] top-[10.9%] w-[54.9%] h-[86.4%] z-10 ${activeEncounter ? 'hidden' : 'flex'}`}>
          <TacticalWorldMap
            state={gameState}
            areas={AREAS_DATABASE}
            selectedAreaId={selectedAreaId}
            onSelectArea={(id) => setSelectedAreaId(id)}
          />
        </div>

        {/* 3. Middle Column: Camp, Location, Inventory (15 slots), Log (Pinned over the 4 center frames) */}
        <div className={`absolute left-[57.9%] top-[10.9%] w-[27.2%] h-[86.4%] z-10 ${activeEncounter ? 'hidden' : 'flex'}`}>
          <TacticalCenterColumn
            state={gameState}
            selectedArea={selectedArea}
            onOpenManageCamp={() => setIsManageCampModalOpen(true)}
            onOpenInspectLocation={() => setIsInspectLocationModalOpen(true)}
            onConsumeItem={handleConsumeItem}
            onDiscardItem={handleDiscardItem}
            onRepairItem={handleRepairItem}
            onUnloadToPoiStorage={(areaId) => handleTransferAllItems(areaId, 'party_to_poi')}
            onQuickGather={(nodeId) => {
              const leadId = selectedSurvivorId || gameState.survivors[0]?.id;
              if (leadId) handleStartGathering(leadId, nodeId);
            }}
          />
        </div>

        {/* Tactical Encounter Layer (Rendered smoothly over map and center column with 0 reload) */}
        {activeEncounter && (
          <EncounterScreen
            encounter={activeEncounter}
            state={gameState}
            onChooseAction={handleEncounterAction}
          />
        )}

        {/* 4. Right Column: Party Leader & 3 Recruit Slots (Pinned over the right column frames) */}
        <div className="absolute left-[85.9%] top-[10.9%] w-[13.0%] h-[86.4%] z-10 flex">
          <TacticalPartyColumn
            state={gameState}
            selectedSurvivorId={selectedSurvivorId}
            onSelectSurvivor={(id) => setSelectedSurvivorId(id)}
            onRestSurvivor={handleRestSurvivor}
            onOpenSurvivorManagement={() => setIsManageCampModalOpen(true)}
            onRecruitSurvivor={handleRecruitSurvivor}
          />
        </div>

        {/* Encounter Completion Modal Overlay */}
        {activeEncounter?.completed && (
          <div className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
            <div className="w-[420px] rounded-md border-2 border-[#8b633d] bg-[#092723]/95 p-5 text-center shadow-2xl">
              <div className="text-[11px] uppercase tracking-[.16em] text-[#9eaf9f]">Cuộc chạm trán kết thúc</div>
              <h2 className="text-[22px] font-black text-[#f0dfc2] mt-1">Con đường trở lại yên tĩnh</h2>
              <p className="text-[13px] text-[#c9bea9] mt-2">{activeEncounter.completionReason || 'Mối đe dọa trước mắt đã qua đi.'}</p>
              <button
                onClick={handleExitEncounter}
                className="mt-5 px-6 py-2 rounded bg-[#285b3e] border border-[#61a572] hover:bg-[#33714d] text-[#f4ead8] font-bold text-[12px] cursor-pointer transition-colors shadow-lg"
              >
                Trở lại bản đồ thế giới
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Camp Management Modal (Buildings, Crafting, Survivor Priorities) */}
      <ManageCampModal
        isOpen={isManageCampModalOpen}
        onClose={() => setIsManageCampModalOpen(false)}
        state={gameState}
        onStartConstruction={handleStartConstruction}
        onStartCrafting={handleStartCrafting}
        onStartResearch={handleStartResearch}
        onPauseResearch={handlePauseResearch}
        onAddToCraftingQueue={handleAddToCraftingQueue}
        onCancelQueueItem={handleCancelQueueItem}
        onTogglePauseQueueItem={handleTogglePauseQueueItem}
        onReorderQueue={handleReorderQueue}
        onAssignSurvivorToQueue={handleAssignSurvivorToQueue}
        onUpdateJobPriority={handleUpdateJobPriority}
        onUpdatePolicy={handleUpdatePolicy}
        onUpdatePortrait={handleUpdateSurvivorPortrait}
        onRecruitSurvivor={handleRecruitSurvivor}
      />

      {/* 4. Inspect Location Modal (Field Recon Dossier: Ecology, natural resource nodes, field operations) */}
      <InspectLocationModal
        isOpen={isInspectLocationModalOpen}
        onClose={() => setIsInspectLocationModalOpen(false)}
        area={selectedArea}
        state={gameState}
        onStartGathering={(survivorId, nodeId, targetAreaId) => handleStartGathering(survivorId, nodeId, targetAreaId)}
        onLaunchExpedition={(areaId, survivorIds) => handleLaunchExpedition(areaId, survivorIds)}
        onTransferItem={handleTransferItem}
        onTransferAll={handleTransferAllItems}
        onStartPoiConstruction={handleStartPoiConstruction}
        onOpenManageCamp={() => {
          setIsInspectLocationModalOpen(false);
          setIsManageCampModalOpen(true);
        }}
      />

      {/* 5. Save/Load Modal */}
      <SaveModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        currentState={gameState}
        onLoadState={(loaded) => setGameState(loaded)}
        onOpenResetConfirm={handleOpenResetModal}
      />

      {/* 6. Dev Sandbox Tools Modal */}
      <DevPanel
        isOpen={isDevPanelOpen}
        onClose={() => setIsDevPanelOpen(false)}
        onAddResource={handleDevAddResource}
        onFastForwardHours={handleDevFastForward}
        onHealAllSurvivors={handleDevHealAll}
        onChangeWeather={handleDevChangeWeather}
        onTriggerEncounter={handleTriggerDevEncounter}
      />

      {/* 7. Reset Game Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirmResetNewRun={handleResetNewRun}
        onConfirmResetAllData={handleResetAllData}
      />
    </div>
  );
}

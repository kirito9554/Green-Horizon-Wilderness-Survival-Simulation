import React, { useState } from 'react';
import type { GameState } from './types';
import { INITIAL_GAME_STATE } from './simulation/simEngine';
import { saveManager } from './save/saveManager';
import { TopHeader } from './components/layout/TopHeader';
import { TacticalPartyColumn } from './components/layout/TacticalPartyColumn';
import { EncounterScreen } from './components/encounter/EncounterScreen';
import { createLeopardEncounter } from './encounter/encounterData';
import { resolveEncounterAction } from './encounter/encounterEngine';

export default function EncounterDemoApp() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const auto = saveManager.loadAutoSave();
    const base = auto && auto.survivors?.length > 0
      ? auto
      : (JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState);
    return {
      ...base,
      gameTime: { ...base.gameTime, speed: 0 },
    };
  });

  const [selectedSurvivorId, setSelectedSurvivorId] = useState<string | null>(gameState.survivors[0]?.id || null);
  const [encounter, setEncounter] = useState(() => {
    const absoluteMinute = (gameState.gameTime.day - 1) * 1440 + gameState.gameTime.minuteOfDay;
    return createLeopardEncounter(absoluteMinute, gameState.survivors.slice(0, 4).map((s) => s.id));
  });

  const handleAction = (actionId: string) => {
    const resolved = resolveEncounterAction(encounter, gameState, actionId);
    if (!resolved) return;
    setEncounter(resolved.encounter);
    setGameState(resolved.gameState);
  };

  const exitEncounter = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('encounter');
    window.location.href = `${url.pathname}${url.search}${url.hash}`;
  };

  return (
    <div className="relative flex items-center justify-center h-screen w-screen overflow-hidden bg-[#070b08] text-[#e5dbc8] font-sans select-none">
      <div
        className="relative overflow-hidden shadow-2xl bg-center bg-no-repeat"
        style={{
          width: '100vw',
          height: '56.25vw',
          maxWidth: '177.7778vh',
          maxHeight: '100vh',
          backgroundImage: "url('/UI-BG.png')",
          backgroundSize: '100% 100%',
        }}
      >
        <div className="absolute top-0 left-0 w-full h-[9.6%] z-30">
          <TopHeader
            state={gameState}
            onSetSpeed={() => {}}
            onOpenSaveModal={() => {}}
            onToggleDevPanel={() => {}}
            onResetGame={() => {}}
          />
        </div>

        <EncounterScreen encounter={encounter} state={gameState} onChooseAction={handleAction} />

        <div className="absolute left-[85.9%] top-[10.9%] w-[13.0%] h-[86.4%] z-30 flex">
          <TacticalPartyColumn
            state={gameState}
            selectedSurvivorId={selectedSurvivorId}
            onSelectSurvivor={setSelectedSurvivorId}
            onRestSurvivor={() => {}}
            onOpenSurvivorManagement={() => {}}
            onRecruitSurvivor={() => {}}
          />
        </div>

        {encounter.completed && (
          <div className="absolute inset-0 z-40 bg-black/45 flex items-center justify-center backdrop-blur-[1px]">
            <div className="w-[420px] rounded-md border-2 border-[#8b633d] bg-[#092723]/95 p-5 text-center shadow-2xl">
              <div className="text-[11px] uppercase tracking-[.16em] text-[#9eaf9f]">Encounter Complete</div>
              <h2 className="text-[24px] font-black text-[#f0dfc2] mt-1">The trail falls quiet.</h2>
              <p className="text-[13px] text-[#c9bea9] mt-2">{encounter.completionReason || 'The immediate danger has passed.'}</p>
              <button
                onClick={exitEncounter}
                className="mt-5 px-6 py-2 rounded bg-[#285b3e] border border-[#61a572] hover:bg-[#33714d] text-[#f4ead8] font-bold text-[12px]"
              >
                Return to World Map
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

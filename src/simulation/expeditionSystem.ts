import { GameState, ActiveExpedition } from '../types';
import { AREAS_DATABASE } from '../data/areas';
import { addItemToInventory, deductItemFromInventory } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';

export function tickExpeditions(next: GameState, deltaGameMinutes: number): void {
  for (let i = next.expeditions.length - 1; i >= 0; i--) {
    const exp = next.expeditions[i];
    exp.progressMinutes += deltaGameMinutes;

    const halfway = exp.totalMinutes / 2;
    if (exp.phase === 'travel_out' && exp.progressMinutes >= halfway * 0.4) {
      exp.phase = 'exploring';
      // Roll for exploration discovery
      const area = AREAS_DATABASE[exp.areaId];
      if (area && exp.collectedLoot.length === 0) {
        // Collect samples from area
        for (const node of area.nodes) {
          if (Math.random() < 0.75) {
            const yieldCount = Math.floor(Math.random() * (node.maxYield - node.minYield + 1)) + node.minYield;
            exp.collectedLoot.push({ itemId: node.itemId, quantity: yieldCount });
          }
        }
        // Expand knowledge %
        if (!next.areasProgress[exp.areaId]) {
          next.areasProgress[exp.areaId] = { knowledgePercent: 0, lastGatheredTime: {} };
        }
        next.areasProgress[exp.areaId].knowledgePercent = Math.min(
          100, 
          next.areasProgress[exp.areaId].knowledgePercent + exp.knowledgeGained
        );
      }
    } else if (exp.phase === 'exploring' && exp.progressMinutes >= halfway) {
      exp.phase = 'travel_back';
    } else if (exp.progressMinutes >= exp.totalMinutes) {
      // Expedition returned!
      const area = AREAS_DATABASE[exp.areaId];
      // Deliver loot to inventory
      let totalLootCount = 0;
      for (const loot of exp.collectedLoot) {
        addItemToInventory(next.inventory, loot.itemId, loot.quantity);
        totalLootCount += loot.quantity;
      }

      // Free survivors
      for (const sId of exp.survivorIds) {
        const s = next.survivors.find(sv => sv.id === sId);
        if (s) {
          s.currentAction = {
            type: 'idle',
            description: 'Returned safely from expedition',
            progressSeconds: 0,
            totalSeconds: 0,
          };
          s.fatigue = Math.min(100, s.fatigue + 25);
          s.skills.exploration = (s.skills.exploration || 1) + 0.15;
        }
      }

      next.logs.unshift({
        id: `exp_return_${Date.now()}`,
        day: next.gameTime.day,
        timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
        text: `Expedition returned safely from ${area ? area.name : 'Interior'} with ${totalLootCount} resources! Knowledge increased by +${exp.knowledgeGained}%.`,
        type: 'success',
      });

      next.expeditions.splice(i, 1);
    }
  }
}

export function launchExpedition(
  state: GameState, 
  areaId: string, 
  survivorIds: string[], 
  rationItemId?: string, 
  waterContainerItemId?: string
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const area = AREAS_DATABASE[areaId];
  if (!area || survivorIds.length === 0) return state;

  // Deduct ration and water if provided
  if (rationItemId) {
    deductItemFromInventory(next.inventory, rationItemId, survivorIds.length);
  }
  if (waterContainerItemId) {
    deductItemFromInventory(next.inventory, waterContainerItemId, survivorIds.length);
  }

  // Set all assigned survivors to on_expedition
  for (const sId of survivorIds) {
    const s = next.survivors.find(sv => sv.id === sId);
    if (s) {
      s.currentAction = {
        type: 'on_expedition',
        description: `Thám hiểm ${area.name}`,
        targetId: areaId,
        progressSeconds: 0,
        totalSeconds: area.baseTravelMinutes * 60 * 2,
      };
    }
  }

  const newExpedition: ActiveExpedition = {
    id: `exp_${Date.now()}`,
    areaId,
    survivorIds,
    rationItemId,
    rationCount: rationItemId ? survivorIds.length : 0,
    waterContainerItemId,
    waterCount: waterContainerItemId ? survivorIds.length : 0,
    equippedToolIds: [],
    totalMinutes: area.baseTravelMinutes * 2,
    progressMinutes: 0,
    phase: 'travel_out',
    collectedLoot: [],
    eventLog: [`Đoàn thám hiểm gồm ${survivorIds.length} người rời trại chính hướng đến ${area.name}.`],
    knowledgeGained: 25,
  };

  next.expeditions.push(newExpedition);

  next.logs.unshift({
    id: `exp_start_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `Đội thám hiểm (${survivorIds.length} người) đã xuất phát tiến về ${area.name}.`,
    type: 'info',
  });

  return next;
}

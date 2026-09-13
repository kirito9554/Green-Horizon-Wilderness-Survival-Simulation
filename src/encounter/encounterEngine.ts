import type { GameState, SurvivorState } from '../types';
import { ITEMS_DATABASE } from '../data/items';
import { deductItemFromInventory } from '../simulation/inventorySystem';
import { formatTimeOfDay } from '../simulation/timeSystem';
import { LEOPARD_ACTIONS } from './encounterData';
import type {
  EncounterActionDefinition,
  EncounterActionView,
  EncounterInstance,
  EncounterOutcomeTier,
  EncounterResolution,
  EncounterStateDelta,
} from './encounterTypes';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRoll(seed: number): number {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 10000) / 100;
}

function getLead(encounter: EncounterInstance, state: GameState): SurvivorState | undefined {
  const leadId = encounter.partyIds[0];
  return state.survivors.find((survivor) => survivor.id === leadId) || state.survivors[0];
}

function hasDistractingFood(state: GameState): boolean {
  return state.inventory.items.some((item) => {
    if (item.quantity <= 0) return false;
    const def = ITEMS_DATABASE[item.itemId];
    if (!def) return false;
    return def.category === 'food' && (def.tags.includes('meat') || def.tags.includes('edible'));
  });
}

function consumeDistractingFood(state: GameState): void {
  const item = state.inventory.items.find((entry) => {
    const def = ITEMS_DATABASE[entry.itemId];
    return entry.quantity > 0 && !!def && def.category === 'food' && (def.tags.includes('meat') || def.tags.includes('edible'));
  });
  if (item) deductItemFromInventory(state.inventory, item.itemId, 1);
}

export function calculateEncounterChance(
  encounter: EncounterInstance,
  action: EncounterActionDefinition,
  state: GameState,
): number {
  if (action.onlyWhenSafe) return isEncounterSafe(encounter) ? 100 : 0;

  const lead = getLead(encounter, state);
  const skill = lead && action.primarySkill ? (lead.skills[action.primarySkill] || 0) : 0;
  const skillModifier = skill * (action.skillWeight || 1) * 2;
  const knowledgeModifier = encounter.knowledge.total * 0.09;
  const fatiguePenalty = (lead?.fatigue || 0) * 0.11;
  const moraleModifier = ((lead?.morale || 50) - 50) * 0.06;
  const panicPenalty = encounter.state.partyPanic * 0.09;
  const aggressionPenalty = encounter.state.aggression * 0.08;
  const distanceModifier = (encounter.state.distance - 10) * 0.7;
  const escapeModifier = encounter.state.escapeRoute * 0.035;
  const threatPenalty = Math.max(0, encounter.state.playerThreat - 35) * 0.05;

  let situational = 0;
  if (action.id === 'stay_calm') situational += (100 - encounter.state.alertness) * 0.025;
  if (action.id === 'back_away') situational += distanceModifier + escapeModifier;
  if (action.id === 'observe') situational += (100 - encounter.state.alertness) * 0.035;
  if (action.id === 'defend') situational += (lead?.skills.hunting || 0) * 1.5 - encounter.state.aggression * 0.04;
  if (action.id === 'distract_food') situational += encounter.state.hunger * 0.12 - encounter.state.territoriality * 0.07;

  return clamp(
    Math.round(
      action.baseChance
      + skillModifier
      + knowledgeModifier
      + moraleModifier
      + situational
      - fatiguePenalty
      - panicPenalty
      - aggressionPenalty
      - threatPenalty,
    ),
    5,
    95,
  );
}

function estimateChance(chance: number, knowledge: number): string {
  if (knowledge < 20) {
    if (chance >= 70) return 'Good chance';
    if (chance >= 45) return 'Moderate chance';
    return 'Poor chance';
  }
  if (knowledge < 45) {
    const lo = Math.max(5, Math.floor((chance - 10) / 5) * 5);
    const hi = Math.min(95, Math.ceil((chance + 10) / 5) * 5);
    return `${lo}–${hi}%`;
  }
  if (knowledge < 70) {
    return `${Math.max(5, chance - 4)}–${Math.min(95, chance + 4)}%`;
  }
  return `${chance}%`;
}

export function getEncounterActions(encounter: EncounterInstance, state: GameState): EncounterActionView[] {
  return LEOPARD_ACTIONS
    .filter((action) => !action.onlyWhenSafe || isEncounterSafe(encounter))
    .map((action) => {
      const chance = calculateEncounterChance(encounter, action, state);
      let disabled = false;
      let disabledReason: string | undefined;
      if (action.requiresFood && !hasDistractingFood(state)) {
        disabled = true;
        disabledReason = 'Requires edible food or meat in party inventory.';
      }
      return {
        ...action,
        chance,
        estimate: estimateChance(chance, encounter.knowledge.total),
        disabled,
        disabledReason,
      };
    });
}

function getOutcomeTier(roll: number, chance: number): EncounterOutcomeTier {
  const margin = chance - roll;
  if (roll <= 5 || margin >= 28) return 'strong_success';
  if (roll <= chance) return 'success';
  if (margin >= -12) return 'partial_success';
  if (roll >= 96 || margin <= -35) return 'critical_failure';
  return 'failure';
}

function applyDelta(encounter: EncounterInstance, state: GameState, delta: EncounterStateDelta): void {
  const lead = getLead(encounter, state);
  const stateKeys: Array<keyof EncounterInstance['state']> = [
    'distance', 'alertness', 'aggression', 'fear', 'hunger', 'territoriality',
    'injury', 'escapeRoute', 'playerThreat', 'noise', 'partyPanic', 'escalation',
  ];

  for (const key of stateKeys) {
    const amount = delta[key];
    if (typeof amount !== 'number') continue;
    if (key === 'distance') encounter.state.distance = clamp(encounter.state.distance + amount, 0, 80);
    else encounter.state[key] = clamp(encounter.state[key] + amount, 0, 100);
  }

  if (typeof delta.knowledge === 'number') {
    encounter.knowledge.total = clamp(encounter.knowledge.total + delta.knowledge, 0, 100);
    encounter.knowledge.behavior = clamp(encounter.knowledge.behavior + delta.knowledge * 0.8, 0, 100);
    encounter.knowledge.species = clamp(encounter.knowledge.species + delta.knowledge * 0.45, 0, 100);
    encounter.knowledge.terrain = clamp(encounter.knowledge.terrain + delta.knowledge * 0.3, 0, 100);
  }

  if (lead) {
    if (typeof delta.leadHealth === 'number') lead.health = clamp(lead.health + delta.leadHealth, 0, 100);
    if (typeof delta.leadFatigue === 'number') lead.fatigue = clamp(lead.fatigue + delta.leadFatigue, 0, 100);
    if (typeof delta.leadMorale === 'number') lead.morale = clamp(lead.morale + delta.leadMorale, 0, 100);
  }
}

export function isEncounterSafe(encounter: EncounterInstance): boolean {
  return (
    encounter.state.distance >= 20
    || encounter.state.aggression <= 22
    || encounter.state.fear >= 62
    || encounter.state.escalation <= 22
  );
}

function describeResolution(actionId: string, outcome: EncounterOutcomeTier, encounter: EncounterInstance): string {
  if (actionId === 'leave_area') return 'You withdraw from the trail without further provoking the animal.';
  const positive = outcome === 'strong_success' || outcome === 'success';
  const partial = outcome === 'partial_success';

  if (actionId === 'stay_calm') {
    if (positive) return 'Your stillness lowers the tension. The leopard eases its posture and stops pressing forward.';
    if (partial) return 'It hesitates, but keeps watching you closely.';
    return 'A sudden movement reads as a challenge. The leopard stiffens and growls louder.';
  }
  if (actionId === 'back_away') {
    if (positive) return 'You give ground smoothly without triggering pursuit.';
    if (partial) return 'You gain a little distance, but the leopard follows a few steps.';
    return 'The retreat breaks down and the leopard closes the gap.';
  }
  if (actionId === 'observe') {
    if (positive) return 'You read the animal clearly: territorial, alert, and still leaving itself an escape route.';
    if (partial) return 'You learn something useful, but it notices your attention.';
    return 'You linger too long. Its focus locks onto the party.';
  }
  if (actionId === 'distract_food') {
    if (positive) return 'The thrown food pulls its attention away long enough to create space.';
    if (partial) return 'It glances toward the food, but does not fully commit.';
    return 'The food fails to break its territorial focus.';
  }
  if (actionId === 'defend') {
    if (positive) return 'Your defensive posture makes the leopard reconsider the approach.';
    if (partial) return 'You hold it off, but the exchange is dangerously close.';
    return 'The confrontation turns violent before you can control the distance.';
  }
  return `The encounter shifts. Distance is now ${Math.round(encounter.state.distance)} m.`;
}

export function resolveEncounterAction(
  encounterInput: EncounterInstance,
  stateInput: GameState,
  actionId: string,
): EncounterResolution | null {
  const encounter = JSON.parse(JSON.stringify(encounterInput)) as EncounterInstance;
  const gameState = JSON.parse(JSON.stringify(stateInput)) as GameState;
  const action = LEOPARD_ACTIONS.find((entry) => entry.id === actionId);
  if (!action) return null;

  const actionView = getEncounterActions(encounter, gameState).find((entry) => entry.id === actionId);
  if (!actionView || actionView.disabled) return null;

  if (action.id === 'leave_area') {
    encounter.completed = true;
    encounter.stage = 'completed';
    encounter.completionReason = 'Party withdrew safely.';
    gameState.gameTime.minuteOfDay += action.timeMinutes;
    const timeLabel = formatTimeOfDay(gameState.gameTime.minuteOfDay % 1440);
    const summary = describeResolution(action.id, 'success', encounter);
    encounter.history.push({
      id: `enc_${encounter.turn}_${action.id}`,
      turn: encounter.turn,
      timeLabel,
      text: summary,
      tone: 'success',
      actionId: action.id,
      outcome: 'success',
      roll: 0,
      chance: 100,
    });
    return { encounter, gameState, action, outcome: 'success', roll: 0, chance: 100, summary };
  }

  const chance = actionView.chance;
  const rollSeed = encounter.seed + encounter.turn * 104729 + hashString(action.id);
  const roll = seededRoll(rollSeed);
  const outcome = getOutcomeTier(roll, chance);
  applyDelta(encounter, gameState, action.effects[outcome]);

  if (action.requiresFood) consumeDistractingFood(gameState);

  const lead = getLead(encounter, gameState);
  if (lead) lead.fatigue = clamp(lead.fatigue + Math.max(1, action.timeMinutes), 0, 100);

  gameState.gameTime.minuteOfDay += action.timeMinutes;
  if (gameState.gameTime.minuteOfDay >= 1440) {
    gameState.gameTime.minuteOfDay %= 1440;
    gameState.gameTime.day += 1;
  }

  encounter.turn += 1;
  encounter.stage = 'decision';
  encounter.state.escalation = clamp(
    Math.round(
      encounter.state.aggression * 0.42
      + Math.max(0, 18 - encounter.state.distance) * 2.1
      + encounter.state.partyPanic * 0.22
      + encounter.state.playerThreat * 0.13,
    ),
    0,
    100,
  );

  const summary = describeResolution(action.id, outcome, encounter);
  const timeLabel = formatTimeOfDay(gameState.gameTime.minuteOfDay);
  const tone = outcome === 'strong_success' || outcome === 'success'
    ? 'success'
    : outcome === 'partial_success'
      ? 'warning'
      : 'danger';

  encounter.history.push({
    id: `enc_${encounter.turn}_${action.id}`,
    turn: encounter.turn,
    timeLabel,
    text: summary,
    tone,
    actionId: action.id,
    outcome,
    roll: Math.round(roll),
    chance,
  });

  if (lead && lead.health <= 0) {
    encounter.completed = true;
    encounter.stage = 'completed';
    encounter.completionReason = `${lead.name} was incapacitated.`;
  } else if (encounter.state.fear >= 72) {
    encounter.completed = true;
    encounter.stage = 'completed';
    encounter.completionReason = 'The leopard fled into the jungle.';
    encounter.history.push({
      id: `enc_flee_${encounter.turn}`,
      turn: encounter.turn,
      timeLabel,
      text: 'The leopard finally breaks eye contact and disappears into the undergrowth.',
      tone: 'success',
    });
  }

  gameState.logs = [
    {
      id: `encounter_log_${Date.now()}_${encounter.turn}`,
      day: gameState.gameTime.day,
      timeStr: timeLabel,
      text: `[Encounter] ${summary}`,
      type: tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'info',
    },
    ...gameState.logs.slice(0, 34),
  ];

  return { encounter, gameState, action, outcome, roll: Math.round(roll), chance, summary };
}

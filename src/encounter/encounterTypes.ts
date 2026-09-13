import type { GameState } from '../types';

export type EncounterType =
  | 'wildlife'
  | 'environment'
  | 'social'
  | 'discovery'
  | 'medical'
  | 'navigation';

export type EncounterStage =
  | 'detection'
  | 'assessment'
  | 'decision'
  | 'resolution'
  | 'aftermath'
  | 'completed';

export type EncounterRisk = 'low' | 'medium' | 'high' | 'extreme';
export type EncounterNoise = 'very_low' | 'low' | 'medium' | 'high';
export type EncounterOutcomeTier =
  | 'strong_success'
  | 'success'
  | 'partial_success'
  | 'failure'
  | 'critical_failure';

export interface EncounterStateVector {
  distance: number;
  alertness: number;
  aggression: number;
  fear: number;
  hunger: number;
  territoriality: number;
  injury: number;
  escapeRoute: number;
  playerThreat: number;
  noise: number;
  partyPanic: number;
  escalation: number;
}

export interface EncounterKnowledge {
  species: number;
  behavior: number;
  terrain: number;
  total: number;
}

export interface EncounterStateDelta extends Partial<EncounterStateVector> {
  knowledge?: number;
  leadHealth?: number;
  leadFatigue?: number;
  leadMorale?: number;
}

export interface EncounterActionDefinition {
  id: string;
  title: string;
  description: string;
  icon: 'observe' | 'calm' | 'back_away' | 'defend' | 'food' | 'leave';
  baseChance: number;
  risk: EncounterRisk;
  timeMinutes: number;
  noise: EncounterNoise;
  primarySkill?: string;
  skillWeight?: number;
  requiresFood?: boolean;
  onlyWhenSafe?: boolean;
  effects: Record<EncounterOutcomeTier, EncounterStateDelta>;
}

export interface EncounterOutcomeGroup {
  id: string;
  title: string;
  tone: 'success' | 'neutral' | 'danger';
  items: Array<{
    label: string;
    icon: 'meat' | 'fiber' | 'knowledge' | 'route' | 'location' | 'injury' | 'food' | 'medical' | 'risk' | 'xp';
    revealAtKnowledge?: number;
  }>;
}

export interface EncounterHistoryEntry {
  id: string;
  turn: number;
  timeLabel: string;
  text: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  actionId?: string;
  outcome?: EncounterOutcomeTier;
  roll?: number;
  chance?: number;
}

export interface EncounterActor {
  id: string;
  species: string;
  displayName: string;
  description: string;
  persistentEntityId?: string;
}

export interface EncounterInstance {
  id: string;
  templateId: string;
  type: EncounterType;
  stage: EncounterStage;
  title: string;
  subtitle: string;
  areaId: string;
  partyIds: string[];
  seed: number;
  turn: number;
  startedAtGameMinute: number;
  sceneImageUrl: string;
  sceneAlt: string;
  intro: string;
  narrative: string[];
  actor: EncounterActor;
  state: EncounterStateVector;
  knowledge: EncounterKnowledge;
  outcomeGroups: EncounterOutcomeGroup[];
  history: EncounterHistoryEntry[];
  completed: boolean;
  completionReason?: string;
}

export interface EncounterActionView extends EncounterActionDefinition {
  chance: number;
  estimate: string;
  disabled: boolean;
  disabledReason?: string;
}

export interface EncounterResolution {
  encounter: EncounterInstance;
  gameState: GameState;
  action: EncounterActionDefinition;
  outcome: EncounterOutcomeTier;
  roll: number;
  chance: number;
  summary: string;
}

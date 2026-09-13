import { SurvivorState } from '../types';

export const ENGLISH_FIRST_NAMES = [
  'James', 'Liam', 'Marcus', 'Ethan', 'Lucas', 'Oliver', 'Thomas', 'Henry',
  'Arthur', 'Daniel', 'Benjamin', 'Samuel', 'Sarah', 'Emma', 'Chloe', 'Olivia',
  'Grace', 'Sophia', 'Charlotte', 'Mia', 'Elena', 'Amelia', 'Hannah', 'Zoe'
];

export const ENGLISH_LAST_NAMES = [
  'Carter', 'Vance', 'Miller', 'Reed', 'Jenkins', 'Bennett', 'Cooper', 'Sullivan',
  'Hayes', 'Walker', 'Wright', 'Ward', 'Campbell', 'Scott', 'Morgan', 'Foster',
  'Palmer', 'Evans', 'Brooks', 'Ross', 'Watson', 'Cole', 'Sterling', 'Dawson'
];

export const INITIAL_SURVIVORS: SurvivorState[] = [
  {
    id: 'SURVIVOR_ALEX',
    name: 'Alex Carter',
    role: 'Tracker & Expedition Lead',
    avatarColor: '#d4a359',
    portraitIndex: 0,
    health: 90,
    hunger: 20,
    thirst: 20,
    fatigue: 20,
    morale: 85,
    traits: ['Pathfinder', 'Resilient'],
    skills: {
      exploration: 4,
      foraging: 3,
      hunting: 3,
      building: 2,
      crafting: 2,
      cooking: 1,
      medicine: 1,
      fishing: 2,
    },
    jobPriorities: {
      explore: 'highest',
      gather: 'high',
      haul: 'normal',
      craft: 'normal',
      build: 'low',
      cook: 'low',
      medicine: 'low',
    },
    currentAction: {
      type: 'idle',
      description: 'Exploring island territory',
      progressSeconds: 0,
      totalSeconds: 0,
    },
  },
];

export const RECRUIT_CANDIDATES_POOL: Omit<SurvivorState, 'id'>[] = [
  {
    name: 'Elena Vance',
    role: 'Botanist & Medic',
    avatarColor: '#3da868',
    portraitIndex: 1,
    health: 95,
    hunger: 25,
    thirst: 35,
    fatigue: 20,
    morale: 80,
    traits: ['Herbalist', 'Fast Learner'],
    skills: {
      foraging: 3,
      medicine: 3,
      cooking: 2,
      exploration: 2,
      crafting: 1,
      building: 1,
      fishing: 1,
    },
    jobPriorities: {
      gather: 'high',
      medicine: 'highest',
      cook: 'high',
      craft: 'normal',
      build: 'low',
      haul: 'normal',
      explore: 'normal',
    },
    currentAction: {
      type: 'idle',
      description: 'Resting by the camp clearing',
      progressSeconds: 0,
      totalSeconds: 0,
    },
  },
  {
    name: 'Marcus Reed',
    role: 'Structural Engineer',
    avatarColor: '#c97a3e',
    portraitIndex: 2,
    health: 100,
    hunger: 30,
    thirst: 40,
    fatigue: 15,
    morale: 75,
    traits: ['Carpenter', 'Strong'],
    skills: {
      crafting: 3,
      building: 3,
      foraging: 1,
      exploration: 1,
      cooking: 1,
      medicine: 1,
      fishing: 1,
    },
    jobPriorities: {
      build: 'highest',
      craft: 'high',
      haul: 'high',
      gather: 'normal',
      cook: 'low',
      medicine: 'low',
      explore: 'normal',
    },
    currentAction: {
      type: 'idle',
      description: 'Inspecting shelter site',
      progressSeconds: 0,
      totalSeconds: 0,
    },
  },
  {
    name: 'Sarah Jenkins',
    role: 'Scout & Angler',
    avatarColor: '#48a9e6',
    portraitIndex: 3,
    health: 90,
    hunger: 20,
    thirst: 30,
    fatigue: 10,
    morale: 85,
    traits: ['Fisher', 'Nimble'],
    skills: {
      exploration: 3,
      fishing: 3,
      foraging: 2,
      cooking: 1,
      crafting: 1,
      building: 1,
      medicine: 1,
    },
    jobPriorities: {
      explore: 'highest',
      gather: 'high',
      cook: 'normal',
      haul: 'normal',
      craft: 'low',
      build: 'low',
      medicine: 'low',
    },
    currentAction: {
      type: 'idle',
      description: 'Surveying the horizon for weather',
      progressSeconds: 0,
      totalSeconds: 0,
    },
  },
  {
    name: 'Liam Cooper',
    role: 'Toolmaker & Smith',
    avatarColor: '#a66840',
    portraitIndex: 4,
    health: 92,
    hunger: 25,
    thirst: 30,
    fatigue: 15,
    morale: 80,
    traits: ['Tinkerer', 'Disciplined'],
    skills: {
      crafting: 4,
      building: 2,
      exploration: 2,
      foraging: 1,
      cooking: 1,
      medicine: 1,
      fishing: 1,
    },
    jobPriorities: {
      craft: 'highest',
      build: 'high',
      haul: 'normal',
      gather: 'normal',
      explore: 'low',
      cook: 'low',
      medicine: 'low',
    },
    currentAction: {
      type: 'idle',
      description: 'Sharpening stone chisels',
      progressSeconds: 0,
      totalSeconds: 0,
    },
  },
  {
    name: 'Chloe Bennett',
    role: 'Field Chef & Forager',
    avatarColor: '#53a57e',
    portraitIndex: 5,
    health: 88,
    hunger: 15,
    thirst: 25,
    fatigue: 20,
    morale: 88,
    traits: ['Gourmet', 'Optimist'],
    skills: {
      cooking: 4,
      foraging: 3,
      fishing: 2,
      exploration: 1,
      crafting: 1,
      building: 1,
      medicine: 1,
    },
    jobPriorities: {
      cook: 'highest',
      gather: 'high',
      haul: 'normal',
      craft: 'low',
      build: 'low',
      medicine: 'normal',
      explore: 'low',
    },
    currentAction: {
      type: 'idle',
      description: 'Tending the camp pantry',
      progressSeconds: 0,
      totalSeconds: 0,
    },
  },
  {
    name: 'Thomas Hayes',
    role: 'Camp Surgeon',
    avatarColor: '#3e8ea5',
    portraitIndex: 6,
    health: 90,
    hunger: 20,
    thirst: 20,
    fatigue: 18,
    morale: 82,
    traits: ['Surgeon', 'Calm'],
    skills: {
      medicine: 4,
      foraging: 2,
      cooking: 2,
      crafting: 2,
      exploration: 1,
      building: 1,
      fishing: 1,
    },
    jobPriorities: {
      medicine: 'highest',
      gather: 'normal',
      cook: 'normal',
      craft: 'normal',
      haul: 'low',
      build: 'low',
      explore: 'low',
    },
    currentAction: {
      type: 'idle',
      description: 'Preparing herbal tinctures',
      progressSeconds: 0,
      totalSeconds: 0,
    },
  },
];

export function generateRecruitSurvivor(existingSurvivors: SurvivorState[]): SurvivorState {
  const existingPortraits = new Set(existingSurvivors.map(s => s.portraitIndex ?? 0));
  const existingNames = new Set(existingSurvivors.map(s => s.name));

  // Find an unpicked predefined candidate
  const availableCandidate = RECRUIT_CANDIDATES_POOL.find(
    c => !existingNames.has(c.name) && !existingPortraits.has(c.portraitIndex ?? 0)
  );

  if (availableCandidate) {
    const id = `SURVIVOR_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return {
      ...availableCandidate,
      id,
    };
  }

  // Otherwise generate an English-named survivor
  const availableFirstNames = ENGLISH_FIRST_NAMES.filter(f => !existingSurvivors.some(s => s.name.startsWith(f)));
  const firstName = availableFirstNames.length > 0 
    ? availableFirstNames[Math.floor(Math.random() * availableFirstNames.length)]
    : ENGLISH_FIRST_NAMES[Math.floor(Math.random() * ENGLISH_FIRST_NAMES.length)];
  const lastName = ENGLISH_LAST_NAMES[Math.floor(Math.random() * ENGLISH_LAST_NAMES.length)];
  const name = `${firstName} ${lastName}`;

  // Find next unused portrait index (0-19)
  let portraitIndex = 0;
  for (let i = 0; i < 20; i++) {
    if (!existingPortraits.has(i)) {
      portraitIndex = i;
      break;
    }
  }

  const id = `SURVIVOR_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  return {
    id,
    name,
    role: 'Island Pioneer',
    avatarColor: '#5a997a',
    portraitIndex,
    health: 90,
    hunger: 25,
    thirst: 25,
    fatigue: 20,
    morale: 80,
    traits: ['Quick Learner', 'Hardy'],
    skills: {
      foraging: 2,
      crafting: 2,
      exploration: 2,
      building: 2,
      cooking: 1,
      medicine: 1,
      fishing: 1,
    },
    jobPriorities: {
      gather: 'high',
      haul: 'high',
      craft: 'normal',
      build: 'normal',
      explore: 'normal',
      cook: 'low',
      medicine: 'low',
    },
    currentAction: {
      type: 'idle',
      description: 'Joining the camp settlement',
      progressSeconds: 0,
      totalSeconds: 0,
    },
  };
}


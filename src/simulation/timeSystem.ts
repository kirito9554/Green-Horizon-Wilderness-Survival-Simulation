import { GameState } from '../types';

// Helper: Format minutes into 24h clock string "HH:MM"
export function formatTimeOfDay(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// System: Advance time in simulation tick
export function advanceTime(next: GameState, deltaGameMinutes: number): void {
  let newMinutes = next.gameTime.minuteOfDay + deltaGameMinutes;
  let newDay = next.gameTime.day;
  if (newMinutes >= 1440) {
    newDay += Math.floor(newMinutes / 1440);
    newMinutes = newMinutes % 1440;
    next.logs.unshift({
      id: `log_day_${newDay}`,
      day: newDay,
      timeStr: '00:00',
      text: `Dawn breaks on Day ${newDay}. A new day of survival in the rainforest.`,
      type: 'info',
    });
  }
  next.gameTime.minuteOfDay = newMinutes;
  next.gameTime.day = newDay;
}

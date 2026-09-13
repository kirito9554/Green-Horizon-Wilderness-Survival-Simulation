import { GameState, WeatherType, WindState } from '../types';
import { formatTimeOfDay } from './timeSystem';

export interface WeatherTarget {
  temperatureC: number;
  humidityPercent: number;
  rainIntensity: number; // 0.0 - 1.0
  cloudCover: number;    // 0.0 - 1.0
  windSpeedKmh: number;  // km/h
  windDirectionDeg: number; // degrees 0-360
}

export const WEATHER_BASELINES: Record<WeatherType, WeatherTarget> = {
  clear: { temperatureC: 30, humidityPercent: 65, rainIntensity: 0.0, cloudCover: 0.1, windSpeedKmh: 8, windDirectionDeg: 45 },
  cloudy: { temperatureC: 27, humidityPercent: 80, rainIntensity: 0.0, cloudCover: 0.7, windSpeedKmh: 18, windDirectionDeg: 90 },
  light_rain: { temperatureC: 25, humidityPercent: 90, rainIntensity: 0.35, cloudCover: 0.85, windSpeedKmh: 24, windDirectionDeg: 135 },
  heavy_rain: { temperatureC: 23, humidityPercent: 96, rainIntensity: 0.75, cloudCover: 0.95, windSpeedKmh: 45, windDirectionDeg: 195 },
  storm: { temperatureC: 21, humidityPercent: 99, rainIntensity: 1.0, cloudCover: 1.0, windSpeedKmh: 85, windDirectionDeg: 240 },
  heat_wave: { temperatureC: 37, humidityPercent: 50, rainIntensity: 0.0, cloudCover: 0.05, windSpeedKmh: 4, windDirectionDeg: 10 },
};

export function getCardinalDirection(angleDeg: number): string {
  const normalized = ((angleDeg % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

// Natural transition matrix for tropical rainforest climate
export function getNextWeather(current: WeatherType): WeatherType {
  const transitions: Record<WeatherType, WeatherType[]> = {
    clear: ['clear', 'cloudy', 'heat_wave'],
    cloudy: ['clear', 'light_rain', 'cloudy'],
    light_rain: ['heavy_rain', 'cloudy', 'clear'],
    heavy_rain: ['storm', 'light_rain', 'cloudy'],
    storm: ['heavy_rain', 'light_rain'],
    heat_wave: ['clear', 'cloudy'],
  };
  const possible = transitions[current] || ['clear', 'cloudy'];
  return possible[Math.floor(Math.random() * possible.length)];
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * Math.max(0, Math.min(1, t));
}

function lerpAngle(startDeg: number, endDeg: number, t: number): number {
  let diff = (endDeg - startDeg) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return ((startDeg + diff * Math.max(0, Math.min(1, t))) % 360 + 360) % 360;
}

// System: Tick weather with smooth 3-phase transition (Previous -> Current -> Next)
export function tickWeather(nextState: GameState, deltaGameMinutes: number): void {
  const w = nextState.weather;

  // Initialize unpopulated phase fields (for legacy save compatibility or new game)
  if (!w.previous) w.previous = w.current;
  if (!w.next) w.next = getNextWeather(w.current);
  if (!w.totalDurationMinutes || w.totalDurationMinutes <= 0) {
    w.totalDurationMinutes = Math.max(120, w.durationRemainingMinutes || 180);
  }

  w.durationRemainingMinutes -= deltaGameMinutes;

  // Check if phase expired
  if (w.durationRemainingMinutes <= 0) {
    const oldWeather = w.current;
    const newCurrent = w.next;
    const upcoming = getNextWeather(newCurrent);

    w.previous = oldWeather;
    w.current = newCurrent;
    w.next = upcoming;

    const newDuration = 150 + Math.floor(Math.random() * 180); // 2.5 to 5.5 hours
    w.totalDurationMinutes = newDuration;
    w.durationRemainingMinutes = newDuration;

    nextState.logs.unshift({
      id: `log_weather_${Date.now()}`,
      day: nextState.gameTime.day,
      timeStr: formatTimeOfDay(nextState.gameTime.minuteOfDay),
      text: `Weather shift: Sky transition complete. Now entering ${w.current} (Upcoming: ${w.next}).`,
      type: 'info',
    });
  }

  // Calculate normalized phase progress (0.0 = phase start, 1.0 = phase end)
  const progress = Math.max(0, Math.min(1, 1 - w.durationRemainingMinutes / w.totalDurationMinutes));
  w.transitionProgress = Math.round(progress * 100) / 100;

  const basePrev = WEATHER_BASELINES[w.previous] || WEATHER_BASELINES.clear;
  const baseCurr = WEATHER_BASELINES[w.current] || WEATHER_BASELINES.clear;
  const baseNext = WEATHER_BASELINES[w.next] || WEATHER_BASELINES.clear;

  let temp: number;
  let hum: number;
  let rain: number;
  let cloud: number;
  let rawSpeed: number;
  let rawDir: number;

  // 2-Phase Seamless Climate Interpolation Curve:
  // Phase 1 (0.0 -> 0.60): Steady state at current weather
  // Phase 2 (0.60 -> 1.0): Smooth S-curve transition towards upcoming weather
  // At progress = 1.0, state exactly reaches baseNext.
  // When phase expires, next becomes current, guaranteeing 100% continuous transition with 0 discontinuity!
  if (progress <= 0.60) {
    temp = baseCurr.temperatureC;
    hum = baseCurr.humidityPercent;
    rain = baseCurr.rainIntensity;
    cloud = baseCurr.cloudCover;
    rawSpeed = baseCurr.windSpeedKmh;
    rawDir = baseCurr.windDirectionDeg;
  } else {
    const blend = (progress - 0.60) / 0.40; // 0.0 -> 1.0
    const smoothBlend = blend * blend * (3 - 2 * blend);
    temp = lerp(baseCurr.temperatureC, baseNext.temperatureC, smoothBlend);
    hum = lerp(baseCurr.humidityPercent, baseNext.humidityPercent, smoothBlend);
    rain = lerp(baseCurr.rainIntensity, baseNext.rainIntensity, smoothBlend);
    cloud = lerp(baseCurr.cloudCover, baseNext.cloudCover, smoothBlend);
    rawSpeed = lerp(baseCurr.windSpeedKmh, baseNext.windSpeedKmh, smoothBlend);
    rawDir = lerpAngle(baseCurr.windDirectionDeg, baseNext.windDirectionDeg, smoothBlend);
  }

  // Dynamic Wind Gusts & Micro-fluctuations based on time and weather turbulence
  const timeSeed = nextState.gameTime.minuteOfDay;
  const breezeOscillation = Math.sin(timeSeed * 0.1) * 3 + Math.cos(timeSeed * 0.25) * 2;
  const speedKmh = Math.max(1, Math.round((rawSpeed + breezeOscillation) * 10) / 10);

  // Gust multiplier increases dramatically in storms
  const gustFactor = w.current === 'storm' ? 1.5 + Math.sin(timeSeed * 0.4) * 0.3 : 1.25 + Math.sin(timeSeed * 0.15) * 0.15;
  const gustKmh = Math.round(speedKmh * gustFactor * 10) / 10;

  // Micro wind angle sway
  const dirSway = Math.sin(timeSeed * 0.08) * 8;
  const directionDeg = Math.round(((rawDir + dirSway) % 360 + 360) % 360);
  const cardinal = getCardinalDirection(directionDeg);

  // Update smooth dynamic climate metrics
  w.temperatureC = Math.round(temp * 10) / 10;
  w.humidityPercent = Math.round(hum);
  w.rainIntensity = Math.round(rain * 100) / 100;
  w.cloudCover = Math.round(cloud * 100) / 100;

  w.wind = {
    speedKmh,
    gustKmh,
    directionDeg,
    cardinal,
  };
}


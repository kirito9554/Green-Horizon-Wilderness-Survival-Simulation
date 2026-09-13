/**
 * Shared input contract for every world-map shader.
 * Components accept Partial<> so legacy saves can safely omit new weather fields.
 */
export interface MapShaderEnvironment {
  timeOfDayMinutes: number;
  rainIntensity: number;
  cloudCover: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  humidityPercent: number;
  temperatureC: number;
}

export const DEFAULT_MAP_SHADER_ENVIRONMENT: MapShaderEnvironment = {
  timeOfDayMinutes: 720,
  rainIntensity: 0,
  cloudCover: 0.1,
  windSpeedKmh: 8,
  windDirectionDeg: 45,
  humidityPercent: 65,
  temperatureC: 30,
};

const finiteOr = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? Number(value) : fallback;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function normalizeMapShaderEnvironment(
  input?: Partial<MapShaderEnvironment>,
): MapShaderEnvironment {
  const source = { ...DEFAULT_MAP_SHADER_ENVIRONMENT, ...input };

  return {
    timeOfDayMinutes:
      ((finiteOr(source.timeOfDayMinutes, 720) % 1440) + 1440) % 1440,
    rainIntensity: clamp(finiteOr(source.rainIntensity, 0), 0, 1),
    cloudCover: clamp(finiteOr(source.cloudCover, 0.1), 0, 1),
    windSpeedKmh: clamp(finiteOr(source.windSpeedKmh, 8), 0, 140),
    windDirectionDeg:
      ((finiteOr(source.windDirectionDeg, 45) % 360) + 360) % 360,
    humidityPercent: clamp(finiteOr(source.humidityPercent, 65), 0, 100),
    temperatureC: clamp(finiteOr(source.temperatureC, 30), -20, 60),
  };
}

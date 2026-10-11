import type { WorldPointMeters, WorldPolygon } from '../../data/worldGeometry';
import { getPolygonBounds, pointInPolygon } from '../../data/worldGeometry';

/** Stable 32-bit FNV-1a hash used by every procedural spatial layer. */
export function hashSpatialSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export function randomFromSpatialKey(worldSeed: string, key: string): () => number {
  return mulberry32(hashSpatialSeed(`${worldSeed}|${key}`));
}

export function spatialUnitRandom(worldSeed: string, key: string): number {
  return hashSpatialSeed(`${worldSeed}|${key}`) / 0x1_0000_0000;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function latticeNoise(worldSeed: string, channel: string, x: number, y: number): number {
  return spatialUnitRandom(worldSeed, `${channel}|${x}|${y}`) * 2 - 1;
}

/**
 * Cheap deterministic value noise. It is intentionally small and dependency-free:
 * terrain generation only needs broad spatial correlation, not renderer-grade noise.
 */
export function sampleSpatialNoise(
  worldSeed: string,
  channel: string,
  point: WorldPointMeters,
  scaleMeters: number,
): number {
  const scale = Math.max(1, scaleMeters);
  const sx = point.x / scale;
  const sy = point.y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = smoothstep(sx - x0);
  const ty = smoothstep(sy - y0);

  const a = lerp(
    latticeNoise(worldSeed, channel, x0, y0),
    latticeNoise(worldSeed, channel, x1, y0),
    tx,
  );
  const b = lerp(
    latticeNoise(worldSeed, channel, x0, y1),
    latticeNoise(worldSeed, channel, x1, y1),
    tx,
  );
  return lerp(a, b, ty);
}

/** Two-octave field for broad landforms plus local variation. Range is about -1..1. */
export function sampleFractalSpatialNoise(
  worldSeed: string,
  channel: string,
  point: WorldPointMeters,
  broadScaleMeters: number,
): number {
  const broad = sampleSpatialNoise(worldSeed, `${channel}:broad`, point, broadScaleMeters);
  const detail = sampleSpatialNoise(worldSeed, `${channel}:detail`, point, broadScaleMeters * 0.43);
  return Math.max(-1, Math.min(1, broad * 0.7 + detail * 0.3));
}

export function samplePointInPolygon(
  polygon: WorldPolygon,
  worldSeed: string,
  key: string,
  attempts = 40,
): WorldPointMeters {
  const bounds = getPolygonBounds(polygon);
  const random = randomFromSpatialKey(worldSeed, key);
  for (let i = 0; i < attempts; i += 1) {
    const point = {
      x: bounds.minX + random() * bounds.width,
      y: bounds.minY + random() * bounds.height,
    };
    if (pointInPolygon(point, polygon)) return point;
  }

  // The caller normally provides a clipped convex-ish habitat patch. If rejection
  // sampling ever fails on a narrow sliver, fall back to an authored vertex rather
  // than placing the site outside its parent geometry.
  return { ...polygon[0] };
}

export function stableSpatialId(prefix: string, worldSeed: string, key: string): string {
  return `${prefix}_${hashSpatialSeed(`${worldSeed}|${key}`).toString(36).toUpperCase()}`;
}

// Utility for managing and persisting POI background images

export interface PoiImageMapping {
  areaId: string;
  defaultFilename: string;
  aliases: string[];
}

export const POI_IMAGE_MAPPINGS: PoiImageMapping[] = [
  { areaId: 'AREA_CAMP_CLEARING', defaultFilename: 'base-camp.png', aliases: ['base-camp', 'basecamp', 'camp', 'camp-clearing'] },
  { areaId: 'AREA_WATERFALL_BASIN', defaultFilename: 'water-fall.png', aliases: ['water-fall', 'waterfall', 'waterfall-basin'] },
  { areaId: 'AREA_ANCIENT_RUINS', defaultFilename: 'ruin.png', aliases: ['ruin', 'ruins', 'ancient-ruins', 'ancient_ruins'] },
  { areaId: 'AREA_STONE_RIDGE', defaultFilename: 'stone-ridge.png', aliases: ['stone-ridge', 'stoneridge', 'stone_ridge'] },
  { areaId: 'AREA_HILL_LOOKOUT', defaultFilename: 'Hill Lookout.png', aliases: ['hill lookout', 'hill-lookout', 'hill_lookout', 'hilllookout'] },
  { areaId: 'AREA_CLAY_PIT', defaultFilename: 'clay-pit.png', aliases: ['clay-pit', 'claypit', 'clay_pit'] },
  { areaId: 'AREA_BAMBOO_GROVE', defaultFilename: 'bamboo.png', aliases: ['bamboo', 'bamboo-grove', 'bamboo_grove'] },
  { areaId: 'AREA_JUNGLE_TRAIL', defaultFilename: 'jungle-trails.png', aliases: ['jungle-trails', 'jungle-trail', 'jungletrails', 'jungle_trails'] },
  { areaId: 'AREA_ABANDONED_HUT', defaultFilename: 'abandoned-hut.png', aliases: ['abandoned-hut', 'abandonedhut', 'abandoned_hut'] },
  { areaId: 'AREA_FORAGING_GROUNDS', defaultFilename: 'Foraging Grounds.png', aliases: ['foraging grounds', 'foraging-grounds', 'foraging_grounds', 'foraginggrounds'] },
  { areaId: 'AREA_MEDICINAL_GLADE', defaultFilename: 'Medicinal Glade.png', aliases: ['medicinal glade', 'medicinal-glade', 'medicinal_glade', 'medicinalglade'] },
  { areaId: 'AREA_FOREST_EDGE', defaultFilename: 'Forest Edge.png', aliases: ['forest edge', 'forest-edge', 'forest_edge', 'forestedge'] },
  { areaId: 'AREA_KAPOK_GROVE', defaultFilename: 'Kapok Grove.png', aliases: ['kapok grove', 'kapok-grove', 'kapok_grove', 'kapokgrove'] },
  { areaId: 'AREA_MANGROVE_EDGE', defaultFilename: 'mangrove-edge.png', aliases: ['mangrove-edge', 'mangroveedge', 'mangrove_edge'] },
  { areaId: 'AREA_SWAMP_CROSSING', defaultFilename: 'Swamp Crossing.png', aliases: ['swamp crossing', 'swamp-crossing', 'swamp_crossing', 'swampcrossing'] },
  { areaId: 'AREA_WILDLIFE_NEST', defaultFilename: 'wildlife-nest.png', aliases: ['wildlife-nest', 'wildlifenest', 'wildlife_nest'] },
  { areaId: 'AREA_FISHING_LAGOON', defaultFilename: 'fishing-lagoon.png', aliases: ['fishing-lagoon', 'fishinglagoon', 'fishing_lagoon'] },
  { areaId: 'AREA_CAVE_ENTRANCE', defaultFilename: 'cave-entrance.png', aliases: ['cave-entrance', 'caveentrance', 'cave_entrance'] },
];

const LOCAL_STORAGE_PREFIX = 'island_poi_bg_';

/**
 * Match a file name to a target Area ID
 */
export function matchFilenameToAreaId(rawFilename: string): string | null {
  // Strip extension and normalize
  const cleanName = rawFilename.replace(/\.[^/.]+$/, '').trim().toLowerCase();
  
  for (const mapping of POI_IMAGE_MAPPINGS) {
    if (mapping.defaultFilename.toLowerCase().replace(/\.[^/.]+$/, '') === cleanName) {
      return mapping.areaId;
    }
    for (const alias of mapping.aliases) {
      if (alias.toLowerCase() === cleanName) {
        return mapping.areaId;
      }
    }
  }

  // Fuzzy match: check if cleanName contains alias or vice versa
  for (const mapping of POI_IMAGE_MAPPINGS) {
    for (const alias of mapping.aliases) {
      if (cleanName.includes(alias) || alias.includes(cleanName)) {
        return mapping.areaId;
      }
    }
  }

  return null;
}

/**
 * Get custom image URL stored in localStorage or fallback to default
 */
export function getPoiImageUrl(areaId: string, defaultUrl?: string): string {
  try {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${areaId}`);
    if (saved && saved.startsWith('data:image/')) {
      return saved;
    }
  } catch {
    // localStorage might be unavailable
  }
  return defaultUrl || '/poi-bg/center/base-camp.png';
}

/**
 * Save custom image for a specific POI Area ID
 */
export async function savePoiImage(areaId: string, filename: string, base64Data: string): Promise<void> {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${areaId}`, base64Data);
  } catch (err) {
    console.warn('LocalStorage quota exceeded or unavailable:', err);
  }

  // Also notify server to save to disk if API is available
  try {
    await fetch('/api/upload-poi-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, base64: base64Data }),
    });
  } catch {
    // Ignore server sync failure, localStorage is already updated
  }

  // Broadcast event so UI re-renders
  window.dispatchEvent(new CustomEvent('poi-images-updated', { detail: { areaId } }));
}

/**
 * Batch import images from an array of Files
 */
export async function batchImportPoiImages(files: FileList | File[]): Promise<{
  successCount: number;
  totalCount: number;
  matchedAreas: string[];
  unmatchedFiles: string[];
}> {
  let successCount = 0;
  const matchedAreas: string[] = [];
  const unmatchedFiles: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const areaId = matchFilenameToAreaId(file.name);

    if (!areaId) {
      unmatchedFiles.push(file.name);
      continue;
    }

    try {
      const base64 = await readFileAsBase64(file);
      await savePoiImage(areaId, file.name, base64);
      successCount++;
      matchedAreas.push(areaId);
    } catch (e) {
      console.error(`Failed to process ${file.name}`, e);
      unmatchedFiles.push(file.name);
    }
  }

  return {
    successCount,
    totalCount: files.length,
    matchedAreas,
    unmatchedFiles,
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

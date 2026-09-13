/**
 * Shared runtime image cache/preloader.
 *
 * - One Promise + one HTMLImageElement per URL.
 * - Repeated preloadImage(src) calls reuse the same entry.
 * - decode() is awaited when supported, so a cached image is ready to paint,
 *   not merely downloaded.
 * - The cache intentionally lives for the lifetime of the page/session.
 */

export type PreloadImagesOptions = {
  concurrency?: number;
};

const imagePromiseCache = new Map<string, Promise<HTMLImageElement>>();
const imageElementCache = new Map<string, HTMLImageElement>();

const normalizeImageSrc = (src: string) => src.trim();

export const isImageCached = (src: string): boolean =>
  imageElementCache.has(normalizeImageSrc(src));

export const getCachedImage = (src: string): HTMLImageElement | undefined =>
  imageElementCache.get(normalizeImageSrc(src));

export const preloadImage = (src: string): Promise<HTMLImageElement> => {
  const key = normalizeImageSrc(src);

  if (!key) {
    return Promise.reject(new Error('Cannot preload an empty image URL.'));
  }

  const cachedElement = imageElementCache.get(key);
  if (cachedElement) return Promise.resolve(cachedElement);

  const cachedPromise = imagePromiseCache.get(key);
  if (cachedPromise) return cachedPromise;

  if (typeof Image === 'undefined') {
    return Promise.reject(new Error(`Image API is unavailable while preloading: ${key}`));
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';

    const fail = () => {
      imagePromiseCache.delete(key);
      reject(new Error(`Failed to preload image: ${key}`));
    };

    img.onerror = fail;
    img.onload = async () => {
      try {
        // onload means bytes are available; decode() also prepares the raster for paint.
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // Some browsers can reject decode() even though the loaded image is usable.
      }

      imageElementCache.set(key, img);
      resolve(img);
    };

    img.src = key;
  });

  imagePromiseCache.set(key, promise);
  return promise;
};

export const preloadImages = async (
  sources: readonly string[],
  options: PreloadImagesOptions = {},
): Promise<void> => {
  const uniqueSources = Array.from(
    new Set(sources.map(normalizeImageSrc).filter(Boolean)),
  );

  if (uniqueSources.length === 0) return;

  const concurrency = Math.max(
    1,
    Math.min(uniqueSources.length, Math.floor(options.concurrency ?? 4)),
  );

  let cursor = 0;

  const worker = async () => {
    while (cursor < uniqueSources.length) {
      const index = cursor++;
      try {
        await preloadImage(uniqueSources[index]);
      } catch {
        // Preloading is opportunistic. The actual component can still show its own fallback.
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
};

export const clearImageCache = (src?: string): void => {
  if (src) {
    const key = normalizeImageSrc(src);
    imagePromiseCache.delete(key);
    imageElementCache.delete(key);
    return;
  }

  imagePromiseCache.clear();
  imageElementCache.clear();
};

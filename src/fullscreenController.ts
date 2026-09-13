type LegacyFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type LegacyFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

const getFullscreenElement = (doc: LegacyFullscreenDocument) =>
  doc.fullscreenElement ??
  doc.webkitFullscreenElement ??
  doc.msFullscreenElement ??
  null;

const requestPageFullscreen = async () => {
  const root = document.documentElement as LegacyFullscreenElement;
  const request =
    root.requestFullscreen ??
    root.webkitRequestFullscreen ??
    root.webkitRequestFullScreen ??
    root.msRequestFullscreen;

  if (!request) {
    throw new Error('Fullscreen API is not available in this browser.');
  }

  await Promise.resolve(request.call(root));
};

const exitPageFullscreen = async () => {
  const doc = document as LegacyFullscreenDocument;
  const exit =
    doc.exitFullscreen ??
    doc.webkitExitFullscreen ??
    doc.webkitCancelFullScreen ??
    doc.msExitFullscreen;

  if (!exit) {
    throw new Error('Fullscreen exit API is not available in this browser.');
  }

  await Promise.resolve(exit.call(doc));
};

const togglePageFullscreen = async () => {
  const doc = document as LegacyFullscreenDocument;

  if (getFullscreenElement(doc)) {
    await exitPageFullscreen();
  } else {
    await requestPageFullscreen();
  }
};

/**
 * The fullscreen hotspot is rendered by TopHeader.  Keep the behavior here as
 * a small browser-level controller so the button remains usable even when the
 * host/browser only exposes a prefixed Fullscreen API.  The capture listener
 * intentionally owns only this one hotspot and prevents the older React
 * handler from attempting a second toggle for the same click.
 */
const handleFullscreenHotspotClick = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest('button[aria-label="Fullscreen"]');
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  void togglePageFullscreen().catch((error) => {
    console.warn('[Fullscreen] Unable to toggle fullscreen.', error);
  });
};

if (typeof document !== 'undefined') {
  document.addEventListener('click', handleFullscreenHotspotClick, true);
}

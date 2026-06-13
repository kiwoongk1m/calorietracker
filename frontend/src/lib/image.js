// ---------------------------------------------------------------------------
// Client-side image downscaling. Phone photos are 12MP+ (~5-6MB once base64
// encoded), which can exceed the vision API's per-image size limit and fail
// with "could not process image". The API also downsamples anything past
// ~1568px on the long edge anyway, so capping here is free in accuracy while
// cutting upload size by ~95% and removing that failure mode.
//
// `fitWithin` is pure and unit-tested. `downscaleDataUrl` needs a browser
// canvas, so it is exercised in the running app rather than in node tests.
// ---------------------------------------------------------------------------

// Long-edge cap. Matches the size the vision model downsamples to.
export const MAX_EDGE = 1568;
export const JPEG_QUALITY = 0.85;

/**
 * Scale (width, height) down to fit within maxEdge on the longest side,
 * preserving aspect ratio. Never upscales. Pure.
 */
export function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (!longest || longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Load a data URL, redraw it onto a capped canvas, and return a bounded JPEG
 * data URL. Always re-encodes to JPEG so large PNGs are bounded too.
 *
 * @returns {Promise<string>} a JPEG data URL no larger than MAX_EDGE per side
 */
export function downscaleDataUrl(dataUrl, maxEdge = MAX_EDGE, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = fitWithin(
        img.naturalWidth,
        img.naturalHeight,
        maxEdge
      );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = dataUrl;
  });
}

/**
 * Client-side photo preparation for S04 / Edit photo.
 *
 * Users can pick JPEG, PNG or WebP files up to 10 MB (spec §6 S04), while Vercel
 * serverless functions enforce a 4.5 MB request body limit. Resizing to the server's
 * 1080×1080 target and re-encoding in the browser keeps uploads well under 4 MB;
 * the server still re-encodes with sharp to verify magic bytes and strip EXIF/GPS.
 */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
export const PHOTO_ACCEPTED_TYPES = PHOTO_ACCEPT.split(",");
export const PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** Stay comfortably below Vercel's 4.5 MB serverless function payload limit (incl. multipart overhead). */
export const PHOTO_MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 1080;

export function fitDimensions(width: number, height: number, max = PHOTO_MAX_DIMENSION) {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode_failed"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Resizes and compresses a user-selected photo so it fits within Vercel's payload limit.
 * Returns `{ file }` ready for upload, or `{ error }` if invalid / still too large.
 */
export async function preparePhotoForUpload(file: File): Promise<{ file?: File; error?: string }> {
  if (!PHOTO_ACCEPTED_TYPES.includes(file.type)) {
    return { error: "Use a JPEG, PNG or WebP photo." };
  }
  if (file.size > PHOTO_MAX_INPUT_BYTES) {
    return { error: "That photo is over 10 MB. Choose a smaller one." };
  }

  // Try resizing + compressing in the browser so large camera photos fit Vercel's 4.5 MB cap.
  if (typeof document !== "undefined") {
    try {
      const decoded = await decodeImage(file);
      try {
        const { width, height } = fitDimensions(decoded.width, decoded.height, PHOTO_MAX_DIMENSION);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(decoded.source, 0, 0, width, height);
          for (const [mime, ext, quality] of [
            ["image/webp", "webp", 0.85],
            ["image/jpeg", "jpg", 0.85],
            ["image/jpeg", "jpg", 0.7],
          ] as const) {
            const blob = await canvasToBlob(canvas, mime, quality);
            if (blob && blob.size > 0 && blob.size <= PHOTO_MAX_UPLOAD_BYTES) {
              // Keep the smaller of the compressed blob or original when dimensions already fit.
              const useOriginal =
                file.size <= PHOTO_MAX_UPLOAD_BYTES &&
                decoded.width <= PHOTO_MAX_DIMENSION &&
                decoded.height <= PHOTO_MAX_DIMENSION &&
                file.size <= blob.size;
              return {
                file: useOriginal ? file : new File([blob], `photo.${ext}`, { type: blob.type || mime }),
              };
            }
          }
        }
      } finally {
        decoded.close();
      }
    } catch {
      // Fall through: if the original file is already small enough, let the server validate & re-encode it.
    }
  }

  if (file.size <= PHOTO_MAX_UPLOAD_BYTES) {
    return { file };
  }
  return { error: "We couldn't compress that photo enough. Try a smaller one." };
}

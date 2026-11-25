import { afterEach, describe, expect, it, vi } from "vitest";
import { fitDimensions, PHOTO_MAX_INPUT_BYTES, PHOTO_MAX_UPLOAD_BYTES, preparePhotoForUpload } from "./photo";

describe("fitDimensions", () => {
  it("scales down oversized landscape and portrait images while preserving aspect ratio", () => {
    expect(fitDimensions(4000, 3000, 1080)).toEqual({ width: 1080, height: 810 });
    expect(fitDimensions(1500, 3000, 1080)).toEqual({ width: 540, height: 1080 });
  });

  it("never enlarges images already within the limit", () => {
    expect(fitDimensions(600, 800, 1080)).toEqual({ width: 600, height: 800 });
    expect(fitDimensions(1080, 1080, 1080)).toEqual({ width: 1080, height: 1080 });
  });
});

describe("preparePhotoForUpload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unsupported MIME types", async () => {
    const file = new File([new Uint8Array(10)], "pic.heic", { type: "image/heic" });
    expect(await preparePhotoForUpload(file)).toEqual({ error: "Use a JPEG, PNG or WebP photo." });
  });

  it("rejects files over 10 MB", async () => {
    const file = new File([new Uint8Array(PHOTO_MAX_INPUT_BYTES + 1)], "huge.jpg", { type: "image/jpeg" });
    expect(await preparePhotoForUpload(file)).toEqual({ error: "That photo is over 10 MB. Choose a smaller one." });
  });

  it("falls back to the original file when already under the Vercel upload limit", async () => {
    const file = new File([new Uint8Array(1024)], "small.png", { type: "image/png" });
    const res = await preparePhotoForUpload(file);
    expect(res.error).toBeUndefined();
    expect(res.file).toBe(file);
  });

  it("compresses oversized photos via canvas so they fit under Vercel's payload limit", async () => {
    const bitmap = { width: 4000, height: 3000, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb, type) => {
      cb(new Blob([new Uint8Array(50_000)], { type: type ?? "image/webp" }));
    });

    const big = new File([new Uint8Array(PHOTO_MAX_UPLOAD_BYTES + 500_000)], "camera.jpg", { type: "image/jpeg" });
    const res = await preparePhotoForUpload(big);

    expect(res.error).toBeUndefined();
    expect(res.file).toBeDefined();
    expect(res.file!.size).toBe(50_000);
    expect(res.file!.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1080, 810);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("returns a clear error if a >3.5 MB photo cannot be compressed", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("fail"); }));
    const big = new File([new Uint8Array(PHOTO_MAX_UPLOAD_BYTES + 100)], "big.jpg", { type: "image/jpeg" });
    expect(await preparePhotoForUpload(big)).toEqual({
      error: "We couldn't compress that photo enough. Try a smaller one.",
    });
  });
});

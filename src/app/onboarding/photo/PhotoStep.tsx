"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ImageIcon, Plus, X } from "lucide-react";
import { OnboardingActions } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { PHOTO_ACCEPT, preparePhotoForUpload } from "@/lib/photo";
import { uploadPhoto } from "../actions";

export function PhotoStep({
  initialUrl,
  nextHref,
  saveLabel = "Continue",
}: {
  initialUrl: string | null;
  nextHref: string;
  saveLabel?: string;
}) {
  const router = useRouter();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const prepared = await preparePhotoForUpload(file);
      if (!prepared.file) return setError(prepared.error ?? "Upload failed. Please try again.");
      const fd = new FormData();
      fd.set("photo", prepared.file);
      const result = await uploadPhoto(fd);
      if (result.url) setUrl(result.url);
      else setError(result.error ?? "Upload failed. Please try again.");
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    void upload(e.dataTransfer.files[0]);
  }

  return (
    <div className="flex flex-1 flex-col">
      <input
        ref={galleryRef}
        type="file"
        accept={PHOTO_ACCEPT}
        hidden
        data-testid="gallery-input"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="user"
        hidden
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="mt-6 flex flex-col items-center">
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          disabled={uploading}
          aria-label={url ? "Change photo" : "Add photo"}
          className="relative size-[200px] rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user upload served from Supabase Storage
            <img src={url} alt="Your profile photo" className="size-full rounded-full object-cover" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-2 rounded-full border-2 border-dashed border-mingle-blue/50 bg-light-blue text-blue-700">
              <Camera size={32} strokeWidth={1.8} aria-hidden="true" />
              <span className="text-[15px] font-bold">{uploading ? "Uploading…" : "Add photo"}</span>
            </span>
          )}
          <span
            aria-hidden="true"
            className="absolute right-2 bottom-4 inline-flex size-11 items-center justify-center rounded-full border-[3px] border-white bg-blue-600 text-white"
          >
            <Plus size={20} strokeWidth={1.8} />
          </span>
        </button>
        {url && (
          <p className="mt-3 text-[14px] text-slate" aria-live="polite">
            {uploading ? "Uploading…" : "Tap the photo to change it."}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-center text-[14px] font-semibold text-danger">
            {error}
          </p>
        )}
      </div>

      <ul className="mt-8 flex flex-col gap-3 px-4 text-[15px] text-charcoal">
        <li className="flex items-center gap-3">
          <Check size={18} strokeWidth={1.8} className="text-sage-text" aria-label="Do" />
          Just you, face clearly visible
        </li>
        <li className="flex items-center gap-3">
          <Check size={18} strokeWidth={1.8} className="text-sage-text" aria-label="Do" />
          Good light, no sunglasses
        </li>
        <li className="flex items-center gap-3">
          <X size={18} strokeWidth={1.8} className="text-danger" aria-label="Avoid" />
          No group shots or logos
        </li>
      </ul>

      <OnboardingActions>
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="secondary"
            leadingIcon={<Camera size={18} strokeWidth={1.8} aria-hidden="true" />}
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
          >
            Take photo
          </Button>
          <Button
            variant="secondary"
            leadingIcon={<ImageIcon size={18} strokeWidth={1.8} aria-hidden="true" />}
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
          >
            Gallery
          </Button>
        </div>
        <Button className="mt-2.5" disabled={!url || uploading} onClick={() => router.push(nextHref)}>
          {saveLabel}
        </Button>
      </OnboardingActions>
    </div>
  );
}

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { findArea, isRadius, CITY } from "@/lib/locations/bengaluru";
import { AFTER_ONBOARDING_PATH, MIN_INTERESTS, nextPath } from "@/lib/onboarding";
import { withBackQuery } from "@/lib/origins";
import {
  parseBirthday,
  underageBirthDate,
  UNDERAGE_MESSAGE,
  validateBio,
  validateBirthday,
  validateFirstName,
} from "@/lib/validation";
import { photoUrl, requireUser } from "@/server/profile";

export type AboutState = {
  errors: { firstName?: string; birthday?: string; bio?: string; form?: string };
};

export async function saveAbout(_prev: AboutState, formData: FormData): Promise<AboutState> {
  const firstName = String(formData.get("firstName") ?? "");
  const birthday = String(formData.get("birthday") ?? "");
  const bio = String(formData.get("bio") ?? "");
  const showAge = formData.get("showAge") === "on";

  const underage = underageBirthDate(birthday);
  if (underage) return deleteUnderageAccount(underage);

  const errors: AboutState["errors"] = {
    firstName: validateFirstName(firstName) ?? undefined,
    birthday: validateBirthday(birthday) ?? undefined,
    bio: validateBio(bio) ?? undefined,
  };
  if (errors.firstName || errors.birthday || errors.bio) return { errors };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("users")
    .update({
      first_name: firstName.trim(),
      birth_date: parseBirthday(birthday),
      show_age: showAge,
      bio: bio.trim() || null,
    })
    .eq("id", userId);
  if (error) {
    if (error.message.includes("must_be_18")) return { errors: { birthday: UNDERAGE_MESSAGE } };
    return { errors: { form: "Couldn't save. Please try again." } };
  }

  revalidatePath("/onboarding", "layout");
  // Edit mode (S21): name, age and bio show across the app.
  revalidatePath("/", "layout");
  redirect(nextPath("about", String(formData.get("from") ?? "")));
}

/** Q-25: under-18 users have their account (profile, interests, photo) deleted and are signed out. */
async function deleteUnderageAccount(isoBirthDate: string): Promise<AboutState> {
  const { supabase, userId } = await requireUser();
  const { data: row } = await supabase
    .from("users")
    .select("photo_path")
    .eq("id", userId)
    .maybeSingle();
  if (row?.photo_path) await supabase.storage.from("avatars").remove([row.photo_path]);

  const { error } = await supabase.rpc("delete_underage_self", { p_birth_date: isoBirthDate });
  if (error) return { errors: { form: "Couldn't delete your account. Please try again." } };

  // The user no longer exists, so only clear the local session cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?account=deleted");
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function sniffImageType(b: Buffer): "jpeg" | "png" | "webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export type PhotoResult = { url: string; error?: undefined } | { url?: undefined; error: string };

export async function uploadPhoto(formData: FormData): Promise<PhotoResult> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is over 10 MB. Choose a smaller one." };

  const input = Buffer.from(await file.arrayBuffer());
  if (!sniffImageType(input)) return { error: "Use a JPEG, PNG or WebP photo." };

  let output: Buffer;
  try {
    // rotate() applies EXIF orientation; sharp drops all metadata (incl. GPS) on output.
    output = await sharp(input)
      .rotate()
      .resize(1080, 1080, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: "We couldn't read that photo. Try another one." };
  }

  const { supabase, userId } = await requireUser();
  const { data: current } = await supabase
    .from("users")
    .select("photo_path")
    .eq("id", userId)
    .maybeSingle();

  const path = `${userId}/${randomUUID()}.webp`;
  const bucket = supabase.storage.from("avatars");
  const { error: uploadError } = await bucket.upload(path, output, { contentType: "image/webp" });
  if (uploadError) return { error: "Upload failed. Please try again." };

  const { error } = await supabase.from("users").update({ photo_path: path }).eq("id", userId);
  if (error) {
    await bucket.remove([path]);
    return { error: "Upload failed. Please try again." };
  }
  if (current?.photo_path) await bucket.remove([current.photo_path]);

  revalidatePath("/onboarding", "layout");
  revalidatePath("/", "layout");
  return { url: photoUrl(path)! };
}

export async function saveInterests(ids: number[], from?: string): Promise<{ error: string }> {
  const unique = [...new Set(ids)].filter((n) => Number.isInteger(n) && n >= 1 && n <= 14);
  if (unique.length < MIN_INTERESTS) return { error: `Pick at least ${MIN_INTERESTS}.` };

  const { supabase, userId } = await requireUser();
  const { error: delError } = await supabase.from("user_interests").delete().eq("user_id", userId);
  const { error } = delError
    ? { error: delError }
    : await supabase
        .from("user_interests")
        .insert(unique.map((interest_id) => ({ user_id: userId, interest_id })));
  if (error) return { error: "Couldn't save. Please try again." };

  revalidatePath("/onboarding", "layout");
  revalidatePath("/", "layout");
  redirect(nextPath("interests", from));
}

export async function saveLocation(
  areaSlug: string,
  radiusKm: number,
  from?: string,
  back?: string,
): Promise<{ error: string }> {
  const area = findArea(areaSlug);
  if (!area) return { error: "Choose an area." };
  if (!isRadius(radiusKm)) return { error: "Choose a radius." };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("users")
    .update({ area_name: area.name, city: CITY, lat: area.lat, lng: area.lng, radius_km: radiusKm })
    .eq("id", userId);
  if (error) return { error: "Couldn't save. Please try again." };

  revalidatePath("/onboarding", "layout");
  revalidatePath("/location");
  revalidatePath("/discover");
  revalidatePath("/activities");
  revalidatePath("/search", "layout");
  revalidatePath("/profile", "layout");
  redirect(withBackQuery(nextPath("location", from), from, back));
}

export async function completeOnboarding(): Promise<{ error: string }> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("users")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: "Something is missing from your profile. Check each step." };

  revalidatePath("/onboarding", "layout");
  redirect(AFTER_ONBOARDING_PATH);
}

// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { table: string; op: string; payload?: unknown }[] = [];
const uploads: { path: string; body: Buffer }[] = [];
const removed: string[][] = [];
let updateError: { message: string } | null = null;

function table(name: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: { photo_path: "u1/old.webp" }, error: null }),
    update: (payload: unknown) => {
      calls.push({ table: name, op: "update", payload });
      return { eq: async () => ({ error: updateError }) };
    },
    delete: () => {
      calls.push({ table: name, op: "delete" });
      return { eq: async () => ({ error: null }) };
    },
    insert: async (payload: unknown) => {
      calls.push({ table: name, op: "insert", payload });
      return { error: null };
    },
  };
  return chain;
}

const rpc = vi.fn(async () => ({ error: null }));
const signOut = vi.fn(async () => ({ error: null }));

const supabase = {
  from: table,
  rpc,
  auth: { signOut },
  storage: {
    from: () => ({
      upload: async (path: string, body: Buffer) => {
        uploads.push({ path, body });
        return { error: null };
      },
      remove: async (paths: string[]) => {
        removed.push(paths);
        return { error: null };
      },
    }),
  },
};

vi.mock("@/server/profile", () => ({
  requireUser: async () => ({ supabase, userId: "u1" }),
  photoUrl: (p: string) => `https://cdn.test/${p}`,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const actions = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  uploads.length = 0;
  removed.length = 0;
  updateError = null;
});

function form(fields: Record<string, string | File>) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

describe("saveAbout", () => {
  const valid = { firstName: " Aarav ", birthday: "01 / 02 / 1998", bio: "Hi", showAge: "on" };

  it("deletes an under-18 account (photo, then user) and signs out — even with other field errors", async () => {
    await expect(
      actions.saveAbout({ errors: {} }, form({ ...valid, firstName: "", birthday: "01 / 01 / 2015" })),
    ).rejects.toThrow("REDIRECT:/?account=deleted");
    expect(removed).toEqual([["u1/old.webp"]]);
    expect(rpc).toHaveBeenCalledWith("delete_underage_self", { p_birth_date: "2015-01-01" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
  });

  it("keeps the user signed in if deletion fails", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "x" } } as never);
    const res = await actions.saveAbout({ errors: {} }, form({ ...valid, birthday: "01 / 01 / 2015" }));
    expect(res.errors.form).toMatch(/delete/);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("saves trimmed values and continues to S04 (or back to review)", async () => {
    await expect(actions.saveAbout({ errors: {} }, form(valid))).rejects.toThrow(
      "REDIRECT:/onboarding/photo",
    );
    expect(calls[0].payload).toEqual({
      first_name: "Aarav",
      birth_date: "1998-02-01",
      show_age: true,
      bio: "Hi",
    });
    await expect(
      actions.saveAbout({ errors: {} }, form({ ...valid, from: "review" })),
    ).rejects.toThrow("REDIRECT:/onboarding/review");
  });

  it("maps the database 18+ rule to the birthday field", async () => {
    updateError = { message: "must_be_18" };
    const res = await actions.saveAbout({ errors: {} }, form(valid));
    expect(res.errors.birthday).toMatch(/18 or older/);
  });
});

describe("uploadPhoto", () => {
  it("rejects HEIC and other non JPEG/PNG/WebP files by content", async () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(32)]);
    const res = await actions.uploadPhoto(form({ photo: new File([heic], "a.jpg", { type: "image/jpeg" }) }));
    expect(res.error).toMatch(/JPEG, PNG or WebP/);
    expect(uploads).toHaveLength(0);
  });

  it("rejects files over 10 MB", async () => {
    const big = new File([Buffer.alloc(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    expect((await actions.uploadPhoto(form({ photo: big }))).error).toMatch(/10 MB/);
  });

  it("re-encodes to WebP without EXIF/GPS, saves the path and removes the old photo", async () => {
    const jpeg = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#c8a67c" } })
      .jpeg()
      .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "12/1 54/1 0/1" } })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined();

    const res = await actions.uploadPhoto(form({ photo: new File([jpeg], "me.jpg", { type: "image/jpeg" }) }));

    expect(res.url).toMatch(/^https:\/\/cdn\.test\/u1\/[0-9a-f-]{36}\.webp$/);
    const meta = await sharp(uploads[0].body).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width!, meta.height!)).toBe(1080);
    expect(calls).toContainEqual({ table: "users", op: "update", payload: { photo_path: uploads[0].path } });
    expect(removed).toEqual([["u1/old.webp"]]);
  });
});

describe("saveInterests", () => {
  it("needs at least 3 valid, unique interests", async () => {
    expect((await actions.saveInterests([1, 1, 99])).error).toMatch(/at least 3/);
    expect(calls).toHaveLength(0);
  });

  it("replaces the user's interests then continues", async () => {
    await expect(actions.saveInterests([1, 3, 5, 6])).rejects.toThrow("REDIRECT:/onboarding/location");
    expect(calls.map((c) => c.op)).toEqual(["delete", "insert"]);
    expect(calls[1].payload).toHaveLength(4);
  });
});

describe("saveLocation", () => {
  it("only accepts known areas and radius options", async () => {
    expect((await actions.saveLocation("atlantis", 5)).error).toMatch(/area/);
    expect((await actions.saveLocation("hsr-layout", 7)).error).toMatch(/radius/);
  });

  it("stores the area centroid from the server list, not client coordinates", async () => {
    await expect(actions.saveLocation("hsr-layout", 10)).rejects.toThrow("REDIRECT:/onboarding/review");
    expect(calls[0].payload).toEqual({
      area_name: "HSR Layout",
      city: "Bengaluru",
      lat: 12.9116,
      lng: 77.6474,
      radius_km: 10,
    });
  });
});

describe("completeOnboarding", () => {
  it("marks onboarding complete and lands on Discover", async () => {
    await expect(actions.completeOnboarding()).rejects.toThrow("REDIRECT:/discover");
  });

  it("reports when the database says a step is missing", async () => {
    updateError = { message: "onboarding_incomplete" };
    expect((await actions.completeOnboarding()).error).toMatch(/missing/);
  });
});

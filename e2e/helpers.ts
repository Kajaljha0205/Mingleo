import type { BrowserContext, Page } from "@playwright/test";

export const MOCK_URL = "http://localhost:54399";

type Row = Partial<{
  first_name: string | null;
  birth_date: string | null;
  show_age: boolean;
  bio: string | null;
  photo_path: string | null;
  area_name: string | null;
  city: string | null;
  radius_km: number;
  onboarding_completed_at: string | null;
}>;

export async function setState(row: Row, interestIds: number[] = [], opts: { people?: boolean } = {}) {
  await fetch(`${MOCK_URL}/__state`, {
    method: "POST",
    body: JSON.stringify({ row, interestIds, people: opts.people ?? false }),
  });
}

export async function getState() {
  return (await (await fetch(`${MOCK_URL}/__state`)).json()) as {
    row: Required<Row>;
    interestIds: number[];
    files: string[];
    people: { sent: string[]; received: string[]; connected: string[]; blocked: string[]; reports: unknown[]; round: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activities: { list: any[]; parts: any[]; messages: Record<string, any[]>; reports: any[] };
  };
}

/** A finished user in HSR Layout (5 km) who likes Badminton, Hiking and Cafe exploration, with demo people around. */
export async function seedOnboardedWithPeople(radiusKm = 5) {
  await setState(
    {
      ...COMPLETE_ABOUT,
      photo_path: "/images/people/aarav.svg",
      area_name: "HSR Layout",
      city: "Bengaluru",
      radius_km: radiusKm,
      onboarding_completed_at: "2026-11-23T00:00:00Z",
    },
    [1, 6, 8],
    { people: true },
  );
}

/** Puts a Supabase session cookie for user "u1" in the browser (HS256 → verified via mock /auth/v1/user). */
export async function signIn(context: BrowserContext) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: "u1",
    role: "authenticated",
    aud: "authenticated",
    exp,
  })}.sig`;
  const session = {
    access_token: accessToken,
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: { id: "u1", aud: "authenticated", role: "authenticated" },
  };
  await context.addCookies([
    {
      name: "sb-localhost-auth-token",
      value: `base64-${b64(session)}`,
      domain: "localhost",
      path: "/",
    },
  ]);
}

export async function expectNoHorizontalScroll(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  if (scrollWidth > width) throw new Error(`horizontal scroll: ${scrollWidth} > ${width}`);
}

export const COMPLETE_ABOUT = { first_name: "Aarav", birth_date: "1998-02-01", bio: "New to Bengaluru, product designer. Weekend badminton, board games and finding the city's best filter coffee." };

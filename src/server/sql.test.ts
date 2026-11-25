// @vitest-environment node
// Runs the real migrations (0001–0004) in an in-process Postgres (PGlite) with small stubs
// for Supabase's auth/storage schemas, then exercises §10/§11 rules through the RPCs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../supabase");
const sql = (f: string) => readFileSync(join(ROOT, f), "utf8");

const STUBS = `
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (
    id uuid primary key, instance_id uuid, aud text, role text, email text, encrypted_password text,
    email_confirmed_at timestamptz, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}',
    created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
    email_change_token_new text, email_change text
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`;

let db: PGlite;

// Area centroids (same as web/src/lib/locations/bengaluru.ts).
const HSR = [12.9116, 77.6474] as const;
const KORAMANGALA = [12.9352, 77.6245] as const; // ~3.6 km from HSR
const INDIRANAGAR = [12.9784, 77.6408] as const; // ~7.4 km from HSR

let n = 0;
async function addUser(
  name: string,
  where: readonly [number, number],
  interests: number[],
  opts: { showAge?: boolean; complete?: boolean; discoverable?: boolean; radius?: number; history?: string } = {},
) {
  const id = `10000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, jsonb_build_object('given_name', $2::text))`, [id, name]);
  for (const i of interests) await db.query(`insert into public.user_interests values ($1, $2)`, [id, i]);
  await db.query(
    `update public.users set birth_date = current_date - interval '28 years', show_age = $2, photo_path = 'p.webp',
       area_name = 'Area', city = 'Bengaluru', lat = $3, lng = $4, radius_km = $5, discoverable = $6,
       history_visibility = $7 where id = $1`,
    [id, opts.showAge ?? true, where[0], where[1], opts.radius ?? 5, opts.discoverable ?? true, opts.history ?? "connections"],
  );
  if (opts.complete ?? true) {
    // Small interest sets keep the maths readable; skip the "≥ 3 interests to finish" trigger here.
    await db.exec(`set session_replication_role = replica`);
    await db.query(`update public.users set onboarding_completed_at = now() where id = $1`, [id]);
    await db.exec(`set session_replication_role = origin`);
  }
  return id;
}

async function as(id: string | null) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? ""]);
}

async function candidates(interest: number | null = null) {
  const r = await db.query<{ id: string; first_name: string; age: number | null; score: number; shared_count: number }>(
    `select * from public.discover_candidates($1)`,
    [interest],
  );
  return r.rows;
}

async function rpc<T = unknown>(fn: string, ...args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(", ");
  const r = await db.query<{ v: T }>(`select public.${fn}(${params}) as v`, args);
  return r.rows[0].v;
}

async function profile(id: string) {
  return rpc<Record<string, unknown> | null>("person_profile", id);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const f of ["0001_onboarding.sql", "0002_grants.sql", "0003_delete_underage.sql", "0004_discover.sql", "0005_activities.sql", "0006_feed_viewer_state.sql", "0007_feed_people_radius.sql", "0008_chat.sql", "0009_seen_live.sql", "0010_search.sql", "0011_inbox_profile.sql", "0012_settings.sql"]) {
    await db.exec(sql(`migrations/${f}`));
  }
}, 60_000);

beforeEach(async () => {
  await as(null);
  await db.exec(`truncate auth.users cascade`);
});

describe("discover_candidates (§11)", () => {
  it("ranks by 0.8·cosine(interests) + 0.2·(1 − d/R)", async () => {
    const me = await addUser("Me", HSR, [1, 2, 3]);
    await addUser("Same", KORAMANGALA, [1, 2, 3]); // sim 1, d≈3.6 → 0.8 + 0.2·0.28
    await addUser("Partial", HSR, [1]); // sim 1/√3, d 0 → 0.46 + 0.2
    await addUser("None", HSR, [4, 5, 6]); // sim 0 → 0.2
    await as(me);
    const rows = await candidates();
    expect(rows.map((r) => r.first_name)).toEqual(["Same", "Partial", "None"]);
    expect(rows[0].score).toBeCloseTo(0.8 + 0.2 * (1 - 3.6 / 5), 1);
    expect(rows[1].score).toBeCloseTo(0.8 / Math.sqrt(3) + 0.2, 2);
    expect(rows.map((r) => r.shared_count)).toEqual([3, 1, 0]);
  });

  it("never returns coordinates or birth dates, and hides age when show_age is off", async () => {
    const me = await addUser("Me", HSR, [1]);
    await addUser("Hidden age", HSR, [1], { showAge: false });
    await as(me);
    const [row] = await candidates();
    expect(row.age).toBeNull();
    expect(Object.keys(row)).not.toEqual(expect.arrayContaining(["lat"]));
    expect(Object.keys(row)).not.toContain("lng");
    expect(Object.keys(row)).not.toContain("birth_date");
  });

  it("excludes self, out-of-radius, hidden, unfinished, blocked, connected and pending people", async () => {
    const me = await addUser("Me", HSR, [1, 2]);
    const ok = await addUser("Ok", HSR, [1]);
    await addUser("Far", INDIRANAGAR, [1]);
    await addUser("Hidden", HSR, [1], { discoverable: false });
    await addUser("Unfinished", HSR, [1], { complete: false });
    const iBlocked = await addUser("IBlocked", HSR, [1]);
    const blockedMe = await addUser("BlockedMe", HSR, [1]);
    const friend = await addUser("Friend", HSR, [1]);
    const asked = await addUser("Asked", HSR, [1]);
    const askedMe = await addUser("AskedMe", HSR, [1]);

    await as(me);
    await rpc("block_user", iBlocked);
    await rpc("send_connection_request", asked);
    await as(blockedMe);
    await rpc("block_user", me);
    await as(askedMe);
    await rpc("send_connection_request", me);
    await as(friend);
    await rpc("send_connection_request", me);
    await as(me);
    await rpc("send_connection_request", friend); // accepts Friend's request

    expect((await candidates()).map((r) => r.id)).toEqual([ok]);
  });

  it("includes people within a larger radius", async () => {
    const me = await addUser("Me", HSR, [1], { radius: 10 });
    await addUser("Far", INDIRANAGAR, [1]);
    await as(me);
    expect(await candidates()).toHaveLength(1);
  });

  it("filters to one of my interests", async () => {
    const me = await addUser("Me", HSR, [1, 2]);
    await addUser("Badminton", HSR, [1]);
    await addUser("Swimming", HSR, [2]);
    await as(me);
    expect((await candidates(1)).map((r) => r.first_name)).toEqual(["Badminton"]);
    expect(await candidates(9)).toHaveLength(0); // not one of mine
  });

  it("skips hide people for this round only; Start over brings them back", async () => {
    const me = await addUser("Me", HSR, [1]);
    const other = await addUser("Other", HSR, [1]);
    await as(me);
    await rpc("skip_profile", other);
    expect(await candidates()).toHaveLength(0);
    await rpc("start_over_discover");
    expect(await candidates()).toHaveLength(1);
  });

  it("returns nothing for a viewer who hasn't finished onboarding", async () => {
    const me = await addUser("Me", HSR, [1], { complete: false });
    await addUser("Other", HSR, [1]);
    await as(me);
    expect(await candidates()).toHaveLength(0);
  });
});

describe("connection requests (§10 transition table)", () => {
  async function notifications(userId: string) {
    return (await db.query<{ type: string }>(`select type from public.notifications where user_id = $1 order by created_at`, [userId])).rows.map((r) => r.type);
  }

  it("send → pending + notify B; repeat is a no-op; B's Connect accepts", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await as(a);
    expect(await rpc("send_connection_request", b)).toBe("sent");
    expect(await rpc("send_connection_request", b)).toBe("sent");
    expect(await notifications(b)).toEqual(["connection_request"]);
    expect((await profile(b))?.relationship).toBe("sent");

    await as(b);
    expect((await profile(a))?.relationship).toBe("received");
    expect(await rpc("send_connection_request", a)).toBe("connected");
    expect(await notifications(a)).toEqual(["connection_accepted"]);
    expect((await profile(a))?.relationship).toBe("connected");
  });

  it("respects B's 'Connection requests' notification setting", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await db.query(`update public.users set notify_connection_requests = false where id = $1`, [b]);
    await as(a);
    await rpc("send_connection_request", b);
    expect(await notifications(b)).toEqual([]);
  });

  it("withdraw removes B's notification", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await as(a);
    await rpc("send_connection_request", b);
    expect(await rpc("withdraw_connection_request", b)).toBe("none");
    expect(await notifications(b)).toEqual([]);
    expect((await profile(b))?.relationship).toBe("none");
  });

  it("decline notifies A only when A opted in, and A must wait 30 days", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await as(a);
    await rpc("send_connection_request", b);
    await as(b);
    expect(await rpc("respond_connection_request", a, false)).toBe("none");
    expect(await notifications(a)).toEqual([]); // default off (S22)

    await as(a);
    await expect(rpc("send_connection_request", b)).rejects.toThrow(/cooldown/);
    await db.query(`update public.connection_requests set responded_at = now() - interval '31 days'`);
    expect(await rpc("send_connection_request", b)).toBe("sent");

    await db.query(`update public.users set notify_request_declined = true where id = $1`, [a]);
    await as(b);
    await rpc("respond_connection_request", a, false);
    expect(await notifications(a)).toEqual(["connection_declined"]);
  });

  it("accept creates one connection (a < b) and notifies A", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await as(a);
    await rpc("send_connection_request", b);
    await as(b);
    expect(await rpc("respond_connection_request", a, true)).toBe("connected");
    const { rows } = await db.query<{ user_a: string; user_b: string }>(`select * from public.connections`);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_a < rows[0].user_b).toBe(true);
    expect(await notifications(a)).toEqual(["connection_accepted"]);
  });

  it("rate-limits to 30 requests per day", async () => {
    const me = await addUser("Me", HSR, [1]);
    const others = [];
    for (let i = 0; i < 31; i++) others.push(await addUser(`P${i}`, HSR, [1]));
    await as(me);
    for (const o of others.slice(0, 30)) await rpc("send_connection_request", o);
    await expect(rpc("send_connection_request", others[30])).rejects.toThrow(/rate_limited/);
  });

  it("only one open request per pair (database constraint)", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await db.query(`insert into public.connection_requests (from_user, to_user) values ($1, $2)`, [a, b]);
    await expect(
      db.query(`insert into public.connection_requests (from_user, to_user) values ($1, $2)`, [b, a]),
    ).rejects.toThrow(/one_open_per_pair/);
  });
});

describe("block & report (§10 rule 7, ST-190/192)", () => {
  it("block removes connection + requests and hides both people from each other", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await as(a);
    await rpc("send_connection_request", b);
    await as(b);
    await rpc("respond_connection_request", a, true);
    await rpc("block_user", a);

    expect((await db.query(`select * from public.connections`)).rows).toHaveLength(0);
    expect((await db.query(`select * from public.notifications`)).rows).toHaveLength(0);
    expect(await profile(a)).toBeNull();
    await as(a);
    expect(await profile(b)).toBeNull();
    await expect(rpc("send_connection_request", b)).rejects.toThrow(/not_found/);
    expect(await candidates()).toHaveLength(0);
  });

  it("stores reports with a valid reason only", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await as(a);
    await rpc("report_user", b, "spam", "  ");
    const { rows } = await db.query<{ reason: string; note: string | null }>(`select * from public.reports`);
    expect(rows).toEqual([expect.objectContaining({ reason: "spam", note: null })]);
    await expect(rpc("report_user", b, "rude")).rejects.toThrow(/check/);
  });
});

describe("person_profile (S09)", () => {
  it("shows mutual connections, shared interests and history visibility per the owner's setting", async () => {
    const me = await addUser("Me", HSR, [1, 2]);
    const meera = await addUser("Meera", KORAMANGALA, [1, 3], { history: "nearby", radius: 5 });
    const rohan = await addUser("Rohan", HSR, [1]);
    const sneha = await addUser("Sneha", HSR, [1]);
    for (const [x, y] of [[me, rohan], [me, sneha], [meera, rohan], [meera, sneha]]) {
      await db.query(`insert into public.connections values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [x, y]);
    }
    await as(me);
    const p = (await profile(meera))!;
    expect((p.mutual as { first_name: string }[]).map((m) => m.first_name)).toEqual(["Rohan", "Sneha"]);
    expect(p.interest_ids).toEqual([1, 3]);
    expect(p.distance_km).toBeCloseTo(3.6, 0);
    expect(p).not.toHaveProperty("lat");
    expect(p.history_visible).toBe(true); // "Everyone nearby" and within Meera's radius

    await db.query(`update public.users set history_visibility = 'connections' where id = $1`, [meera]);
    expect((await profile(meera))!.history_visible).toBe(false);
    await db.query(`update public.users set history_visibility = 'only_me' where id = $1`, [meera]);
    expect((await profile(meera))!.history_visible).toBe(false);
  });

  it("404s (null) for unknown, unfinished and own profiles", async () => {
    const me = await addUser("Me", HSR, [1]);
    const unfinished = await addUser("U", HSR, [1], { complete: false });
    await as(me);
    expect(await profile(unfinished)).toBeNull();
    expect(await profile(me)).toBeNull();
    expect(await profile("10000000-0000-4000-8000-999999999999")).toBeNull();
  });
});

async function connectUsers(x: string, y: string) {
  await db.query(`insert into public.connections values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [x, y]);
}

type NewActivity = Partial<{
  interest: number; title: string; where: readonly [number, number]; address: string | null;
  startsIn: string; limit: number; visibility: string;
}>;

async function createActivity(host: string, o: NewActivity = {}) {
  await as(host);
  const where = o.where ?? HSR;
  const r = await db.query<{ v: string }>(
    `select public.create_activity($1::smallint, $2, 'Details', 'Area', 'Bengaluru', $3, $4, $5,
       now() + $6::interval, null, $7::smallint, $8) as v`,
    [o.interest ?? 1, o.title ?? "Doubles", where[0], where[1], o.address === undefined ? "Court 3" : o.address,
      o.startsIn ?? "2 days", o.limit ?? 4, o.visibility ?? "connections_and_nearby"],
  );
  return r.rows[0].v;
}

async function feed() {
  return (await db.query<{ id: string; section: string; title: string; going: number }>(`select * from public.activities_feed()`)).rows;
}

async function details(id: string) {
  return rpc<Record<string, unknown> | null>("activity_details", id);
}

async function manage(id: string) {
  return rpc<{ requests: { id: string; first_name: string }[]; participants: unknown[]; going: number } | null>("manage_activity", id);
}

async function notificationTypes(userId: string) {
  return (await db.query<{ type: string }>(
    `select type from public.notifications where user_id = $1 and created_at <= now() order by created_at`, [userId],
  )).rows.map((r) => r.type);
}

describe("activities feed (ST-090, §10 rules 5 & 7)", () => {
  it("From your people: any connection's open activity within my radius; Nearby: matching interest, within radius, not connections-only", async () => {
    const me = await addUser("Me", HSR, [1, 2]);
    const friend = await addUser("Friend", KORAMANGALA, [9]);
    const stranger = await addUser("Stranger", KORAMANGALA, [1]);
    await connectUsers(me, friend);

    await createActivity(friend, { title: "Friend shopping", interest: 9, where: KORAMANGALA, visibility: "connections" });
    await createActivity(friend, { title: "Friend too far", interest: 9, where: INDIRANAGAR });
    await createActivity(stranger, { title: "Nearby doubles", interest: 1, where: KORAMANGALA, startsIn: "1 day" });
    await createActivity(stranger, { title: "Not my interest", interest: 3, where: KORAMANGALA });
    await createActivity(stranger, { title: "Connections only", interest: 1, visibility: "connections" });
    await createActivity(stranger, { title: "Too far", interest: 1, where: INDIRANAGAR });
    await createActivity(me, { title: "Mine" });

    await as(me);
    const rows = await feed();
    expect(rows.map((r) => [r.section, r.title])).toEqual([
      ["nearby", "Nearby doubles"],
      ["people", "Friend shopping"],
    ]);
    expect(Object.keys(rows[0])).not.toEqual(expect.arrayContaining(["lat"]));
    expect(Object.keys(rows[0])).not.toContain("address");
  });

  it("returns the viewer's join state for inline Request to join", async () => {
    const me = await addUser("Me", HSR, [1]);
    const host = await addUser("Host", HSR, [1]);
    const id = await createActivity(host);
    await as(me);
    expect((await feed()).map((r) => (r as unknown as { viewer_state: string }).viewer_state)).toEqual(["none"]);
    await rpc("request_to_join", id);
    expect((await feed()).map((r) => (r as unknown as { viewer_state: string }).viewer_state)).toEqual(["requested"]);
  });

  it("excludes cancelled, started and blocked hosts; keeps full ones", async () => {
    const me = await addUser("Me", HSR, [1]);
    const host = await addUser("Host", HSR, [1]);
    const other = await addUser("Other", HSR, [1]);
    const full = await createActivity(host, { title: "Full", limit: 2 });
    const cancelled = await createActivity(host, { title: "Cancelled" });
    const started = await createActivity(host, { title: "Started" });
    await db.query(`alter table public.activities disable trigger activities_locked`);
    await db.query(`update public.activities set starts_at = now() - interval '1 hour' where id = $1`, [started]);
    await db.query(`alter table public.activities enable trigger activities_locked`);
    await as(host);
    await rpc("cancel_activity", cancelled, null);
    await as(other);
    await rpc("request_to_join", full);
    const [req] = (await manageAs(host, full))!.requests;
    await as(host);
    await rpc("accept_join_request", req.id);

    await as(me);
    expect((await feed()).map((r) => [r.title, r.going])).toEqual([["Full", 2]]);
    await rpc("block_user", host);
    expect(await feed()).toEqual([]);
  });

  it("hides activities where a blocked person is going", async () => {
    const me = await addUser("Me", HSR, [1]);
    const host = await addUser("Host", HSR, [1]);
    const blocked = await addUser("Blocked", HSR, [1]);
    const id = await createActivity(host);
    await as(blocked);
    await rpc("request_to_join", id);
    await as(host);
    await rpc("accept_join_request", (await manage(id))!.requests[0].id);
    await as(me);
    expect(await feed()).toHaveLength(1);
    await rpc("block_user", blocked);
    expect(await feed()).toHaveLength(0);
  });
});

async function manageAs(host: string, id: string) {
  await as(host);
  return manage(id);
}

describe("activity details & visibility (ST-100, ST-101)", () => {
  it("connections-only: invisible to non-connections by direct URL and request", async () => {
    const host = await addUser("Host", HSR, [1]);
    const friend = await addUser("Friend", HSR, [1]);
    const stranger = await addUser("Stranger", HSR, [1]);
    await connectUsers(host, friend);
    const id = await createActivity(host, { visibility: "connections" });

    await as(stranger);
    expect(await details(id)).toBeNull();
    await expect(rpc("request_to_join", id)).rejects.toThrow(/not_found/);
    await as(friend);
    expect((await details(id))!.viewer_state).toBe("none");
  });

  it("exact address only for the host and accepted participants; never coordinates", async () => {
    const host = await addUser("Host", HSR, [1]);
    const guest = await addUser("Guest", HSR, [1]);
    const id = await createActivity(host, { address: "Court 3, 27th Main" });

    await as(guest);
    const before = (await details(id))!;
    expect(before.address).toBeNull();
    expect(before.area_name).toBe("Area");
    expect(before).not.toHaveProperty("lat");
    expect(JSON.stringify(before)).not.toContain("27th Main");
    await rpc("request_to_join", id);
    expect((await details(id))!.address).toBeNull();

    await as(host);
    expect((await details(id))!.address).toBe("Court 3, 27th Main");
    await rpc("accept_join_request", (await manage(id))!.requests[0].id);
    await as(guest);
    expect((await details(id))!.address).toBe("Court 3, 27th Main");
  });

  it("blocked pairs never see each other's activities or each other in Who's going", async () => {
    const host = await addUser("Host", HSR, [1]);
    const me = await addUser("Me", HSR, [1]);
    const id = await createActivity(host);
    await as(me);
    expect(await details(id)).not.toBeNull();
    await as(host);
    await rpc("block_user", me);
    await as(me);
    expect(await details(id)).toBeNull();
  });

  it("host card: relationship, shared interests and hosted count", async () => {
    const host = await addUser("Host", HSR, [1, 2, 3]);
    const me = await addUser("Me", HSR, [1, 2]);
    const id = await createActivity(host);
    await createActivity(host, { title: "Second" });
    await as(me);
    const d = (await details(id))!;
    expect(d.host).toEqual(expect.objectContaining({ first_name: "Host", connected: false, shared_count: 2, hosted_count: 2 }));
    expect(d.going).toBe(1);
    expect((d.participants as { role: string }[]).map((p) => p.role)).toEqual(["host"]);
  });
});

describe("publish & edit (ST-113, ST-114)", () => {
  it("validates server-side: future start, limits, title and end after start", async () => {
    const host = await addUser("Host", HSR, [1]);
    await expect(createActivity(host, { startsIn: "-1 hour" })).rejects.toThrow(/start_in_past/);
    await expect(createActivity(host, { limit: 21 })).rejects.toThrow(/check/);
    await expect(createActivity(host, { limit: 1 })).rejects.toThrow(/check/);
    await expect(createActivity(host, { title: "x".repeat(61) })).rejects.toThrow(/check/);
    await expect(createActivity(host, { visibility: "everyone" })).rejects.toThrow(/check/);
    await expect(createActivity(host, { interest: 99 })).rejects.toThrow(/foreign key/);
  });

  it("host is the first accepted participant; connections sharing the interest are notified per their setting", async () => {
    const host = await addUser("Host", HSR, [1]);
    const fan = await addUser("Fan", HSR, [1]);
    const optedOut = await addUser("OptedOut", HSR, [1]);
    const otherInterest = await addUser("Other", HSR, [2]);
    const stranger = await addUser("Stranger", HSR, [1]);
    for (const c of [fan, optedOut, otherInterest]) await connectUsers(host, c);
    await db.query(`update public.users set notify_new_activities = false where id = $1`, [optedOut]);

    const id = await createActivity(host, { interest: 1 });
    expect((await manage(id))!.going).toBe(1);
    expect(await notificationTypes(fan)).toEqual(["activity_created"]);
    for (const u of [optedOut, otherInterest, stranger]) expect(await notificationTypes(u)).toEqual([]);
  });

  it("only title and details can change after publishing", async () => {
    const host = await addUser("Host", HSR, [1]);
    const other = await addUser("Other", HSR, [1]);
    const id = await createActivity(host);
    await rpc("update_activity_details", id, "New title", "");
    const d = (await details(id))!;
    expect([d.title, d.description]).toEqual(["New title", null]);
    await expect(
      db.query(`update public.activities set starts_at = starts_at + interval '1 day' where id = $1`, [id]),
    ).rejects.toThrow(/locked_field/);
    await expect(db.query(`update public.activities set participant_limit = 10 where id = $1`, [id])).rejects.toThrow(/locked_field/);
    await expect(db.query(`update public.activities set interest_id = 2 where id = $1`, [id])).rejects.toThrow(/locked_field/);
    await as(other);
    await expect(rpc("update_activity_details", id, "Hijack", "")).rejects.toThrow(/not_found/);
  });
});

describe("join requests (ST-104, §10 transitions)", () => {
  it("request → notify host; withdraw removes it; joining never creates a connection", async () => {
    const host = await addUser("Host", HSR, [1]);
    const guest = await addUser("Guest", HSR, [1]);
    const id = await createActivity(host);
    await as(guest);
    expect(await rpc("request_to_join", id)).toBe("requested");
    expect(await rpc("request_to_join", id)).toBe("requested");
    expect((await details(id))!.viewer_state).toBe("requested");
    expect(await notificationTypes(host)).toEqual(["join_requested"]);

    expect(await rpc("withdraw_join_request", id)).toBe("none");
    expect((await details(id))!.viewer_state).toBe("none");
    expect(await notificationTypes(host)).toEqual([]);

    await rpc("request_to_join", id);
    await as(host);
    await rpc("accept_join_request", (await manage(id))!.requests[0].id);
    expect(await notificationTypes(guest)).toEqual(["join_accepted"]);
    expect((await db.query(`select * from public.connections`)).rows).toHaveLength(0);
  });

  it("withdraw from an accepted activity frees a spot and notifies the host", async () => {
    const host = await addUser("Host", HSR, [1]);
    const guest = await addUser("Guest", HSR, [1]);
    const id = await createActivity(host, { limit: 2 });
    await as(guest);
    await rpc("request_to_join", id);
    await as(host);
    await rpc("accept_join_request", (await manage(id))!.requests[0].id);
    await as(guest);
    expect((await details(id))!.going).toBe(2);
    expect(await rpc("withdraw_from_activity", id)).toBe("withdrawn");
    expect((await details(id))!.going).toBe(1);
    expect(await notificationTypes(host)).toContain("participant_withdrew");
    await as(host);
    await expect(rpc("withdraw_from_activity", id)).rejects.toThrow(/not_found/); // host can't withdraw
  });

  it("full: new requests are refused, pending ones stay but can't be accepted until a spot frees", async () => {
    const host = await addUser("Host", HSR, [1]);
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    const c = await addUser("C", HSR, [1]);
    const id = await createActivity(host, { limit: 2 });
    for (const u of [a, b]) {
      await as(u);
      await rpc("request_to_join", id);
    }
    const [ra, rb] = (await manageAs(host, id))!.requests;
    await rpc("accept_join_request", ra.id);
    await expect(rpc("accept_join_request", rb.id)).rejects.toThrow(/full/);
    expect((await manage(id))!.requests.map((r) => r.first_name)).toEqual(["B"]);
    await as(c);
    await expect(rpc("request_to_join", id)).rejects.toThrow(/full/);

    await as(a);
    await rpc("withdraw_from_activity", id);
    await as(host);
    expect(await rpc("accept_join_request", rb.id)).toBe("accepted");
  });

  it("simultaneous accepts never overfill (row lock)", async () => {
    const host = await addUser("Host", HSR, [1]);
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push(await addUser(`G${i}`, HSR, [1]));
    const id = await createActivity(host, { limit: 3 });
    for (const u of ids) {
      await as(u);
      await rpc("request_to_join", id);
    }
    const reqs = (await manageAs(host, id))!.requests;
    const results = await Promise.allSettled(reqs.map((r) => rpc("accept_join_request", r.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await manage(id))!.going).toBe(3);
  });

  it("only the host can see requests or accept", async () => {
    const host = await addUser("Host", HSR, [1]);
    const guest = await addUser("Guest", HSR, [1]);
    const id = await createActivity(host);
    await as(guest);
    await rpc("request_to_join", id);
    expect(await manage(id)).toBeNull();
    const [req] = (await manageAs(host, id))!.requests;
    await as(guest);
    await expect(rpc("accept_join_request", req.id)).rejects.toThrow(/not_found/);
  });
});

describe("decline with 10 s Undo (ST-123)", () => {
  async function setup() {
    const host = await addUser("Host", HSR, [1]);
    const guest = await addUser("Guest", HSR, [1]);
    const id = await createActivity(host);
    await as(guest);
    await rpc("request_to_join", id);
    const [req] = (await manageAs(host, id))!.requests;
    return { host, guest, id, req };
  }

  it("inside the window: requester still sees Requested and gets nothing; Undo restores the request", async () => {
    const { host, guest, id, req } = await setup();
    await rpc("decline_join_request", req.id);
    expect((await manage(id))!.requests).toEqual([]);
    await as(guest);
    expect((await details(id))!.viewer_state).toBe("requested");
    expect(await notificationTypes(guest)).toEqual([]);

    await as(host);
    await rpc("undo_decline", req.id);
    expect((await manage(id))!.requests).toHaveLength(1);
    expect((await db.query(`select * from public.notifications where type = 'join_declined'`)).rows).toHaveLength(0);
  });

  it("after the window: committed as declined, requester notified, Undo too late, can't request again", async () => {
    const { guest, id, req } = await setup();
    await rpc("decline_join_request", req.id);
    // Let the window pass.
    await db.query(`update public.participations set decline_at = now() - interval '1 second' where id = $1`, [req.id]);
    await db.query(`update public.notifications set created_at = now() - interval '1 second' where type = 'join_declined'`);
    await expect(rpc("undo_decline", req.id)).rejects.toThrow(/too_late/);
    await as(guest);
    expect((await details(id))!.viewer_state).toBe("declined");
    expect(await notificationTypes(guest)).toEqual(["join_declined"]);
    await expect(rpc("request_to_join", id)).rejects.toThrow(/declined/);
  });

  it("respects the requester's 'Join decisions and cancellations' setting", async () => {
    const { guest, req } = await setup();
    await db.query(`update public.users set notify_join_decisions = false where id = $1`, [guest]);
    await rpc("decline_join_request", req.id);
    expect((await db.query(`select * from public.notifications where user_id = $1`, [guest])).rows).toHaveLength(0);
  });
});

describe("cancel (ST-126)", () => {
  it("cancels with a note, closes requests, notifies everyone involved and leaves discovery", async () => {
    const host = await addUser("Host", HSR, [1]);
    const going = await addUser("Going", HSR, [1]);
    const waiting = await addUser("Waiting", HSR, [1]);
    const viewer = await addUser("Viewer", HSR, [1]);
    const id = await createActivity(host);
    for (const u of [going, waiting]) {
      await as(u);
      await rpc("request_to_join", id);
    }
    await as(host);
    await rpc("accept_join_request", (await manage(id))!.requests[0].id);
    expect(await rpc("cancel_activity", id, " Rain, sorry! ")).toBe("cancelled");

    expect((await manage(id))!).toEqual(expect.objectContaining({ phase: "cancelled", cancel_note: "Rain, sorry!" }));
    for (const u of [going, waiting]) {
      expect(await notificationTypes(u)).toContain("activity_cancelled");
      await as(u);
      expect((await details(id))!).toEqual(expect.objectContaining({ phase: "cancelled", viewer_state: "closed" }));
    }
    await as(viewer);
    expect(await details(id)).toBeNull();
    expect(await feed()).toEqual([]);
    await as(host);
    await expect(rpc("cancel_activity", id, null)).rejects.toThrow(/closed/);
    await expect(rpc("update_activity_details", id, "x", "")).rejects.toThrow(/not_found/);
  });
});

async function shiftActivity(id: string, startsAgo: string, endsAgo: string | null = null) {
  await db.query(`alter table public.activities disable trigger activities_locked`);
  await db.query(
    `update public.activities set starts_at = now() - $2::interval, ends_at = case when $3::text is null then null else now() - $3::interval end where id = $1`,
    [id, startsAgo, endsAgo],
  );
  await db.query(`alter table public.activities enable trigger activities_locked`);
}

type Thread = {
  read_only: string | null; members: { first_name: string }[]; messages: { body: string; sender_id: string }[];
  seen_by: number; activity: Record<string, unknown> | null; other: { first_name: string } | null;
};

async function joinAccepted(host: string, guest: string, id: string) {
  await as(guest);
  await rpc("request_to_join", id);
  const [req] = (await manageAs(host, id))!.requests;
  await rpc("accept_join_request", req.id);
}

describe("chat (ST-140–145, §12)", () => {
  async function setup() {
    const host = await addUser("Host", HSR, [1]);
    const guest = await addUser("Guest", HSR, [1]);
    const outsider = await addUser("Outsider", HSR, [1]);
    const id = await createActivity(host);
    await joinAccepted(host, guest, id);
    await as(guest);
    const cid = await rpc<string>("activity_conversation", id);
    return { host, guest, outsider, id, cid };
  }

  it("group chat: host + accepted only; withdraw removes access; outsiders can't read or send", async () => {
    const { host, guest, outsider, id, cid } = await setup();
    expect(cid).toBeTruthy();
    const t = (await rpc<Thread>("chat_thread", cid))!;
    expect(t.members.map((m) => m.first_name)).toEqual(["Host", "Guest"]);
    expect(t.activity).toEqual(expect.objectContaining({ host_first_name: "Host", viewer_role: "participant", going: 2 }));
    expect(t.read_only).toBeNull();

    await as(outsider);
    expect(await rpc("activity_conversation", id)).toBeNull();
    expect(await rpc("chat_thread", cid)).toBeNull();
    await expect(rpc("send_message", cid, "hi")).rejects.toThrow(/not_found/);
    expect(await rpc("can_read_message", cid, host)).toBe(false);

    await as(guest);
    await rpc("withdraw_from_activity", id);
    expect(await rpc("chat_thread", cid)).toBeNull();
  });

  it("send: text only, 1–1000 chars, trimmed; Seen by n counts other members who read it", async () => {
    const { host, guest, cid } = await setup();
    await as(guest);
    await expect(rpc("send_message", cid, "   ")).rejects.toThrow(/invalid_body/);
    await expect(rpc("send_message", cid, "x".repeat(1001))).rejects.toThrow(/invalid_body/);
    const m = await rpc<{ body: string }>("send_message", cid, "  On my way  ");
    expect(m.body).toBe("On my way");
    expect((await rpc<Thread>("chat_thread", cid))!.seen_by).toBe(0);
    await as(host);
    expect((await rpc<Thread>("chat_thread", cid))!.messages.map((x) => x.body)).toEqual(["On my way"]);
    await rpc("mark_read", cid);
    await as(guest);
    expect((await rpc<Thread>("chat_thread", cid))!.seen_by).toBe(1);
  });

  it("cancelled → read-only (people still read); completed → open 7 days, then read-only", async () => {
    const { host, guest, id, cid } = await setup();
    await as(host);
    await rpc("send_message", cid, "See you");
    await shiftActivity(id, "3 days 2 hours", "3 days");
    await as(guest);
    expect((await rpc<Thread>("chat_thread", cid))!.read_only).toBeNull();
    await rpc("send_message", cid, "Good game!");
    await shiftActivity(id, "8 days 2 hours", "8 days");
    expect((await rpc<Thread>("chat_thread", cid))!.read_only).toBe("closed");
    await expect(rpc("send_message", cid, "late")).rejects.toThrow(/read_only/);

    const other = await createActivity(host, { title: "Other" });
    await joinAccepted(host, guest, other);
    await as(host);
    await rpc("cancel_activity", other, null);
    await as(guest);
    const ocid = await rpc<string>("activity_conversation", other);
    const t = (await rpc<Thread>("chat_thread", ocid))!;
    expect(t.read_only).toBe("cancelled");
    await expect(rpc("send_message", ocid, "hi")).rejects.toThrow(/read_only/);
  });

  it("blocked pairs don't see each other's messages (Q-19)", async () => {
    const { host, guest, cid } = await setup();
    await as(guest);
    await rpc("send_message", cid, "from guest");
    await as(host);
    await rpc("block_user", guest);
    const t = (await rpc<Thread>("chat_thread", cid))!;
    expect(t.messages).toEqual([]);
    expect(t.members.map((m) => m.first_name)).toEqual(["Host"]);
    expect(await rpc("can_read_message", cid, guest)).toBe(false);
  });

  it("read times: members see each other's last_read_at (RLS), outsiders and blocked people don't", async () => {
    const { host, guest, outsider, cid } = await setup();
    const readable = async (who: string) => {
      await as(who);
      await db.exec(`set role authenticated`);
      try {
        const r = await db.query<{ user_id: string }>(`select user_id from public.conversation_members where conversation_id = $1`, [cid]);
        return r.rows.map((x) => x.user_id).sort();
      } finally {
        await db.exec(`reset role`);
      }
    };
    expect(await readable(guest)).toEqual([host, guest].sort());
    expect(await readable(outsider)).toEqual([]);
    await as(host);
    await rpc("block_user", guest);
    expect(await readable(host)).toEqual([host]);
  });

  it("direct chat: created on connect, ends on remove / block, history back on reconnect", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await as(a);
    expect(await rpc("direct_conversation", b)).toBeNull();
    await rpc("send_connection_request", b);
    await as(b);
    await rpc("respond_connection_request", a, true);
    const cid = await rpc<string>("direct_conversation", a);
    expect(cid).toBeTruthy();
    await rpc("send_message", cid, "Hi A");
    await as(a);
    expect(await rpc("direct_conversation", b)).toBe(cid);
    const t = (await rpc<Thread>("chat_thread", cid))!;
    expect([t.other?.first_name, t.activity, t.messages.map((m) => m.body)]).toEqual(["B", null, ["Hi A"]]);

    await rpc("remove_connection", b);
    expect(await rpc("chat_thread", cid)).toBeNull();
    await expect(rpc("send_message", cid, "still there?")).rejects.toThrow(/not_found/);

    await connectUsers(a, b);
    expect((await rpc<Thread>("chat_thread", cid))!.messages).toHaveLength(1);
  });
});

describe("after the activity (ST-131, ST-193)", () => {
  it("only for people who took part; lists the others with relationship and times played together", async () => {
    const host = await addUser("Host", HSR, [1]);
    const me = await addUser("Me", HSR, [1]);
    const pal = await addUser("Pal", HSR, [1]);
    const outsider = await addUser("Outsider", HSR, [1]);
    const first = await createActivity(host, { title: "First" });
    const second = await createActivity(host, { title: "Second" });
    for (const id of [first, second]) {
      await joinAccepted(host, me, id);
      await joinAccepted(host, pal, id);
      await shiftActivity(id, "1 day");
    }
    await connectUsers(me, pal);

    await as(outsider);
    expect(await rpc("after_activity", second)).toBeNull();
    await as(me);
    const d = (await rpc<{ phase: string; viewer_first_name: string; participants: Record<string, unknown>[] }>("after_activity", second))!;
    expect(d.phase).toBe("completed");
    expect(d.viewer_first_name).toBe("Me");
    expect(d.participants).toEqual([
      expect.objectContaining({ first_name: "Host", is_host: true, relationship: "none", together: 2 }),
      expect.objectContaining({ first_name: "Pal", is_host: false, relationship: "connected", together: 2 }),
    ]);
    expect(JSON.stringify(d)).not.toContain("\"lat\"");
  });

  it("stores an activity report for manual review", async () => {
    const host = await addUser("Host", HSR, [1]);
    const me = await addUser("Me", HSR, [1]);
    const id = await createActivity(host);
    await as(me);
    await rpc("report_activity", id, "spam", " no-show ");
    const { rows } = await db.query(`select reported_user, target_activity_id, reason, note from public.reports`);
    expect(rows).toEqual([{ reported_user: null, target_activity_id: id, reason: "spam", note: "no-show" }]);
  });
});

type PersonHit = { first_name: string; age: number | null; distance_km: string; relationship: string; mutual_count: number };

async function searchPeople(text: string | null = null, interest: number | null = null) {
  return (await db.query<PersonHit>(`select * from public.search_people($1, $2::smallint)`, [text, interest])).rows;
}

async function searchActivities(o: Partial<{ text: string; interest: number; date: string; fromPeople: boolean }> = {}) {
  return (await db.query<{ title: string; viewer_state: string; going: number }>(
    `select * from public.search_activities($1, $2::smallint, $3::date, $4)`,
    [o.text ?? null, o.interest ?? null, o.date ?? null, o.fromPeople ?? false],
  )).rows;
}

describe("search people (ST-150, §11)", () => {
  it("filters by name or interest text and interest (AND) within the saved radius, nearest first", async () => {
    const me = await addUser("Me", HSR, [1], { radius: 10 });
    await addUser("Kabir", KORAMANGALA, [3, 5]);
    await addUser("Divya", HSR, [3, 6]);
    await addUser("Ishaan", INDIRANAGAR, [3, 4]);
    await addUser("Pokerface", HSR, [9]);
    await addUser("Far", [13.1007, 77.5963], [3]); // Yelahanka, > 10 km
    await as(me);

    expect((await searchPeople()).map((r) => r.first_name)).toEqual(["Divya", "Pokerface", "Kabir", "Ishaan"]);
    expect((await searchPeople(null, 3)).map((r) => r.first_name)).toEqual(["Divya", "Kabir", "Ishaan"]);
    // Text matches first names and interest names, case-insensitively.
    expect((await searchPeople("POKER")).map((r) => r.first_name)).toEqual(["Divya", "Pokerface", "Kabir", "Ishaan"]);
    expect((await searchPeople("poker", 4)).map((r) => r.first_name)).toEqual(["Ishaan"]);
    expect((await searchPeople("kab")).map((r) => r.first_name)).toEqual(["Kabir"]);
    expect((await searchPeople("hiking")).map((r) => r.first_name)).toEqual(["Divya"]);
    expect(await searchPeople("%")).toEqual([]); // no LIKE wildcards
    const [kabir] = await searchPeople("kabir");
    expect(kabir.distance_km).toBe("3.6");
    expect(Object.keys(kabir)).not.toContain("lat");
    expect(Object.keys(kabir)).not.toContain("birth_date");

    await db.query(`update public.users set radius_km = 5 where id = $1`, [me]);
    expect((await searchPeople()).map((r) => r.first_name)).toEqual(["Divya", "Pokerface", "Kabir"]);
  });

  it("shows connections and pending requests labelled; hides blocked, unfinished, self, and hidden non-connections (Q-55)", async () => {
    const me = await addUser("Me", HSR, [1]);
    const friend = await addUser("Friend", HSR, [1]);
    const asked = await addUser("Asked", HSR, [1]);
    const askedMe = await addUser("AskedMe", HSR, [1]);
    const blocked = await addUser("Blocked", HSR, [1]);
    const blockedMe = await addUser("BlockedMe", HSR, [1]);
    await addUser("Hidden", HSR, [1], { discoverable: false });
    const hiddenFriend = await addUser("HiddenFriend", HSR, [1], { discoverable: false });
    await addUser("Unfinished", HSR, [1], { complete: false });
    const mutualPal = await addUser("Pal", HSR, [1], { showAge: false });
    await connectUsers(me, friend);
    await connectUsers(me, hiddenFriend);
    await connectUsers(friend, mutualPal);
    await connectUsers(me, mutualPal);
    await as(me);
    await rpc("send_connection_request", asked);
    await rpc("block_user", blocked);
    await as(askedMe);
    await rpc("send_connection_request", me);
    await as(blockedMe);
    await rpc("block_user", me);

    await as(me);
    const rows = Object.fromEntries((await searchPeople()).map((r) => [r.first_name, r]));
    expect(Object.keys(rows).sort()).toEqual(["Asked", "AskedMe", "Friend", "HiddenFriend", "Pal"]);
    expect(rows.Friend.relationship).toBe("connected");
    expect(rows.HiddenFriend.relationship).toBe("connected");
    expect(rows.Asked.relationship).toBe("sent");
    expect(rows.AskedMe.relationship).toBe("received");
    expect(rows.Friend.mutual_count).toBe(1);
    expect(rows.Pal.age).toBeNull();
    expect(rows.Friend.age).toBe(28);

    // Strangers can't find a hidden person.
    await as(asked);
    expect((await searchPeople()).map((r) => r.first_name)).not.toContain("HiddenFriend");
  });
});

describe("search activities (ST-152, ST-100)", () => {
  it("filters by title, interest, radius and local day (AND); soonest first; keeps full, drops started/cancelled", async () => {
    const me = await addUser("Me", HSR, [1, 3], { radius: 10 });
    const host = await addUser("Host", HSR, [1, 3]);
    const other = await addUser("Other", HSR, [1]);
    await createActivity(host, { title: "Evening doubles", startsIn: "2 days" });
    await createActivity(host, { title: "Morning Doubles", startsIn: "1 day" });
    await createActivity(host, { title: "Poker night", interest: 3, startsIn: "3 days" });
    await createActivity(host, { title: "Far doubles", where: INDIRANAGAR, startsIn: "4 days" });
    const full = await createActivity(host, { title: "Full doubles", limit: 2, startsIn: "5 days" });
    const cancelled = await createActivity(host, { title: "Cancelled doubles" });
    const started = await createActivity(host, { title: "Started doubles" });
    await shiftActivity(started, "10 minutes");
    await as(host);
    await rpc("cancel_activity", cancelled, null);
    await joinAccepted(host, other, full);

    await as(me);
    expect((await searchActivities()).map((r) => r.title)).toEqual([
      "Morning Doubles", "Evening doubles", "Poker night", "Far doubles", "Full doubles",
    ]);
    expect((await searchActivities({ text: "DOUBLES", interest: 1 })).map((r) => r.title)).toEqual([
      "Morning Doubles", "Evening doubles", "Far doubles", "Full doubles",
    ]);
    expect((await searchActivities({ interest: 3 })).map((r) => r.title)).toEqual(["Poker night"]);
    const { rows } = await db.query<{ d: string }>(`select to_char((now() + interval '2 days') at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d`);
    expect((await searchActivities({ date: rows[0].d })).map((r) => r.title)).toEqual(["Evening doubles"]);
    expect((await searchActivities({ text: "full" }))[0].going).toBe(2);
    await db.query(`update public.users set radius_km = 5 where id = $1`, [me]);
    expect((await searchActivities()).map((r) => r.title)).not.toContain("Far doubles");
  });

  it("connections-only never leaks; nearby needs a shared interest; blocked hosts and participants hidden", async () => {
    const me = await addUser("Me", HSR, [1]);
    const friend = await addUser("Friend", HSR, [9]);
    const stranger = await addUser("Stranger", HSR, [1, 3]);
    const blocker = await addUser("Blocker", HSR, [1]);
    const guest = await addUser("Guest", HSR, [1]);
    await connectUsers(me, friend);
    await createActivity(friend, { title: "Friend only", interest: 9, visibility: "connections" });
    await createActivity(stranger, { title: "Stranger only", visibility: "connections" });
    await createActivity(stranger, { title: "Stranger poker", interest: 3 });
    await createActivity(stranger, { title: "Stranger doubles" });
    await createActivity(blocker, { title: "Blocker doubles" });
    const withGuest = await createActivity(stranger, { title: "Guest doubles" });
    await joinAccepted(stranger, guest, withGuest);
    await createActivity(me, { title: "My doubles" });
    await as(blocker);
    await rpc("block_user", me);
    await as(me);
    await rpc("block_user", guest);

    const rows = await searchActivities();
    expect(rows.map((r) => r.title).sort()).toEqual(["Friend only", "My doubles", "Stranger doubles"]);
    expect(rows.find((r) => r.title === "My doubles")!.viewer_state).toBe("host");
    expect((await searchActivities({ text: "only" })).map((r) => r.title)).toEqual(["Friend only"]);
    // Q-18: S10 "See all" → only activities hosted by connections.
    expect((await searchActivities({ fromPeople: true })).map((r) => r.title)).toEqual(["Friend only"]);
  });

  it("returns the viewer's join state", async () => {
    const me = await addUser("Me", HSR, [1]);
    const host = await addUser("Host", HSR, [1]);
    const id = await createActivity(host);
    await as(me);
    await rpc("request_to_join", id);
    expect((await searchActivities()).map((r) => r.viewer_state)).toEqual(["requested"]);
  });
});

type InboxItem = {
  type: string; needs_reply: boolean;
  actor: { first_name: string; connected: boolean; shared_count: number; distance_km: number } | null;
  activity: { title: string; host_first_name: string; cancel_note: string | null } | null;
};
async function inbox() {
  return (await rpc<{ unread: number; items: InboxItem[] }>("inbox_notifications"))!;
}

describe("inbox notifications (ST-160–ST-162, §12)", () => {
  it("Needs your reply = open connection + join requests; answered ones leave; every §12 type lands in Earlier", async () => {
    const me = await addUser("Me", HSR, [1, 2]);
    const asker = await addUser("Asker", KORAMANGALA, [1, 2, 3]);
    const joiner = await addUser("Joiner", HSR, [1]);
    const friend = await addUser("Friend", HSR, [1]);
    await connectUsers(me, friend);

    await as(asker);
    await rpc("send_connection_request", me);
    const mine = await createActivity(me, { title: "Doubles" });
    await as(joiner);
    await rpc("request_to_join", mine);

    await as(me);
    let box = await inbox();
    expect(box.items.map((i) => [i.type, i.needs_reply])).toEqual([["join_requested", true], ["connection_request", true]]);
    expect(box.items[1].actor).toEqual(expect.objectContaining({ first_name: "Asker", shared_count: 2, connected: false }));
    expect(box.items[1].actor!.distance_km).toBeCloseTo(3.6, 0);
    expect(box.items[0].activity).toEqual(expect.objectContaining({ title: "Doubles", host_first_name: "Me" }));
    expect(box.unread).toBe(2);

    await rpc("respond_connection_request", asker, true);
    await rpc("accept_join_request", (await manage(mine))!.requests[0].id);
    box = await inbox();
    expect(box.items).toEqual([]); // answered requests aren't repeated in Earlier

    // Me as requester / participant / connection gets the rest of §12.
    const theirs = await createActivity(friend, { title: "Friend game" });
    await as(me);
    await rpc("request_to_join", theirs);
    await as(friend);
    await rpc("accept_join_request", (await manage(theirs))!.requests[0].id);
    await rpc("cancel_activity", theirs, "Rain");
    await as(me);
    await rpc("send_connection_request", joiner);
    await as(joiner);
    await rpc("respond_connection_request", me, true);
    await as(joiner);
    await rpc("withdraw_from_activity", mine);

    await as(me);
    box = await inbox();
    expect(new Set(box.items.map((i) => i.type))).toEqual(
      new Set(["activity_created", "join_accepted", "activity_cancelled", "connection_accepted", "participant_withdrew"]),
    );
    expect(box.items.every((i) => !i.needs_reply)).toBe(true);
    expect(box.items.find((i) => i.type === "activity_cancelled")!.activity!.cancel_note).toBe("Rain");

    expect(box.unread).toBeGreaterThan(0);
    await rpc("mark_notifications_read");
    expect((await inbox()).unread).toBe(0);
  });

  it("hides blocked people's notifications and declines still inside their Undo window", async () => {
    const me = await addUser("Me", HSR, [1]);
    const other = await addUser("Other", HSR, [1]);
    await db.query(`update public.users set notify_request_declined = true where id = $1`, [me]);
    await as(me);
    await rpc("send_connection_request", other);
    await as(other);
    await rpc("respond_connection_request", me, false);
    await as(me);
    expect((await inbox()).items).toEqual([]); // queued for 10 s
    await db.query(`update public.notifications set created_at = now() - interval '1 second' where type = 'connection_declined'`);
    expect((await inbox()).items.map((i) => i.type)).toEqual(["connection_declined"]);
    await rpc("block_user", other);
    expect((await inbox()).items).toEqual([]);
  });

  it("connection decline Undo: back to pending within 10 s, requester never told; too late after", async () => {
    const a = await addUser("A", HSR, [1]);
    const b = await addUser("B", HSR, [1]);
    await db.query(`update public.users set notify_request_declined = true where id = $1`, [a]);
    await as(a);
    await rpc("send_connection_request", b);
    await as(b);
    await rpc("respond_connection_request", a, false);
    expect(await rpc("undo_connection_decline", a)).toBe("received");
    expect((await inbox()).items.map((i) => [i.type, i.needs_reply])).toEqual([["connection_request", true]]);
    const { rows } = await db.query(`select type from public.notifications where user_id = $1`, [a]);
    expect(rows).toEqual([]);

    await rpc("respond_connection_request", a, false);
    await db.query(`update public.connection_requests set responded_at = now() - interval '11 seconds'`);
    await expect(rpc("undo_connection_decline", a)).rejects.toThrow(/too_late/);
  });
});

type ChatRow = { type: string; title: string | null; other_first_name: string | null; last_body: string | null; last_sender_first_name: string | null; unread: number };

describe("inbox chats (ST-141.1, ST-146, ST-163)", () => {
  it("one row per group + direct chat, latest message first, unread from others since my last read; blocked senders hidden", async () => {
    const me = await addUser("Me", HSR, [1]);
    const host = await addUser("Host", HSR, [1]);
    const pal = await addUser("Pal", HSR, [1]);
    const id = await createActivity(host, { title: "Doubles" });
    await joinAccepted(host, me, id);
    await joinAccepted(host, pal, id);
    await connectUsers(me, pal);
    await as(me);
    const direct = await rpc<string>("direct_conversation", pal);
    const group = await rpc<string>("activity_conversation", id);
    // PGlite's clock can repeat within a millisecond: put joins and the first message clearly in the past.
    await db.query(`update public.conversation_members set last_read_at = now() - interval '1 minute'`);

    await as(host);
    await rpc("send_message", group, "Court 3");
    await db.query(`update public.messages set created_at = now() - interval '30 seconds'`);
    await as(pal);
    await rpc("send_message", direct, "Hi!");
    await db.query(`update public.messages set created_at = now() - interval '20 seconds' where body = 'Hi!'`);
    await as(me);
    let rows = (await db.query<ChatRow>(`select * from public.inbox_conversations()`)).rows;
    expect(rows.map((r) => [r.type, r.title ?? r.other_first_name, r.last_body, r.unread])).toEqual([
      ["direct", "Pal", "Hi!", 1],
      ["activity", "Doubles", "Court 3", 1],
    ]);
    expect(await rpc("unread_chat_count")).toBe(2);

    await rpc("mark_read", direct);
    await rpc("send_message", group, "See you");
    rows = (await db.query<ChatRow>(`select * from public.inbox_conversations()`)).rows;
    // Sending marks the chat read for the sender.
    expect(rows.map((r) => [r.title ?? r.other_first_name, r.last_sender_first_name, r.unread])).toEqual([
      ["Doubles", "Me", 0],
      ["Pal", "Pal", 0],
    ]);

    await as(host);
    await rpc("send_message", group, "Bring water");
    // PGlite's clock can repeat within a millisecond; make my last read clearly earlier.
    await db.query(
      `update public.conversation_members set last_read_at = now() - interval '1 second' where user_id = $1 and conversation_id = $2`,
      [me, group],
    );
    await as(me);
    // Total unread messages (Q-58): only "Bring water" is after my last read.
    expect(await rpc("unread_chat_count")).toBe(1);
    await rpc("block_user", host);
    rows = (await db.query<ChatRow>(`select * from public.inbox_conversations()`)).rows;
    expect(rows.find((r) => r.title === "Doubles")!.unread).toBe(0);
    expect(await rpc("unread_chat_count")).toBe(0);
  });
});

type ProfileActivity = { title: string; tab: string; my_status: string; phase: string; going: number };
type MyProfile = {
  connections_count: number; created_count: number; joined_count: number; pending_count: number;
  connections_preview: { first_name: string }[]; activities: ProfileActivity[];
};

describe("my profile + connections (ST-170–ST-173, ST-085)", () => {
  it("stats, connection preview and the Created / Joined / Past tabs", async () => {
    const me = await addUser("Me", HSR, [1]);
    const host = await addUser("Host", HSR, [1]);
    const asker = await addUser("Asker", HSR, [1]);
    for (const name of ["Zed", "Amy", "Bob", "Cat"]) await connectUsers(me, await addUser(name, HSR, [1]));
    await as(asker);
    await rpc("send_connection_request", me);

    const hosting = await createActivity(me, { title: "Hosting", startsIn: "3 days" });
    const hostedPast = await createActivity(me, { title: "Hosted past" });
    await shiftActivity(hostedPast, "2 days");
    const going = await createActivity(host, { title: "Going", startsIn: "1 day" });
    await joinAccepted(host, me, going);
    const requested = await createActivity(host, { title: "Requested", startsIn: "4 days" });
    await as(me);
    await rpc("request_to_join", requested);
    const done = await createActivity(host, { title: "Done" });
    await joinAccepted(host, me, done);
    await shiftActivity(done, "1 day");
    const cancelled = await createActivity(host, { title: "Cancelled" });
    await joinAccepted(host, me, cancelled);
    await as(host);
    await rpc("cancel_activity", cancelled, null);
    const declined = await createActivity(host, { title: "Declined" });
    await as(me);
    await rpc("request_to_join", declined);
    await as(host);
    await rpc("decline_join_request", (await manage(declined))!.requests[0].id);
    await db.query(`update public.participations set decline_at = now() - interval '1 second' where decline_at is not null`);

    await as(me);
    const p = (await rpc<MyProfile>("my_profile"))!;
    expect([p.connections_count, p.created_count, p.joined_count, p.pending_count]).toEqual([4, 2, 2, 1]);
    expect(p.connections_preview.map((c) => c.first_name)).toEqual(["Amy", "Bob", "Cat"]);
    // Upcoming tabs soonest first; Past latest first.
    expect(p.activities.map((a) => [a.tab, a.title, a.my_status])).toEqual([
      ["created", "Hosting", "host"],
      ["joined", "Going", "accepted"],
      ["joined", "Requested", "requested"],
      ["past", "Cancelled", "closed"],
      ["past", "Done", "accepted"],
      ["past", "Hosted past", "host"],
    ]);

    // Q-59: cancelled activities leave the stats (but stay under Past).
    await rpc("cancel_activity", hosting, null);
    const after = (await rpc<MyProfile>("my_profile"))!;
    expect([after.created_count, after.joined_count]).toEqual([1, 2]);
    expect(after.activities.filter((a) => a.tab === "past").map((a) => a.title)).toContain("Hosting");
  });

  it("connections list: pending requests to me + connections by name; blocked people never appear", async () => {
    const me = await addUser("Me", HSR, [1, 2]);
    const asker = await addUser("Asker", HSR, [1, 2]);
    const blockedAsker = await addUser("BlockedAsker", HSR, [1]);
    const zed = await addUser("Zed", HSR, [1]);
    const amy = await addUser("Amy", HSR, [1]);
    await connectUsers(me, zed);
    await connectUsers(me, amy);
    for (const u of [asker, blockedAsker]) {
      await as(u);
      await rpc("send_connection_request", me);
    }
    await as(me);
    await rpc("block_user", blockedAsker);
    const c = (await rpc<{ pending: { first_name: string; shared_count: number }[]; connections: { first_name: string }[] }>("my_connections"))!;
    expect(c.pending.map((x) => [x.first_name, x.shared_count])).toEqual([["Asker", 2]]);
    expect(c.connections.map((x) => x.first_name)).toEqual(["Amy", "Zed"]);

    await rpc("remove_connection", zed);
    expect((await rpc<{ connections: unknown[] }>("my_connections"))!.connections).toHaveLength(1);
    expect(JSON.stringify(c)).not.toContain("\"lat\"");
  });
});

describe("settings + unblock (ST-180–ST-183, ST-191, ST-194)", () => {
  async function asAuthenticated<T>(id: string, fn: () => Promise<T>) {
    await as(id);
    await db.exec(`set role authenticated`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role`);
    }
  }

  it("users can change their own settings (and only theirs); invalid values are rejected", async () => {
    const me = await addUser("Me", HSR, [1]);
    const other = await addUser("Other", HSR, [1]);
    await asAuthenticated(me, async () => {
      await db.query(
        `update public.users set radius_km = 10, discoverable = false, show_age = false, history_visibility = 'only_me',
           notify_connection_requests = false, notify_new_activities = false, notify_join_decisions = false,
           notify_request_declined = true where id = $1`,
        [me],
      );
      await db.query(`update public.users set discoverable = false where id = $1`, [other]); // RLS: no-op
      await expect(db.query(`update public.users set radius_km = 7 where id = $1`, [me])).rejects.toThrow(/check/);
      await expect(db.query(`update public.users set history_visibility = 'all' where id = $1`, [me])).rejects.toThrow(/check/);
    });
    const { rows } = await db.query<Record<string, unknown>>(
      `select radius_km, discoverable, show_age, history_visibility, notify_connection_requests, notify_new_activities,
         notify_join_decisions, notify_request_declined from public.users where id in ($1, $2) order by first_name`,
      [me, other],
    );
    expect(rows[0]).toEqual({
      radius_km: 10, discoverable: false, show_age: false, history_visibility: "only_me", notify_connection_requests: false,
      notify_new_activities: false, notify_join_decisions: false, notify_request_declined: true,
    });
    expect(rows[1].discoverable).toBe(true);
  });

  it("blocked people list + Unblock: they come back in Discover, the connection does not; their block on me stays", async () => {
    const me = await addUser("Me", HSR, [1]);
    const friend = await addUser("Friend", HSR, [1]);
    const mutual = await addUser("Mutual", HSR, [1]);
    await connectUsers(me, friend);
    await as(me);
    await rpc("block_user", friend);
    await rpc("block_user", mutual);
    await as(mutual);
    await rpc("block_user", me);

    await as(me);
    const list = (await db.query<{ first_name: string }>(`select * from public.blocked_people()`)).rows;
    expect(list.map((r) => r.first_name).sort()).toEqual(["Friend", "Mutual"]);
    expect(Object.keys(list[0])).not.toContain("lat");

    await rpc("unblock_user", friend);
    await rpc("unblock_user", mutual);
    expect((await db.query(`select * from public.blocked_people()`)).rows).toEqual([]);
    expect(await rpc("are_connected", me, friend)).toBe(false);
    expect((await candidates()).map((r) => r.first_name)).toEqual(["Friend"]); // Mutual still blocks me
  });

  it("report review view: readable from the SQL editor, never by app users", async () => {
    const me = await addUser("Me", HSR, [1]);
    const bad = await addUser("Bad", HSR, [1]);
    await as(me);
    await rpc("report_user", bad, "spam", "sells stuff");
    const { rows } = await db.query<{ reporter_name: string; reported_name: string; reports_on_user: number }>(
      `select * from public.reports_review`,
    );
    expect(rows).toEqual([expect.objectContaining({ reporter_name: "Me", reported_name: "Bad", reports_on_user: 1 })]);
    await expect(asAuthenticated(me, () => db.query(`select * from public.reports_review`))).rejects.toThrow(/permission/);
  });
});

describe("dev seed", () => {
  it("creates 8 finished demo people and links real users to Rohan, Sneha and Kabir", async () => {
    const real = await addUser("Real", HSR, [1, 6, 8]);
    await db.exec(sql("seed/dev_seed.sql"));
    await db.exec(sql("seed/dev_seed.sql")); // re-runnable
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.users where onboarding_completed_at is not null and id <> $1`,
      [real],
    );
    expect(rows[0].n).toBe(8);
    await as(real);
    const names = (await candidates()).map((r) => r.first_name);
    expect(names).toEqual(expect.arrayContaining(["Meera", "Ananya", "Aarav", "Priya"]));
    expect(names).not.toContain("Rohan"); // connected
    expect(names).not.toContain("Kabir"); // pending request to me
    expect(names).not.toContain("Vikram"); // outside 5 km
    const meera = (await candidates()).find((r) => r.first_name === "Meera")!;
    expect((await profile(meera.id))!.mutual).toHaveLength(2);
  });

  it("demo activities fill both S10 sections and give real users one hosted activity with requests", async () => {
    const real = await addUser("Real", HSR, [1, 6, 8]);
    await db.exec(sql("seed/dev_seed.sql"));
    await db.exec(sql("seed/dev_activities.sql"));
    await db.exec(sql("seed/dev_activities.sql")); // re-runnable
    await as(real);
    const rows = await feed();
    expect(new Set(rows.map((r) => r.section))).toEqual(new Set(["people", "nearby"]));
    const mine = (await db.query<{ id: string }>(`select id from public.activities where host_id = $1`, [real])).rows;
    expect(mine).toHaveLength(1);
    expect((await manage(mine[0].id))!.requests.length).toBeGreaterThan(0);
  });

  it("demo chats: a finished activity for S17 and messages in group + direct chats", async () => {
    const real = await addUser("Real", HSR, [1, 6, 8]);
    await db.exec(sql("seed/dev_seed.sql"));
    await db.exec(sql("seed/dev_activities.sql"));
    await db.exec(sql("seed/dev_chat.sql"));
    await db.exec(sql("seed/dev_chat.sql")); // re-runnable
    await as(real);
    const past = (await db.query<{ id: string }>(`select id from public.activities where title = 'Friday board games'`)).rows;
    expect(past).toHaveLength(1);
    const after = (await rpc<{ phase: string; participants: unknown[] }>("after_activity", past[0].id))!;
    expect(after.phase).toBe("completed");
    expect(after.participants).toHaveLength(4);
    const group = await rpc<string>("activity_conversation", past[0].id);
    expect((await rpc<Thread>("chat_thread", group))!.messages).toHaveLength(3);
    const rohan = "00000000-0000-4000-8000-000000000005";
    const direct = await rpc<string>("direct_conversation", rohan);
    expect((await rpc<Thread>("chat_thread", direct))!.messages.map((m) => m.body)).toEqual(["Hey! Up for a swim this week?"]);
  });
});

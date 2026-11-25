// Minimal stand-in for the Supabase endpoints the onboarding flow uses (auth user, PostgREST, storage).
// Test-only; one signed-in user "u1". State is reset via POST /__state.
import { createServer } from "node:http";
import { freshPeopleState, handleRpc, peopleSnapshot } from "./mock-people.mjs";
import { activitySnapshot, freshActivityState, handleActivityRpc, memberReads } from "./mock-activities.mjs";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54399);

const SLUGS = ["badminton", "swimming", "poker", "boardgames", "gaming", "hike", "cycling", "coffee", "shopping", "concert", "music", "movies", "roadtrip", "food"];
const INTERESTS = [
  "Badminton", "Swimming", "Poker", "Board games", "PS5 / Gaming", "Hiking", "Cycling",
  "Cafe exploration", "Shopping", "Concerts", "Music", "Movies", "Road trips", "Food exploration",
].map((name, i) => ({ id: i + 1, slug: SLUGS[i], name, sort_order: i + 1 }));

const USER = {
  id: "u1",
  aud: "authenticated",
  role: "authenticated",
  email: "aarav@example.com",
  app_metadata: { provider: "google" },
  user_metadata: { given_name: "Aarav" },
  created_at: "2026-11-23T00:00:00Z",
};

const blankRow = () => ({
  id: "u1",
  first_name: null,
  birth_date: null,
  show_age: true,
  bio: null,
  photo_path: null,
  area_name: null,
  city: null,
  lat: null,
  lng: null,
  radius_km: 5,
  discoverable: true,
  history_visibility: "connections",
  notify_connection_requests: true,
  notify_new_activities: true,
  notify_join_decisions: true,
  notify_request_declined: false,
  onboarding_completed_at: null,
});

let state = { row: blankRow(), interestIds: [], files: new Map(), people: freshPeopleState(false), activities: freshActivityState(false) };

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, {
    "content-type": isBuf ? "application/octet-stream" : "application/json",
    ...headers,
  });
  res.end(isBuf ? body : body === undefined ? "" : JSON.stringify(body));
}

function rows(req, list) {
  // supabase-js asks for a single object via this Accept header (maybeSingle/single).
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  return wantsObject ? list[0] ?? null : list;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const body = await readBody(req);

  if (path === "/__state" && req.method === "POST") {
    const next = JSON.parse(body.toString() || "{}");
    state = {
      row: { ...blankRow(), ...(next.row ?? {}) },
      interestIds: next.interestIds ?? [],
      files: new Map(),
      people: freshPeopleState(next.people),
      activities: freshActivityState(next.people),
    };
    return send(res, 204);
  }
  if (path === "/__state") {
    return send(res, 200, {
      row: state.row,
      interestIds: state.interestIds,
      files: [...state.files.keys()],
      people: peopleSnapshot(state.people),
      activities: activitySnapshot(state.activities),
    });
  }

  if (path === "/auth/v1/user") return send(res, 200, USER);
  if (path === "/auth/v1/logout") return send(res, 204);

  if (path === "/rest/v1/rpc/delete_underage_self") {
    state = { row: { ...blankRow(), deleted: true }, interestIds: [], files: new Map(), people: freshPeopleState(false), activities: freshActivityState(false) };
    return send(res, 204);
  }

  const rpc = path.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (rpc) {
    const args = body.length ? JSON.parse(body.toString()) : {};
    const act = handleActivityRpc(rpc[1], args, state.activities, state.people, state.row, state.interestIds);
    if (act) return send(res, act[0], act[1]);
    const result = handleRpc(rpc[1], args, state.people, state.interestIds, state.row.radius_km);
    if (result) return send(res, result[0], result[1]);
  }

  if (path === "/rest/v1/notifications") {
    return send(res, 200, [], { "content-range": `*/${state.people.unread}` });
  }

  if (path === "/rest/v1/conversation_members") {
    const cid = (url.searchParams.get("conversation_id") ?? "").replace(/^eq\./, "");
    return send(res, 200, memberReads(state.activities, state.people, cid));
  }

  if (path === "/rest/v1/interests") return send(res, 200, rows(req, INTERESTS));

  if (path === "/rest/v1/users") {
    if (req.method === "PATCH") {
      Object.assign(state.row, JSON.parse(body.toString()));
      return send(res, 204);
    }
    return send(res, 200, rows(req, [{ ...state.row, discover_round: state.people.round }]));
  }

  if (path === "/rest/v1/user_interests") {
    if (req.method === "DELETE") {
      state.interestIds = [];
      return send(res, 204);
    }
    if (req.method === "POST") {
      const items = [].concat(JSON.parse(body.toString()));
      state.interestIds.push(...items.map((i) => i.interest_id));
      return send(res, 201);
    }
    return send(res, 200, rows(req, state.interestIds.map((interest_id) => ({ interest_id }))));
  }

  const pub = path.match(/^\/storage\/v1\/object\/public\/avatars\/(.+)$/);
  if (pub) {
    const file = state.files.get(pub[1]);
    return file ? send(res, 200, file, { "content-type": "image/webp" }) : send(res, 404, {});
  }
  const obj = path.match(/^\/storage\/v1\/object\/avatars\/(.+)$/);
  if (obj && req.method === "POST") {
    state.files.set(obj[1], body);
    return send(res, 200, { Key: `avatars/${obj[1]}` });
  }
  if (path === "/storage/v1/object/avatars" && req.method === "DELETE") {
    for (const p of JSON.parse(body.toString()).prefixes ?? []) state.files.delete(p);
    return send(res, 200, []);
  }

  send(res, 404, { message: `mock: no route for ${req.method} ${path}` });
}).listen(PORT, () => console.log(`mock supabase on ${PORT}`));

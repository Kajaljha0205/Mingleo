// Test-only stand-in for the S08/S09 RPCs in 0004_discover.sql. The real SQL rules are covered
// by src/server/sql.test.ts; this only needs believable behaviour for browser tests.

const P = (id, first_name, age, area_name, distance_km, interest_ids, extra = {}) => ({
  id, first_name, age, area_name, distance_km, interest_ids,
  photo_path: `/images/people/${first_name.toLowerCase()}.svg`,
  bio: `${first_name} likes meeting new people.`,
  ...extra,
});

export const DEMO = [
  P("p-ananya", "Ananya", 28, "BTM Layout", 2.5, [8, 6, 14], { bio: "Always up for good food, great conversations and new adventures." }),
  P("p-meera", "Meera", 27, "Koramangala", 3.6, [1, 4, 6, 10, 8], {
    bio: "Product manager, weekend shuttler. Always up for a board-game café or an early hike.",
  }),
  P("p-aarav", "Aarav", null, "HSR Layout", 0.4, [1, 7]),
  P("p-kabir", "Kabir", 30, "Bellandur", 3.4, [5, 3, 12, 11]),
  P("p-rohan", "Rohan", 29, "BTM Layout", 3.7, [1, 2, 7]),
  P("p-sneha", "Sneha", 31, "Sarjapur Road", 4.1, [6, 13, 9]),
];

export const freshPeopleState = (withPeople) => ({
  enabled: Boolean(withPeople),
  round: 1,
  skips: new Set(), // `${round}:${id}`
  sent: new Set(),
  received: new Set(withPeople ? ["p-kabir"] : []),
  connected: new Set(withPeople ? ["p-rohan", "p-sneha"] : []),
  blocked: new Set(),
  declinedAt: new Map(), // id → ms, for the 10 s Undo
  reports: [],
  unread: withPeople ? 3 : 0,
});

const MUTUALS = { "p-meera": ["p-rohan", "p-sneha"], "p-ananya": ["p-rohan"] };
const INTEREST_NAMES = [
  "Badminton", "Swimming", "Poker", "Board games", "PS5 / Gaming", "Hiking", "Cycling",
  "Cafe exploration", "Shopping", "Concerts", "Music", "Movies", "Road trips", "Food exploration",
];

function mutual(s, id) {
  return (MUTUALS[id] ?? [])
    .filter((m) => s.connected.has(m))
    .map((m) => DEMO.find((d) => d.id === m))
    .map((d) => ({ id: d.id, first_name: d.first_name, photo_path: d.photo_path }));
}

function relationship(s, id) {
  if (s.connected.has(id)) return "connected";
  if (s.sent.has(id)) return "sent";
  if (s.received.has(id)) return "received";
  return "none";
}

/** Returns [status, body] or null when the path isn't an RPC we handle. */
export function handleRpc(fn, args, s, viewerInterestIds, viewerRadiusKm = 5) {
  if (!s.enabled && ["discover_candidates", "search_people", "blocked_people"].includes(fn)) return [200, []];
  if (!s.enabled) return [200, null];
  switch (fn) {
    case "blocked_people":
      return [200, [...s.blocked].map((id) => DEMO.find((d) => d.id === id)).map((d) => ({
        id: d.id, first_name: d.first_name, photo_path: d.photo_path, blocked_at: new Date().toISOString(),
      }))];
    case "unblock_user":
      s.blocked.delete(args.p_id);
      return [204, undefined];
    case "search_people": {
      const q = (args.p_text ?? "").toLowerCase();
      const r = viewerRadiusKm;
      const rows = DEMO.filter(
        (d) =>
          !s.blocked.has(d.id) &&
          d.distance_km <= r &&
          (args.p_interest_id == null || d.interest_ids.includes(args.p_interest_id)) &&
          (!q || d.first_name.toLowerCase().includes(q) || d.interest_ids.some((i) => INTEREST_NAMES[i - 1].toLowerCase().includes(q))),
      )
        .sort((a, b) => a.distance_km - b.distance_km)
        .map((d) => ({
          id: d.id, first_name: d.first_name, age: d.age, photo_path: d.photo_path, area_name: d.area_name,
          distance_km: d.distance_km, interest_ids: d.interest_ids, mutual_count: mutual(s, d.id).length,
          relationship: relationship(s, d.id),
        }));
      return [200, rows];
    }
    case "discover_candidates": {
      const rows = DEMO.filter(
        (d) =>
          relationship(s, d.id) === "none" &&
          d.distance_km <= viewerRadiusKm &&
          !s.blocked.has(d.id) &&
          !s.skips.has(`${s.round}:${d.id}`) &&
          (args.p_interest_id == null || d.interest_ids.includes(args.p_interest_id)),
      ).map((d) => ({
        ...d,
        shared_count: d.interest_ids.filter((i) => viewerInterestIds.includes(i)).length,
        mutual: mutual(s, d.id),
        hosted_count: 0,
        score: 0,
      }));
      return [200, rows];
    }
    case "person_profile": {
      const d = DEMO.find((x) => x.id === args.p_id);
      if (!d || s.blocked.has(d.id)) return [200, null];
      return [
        200,
        {
          ...d,
          viewer_interest_ids: viewerInterestIds,
          mutual: mutual(s, d.id),
          hosted_count: 0,
          history_visible: false,
          recent_activities: [],
          relationship: relationship(s, d.id),
        },
      ];
    }
    case "send_connection_request":
      if (s.received.delete(args.p_to)) {
        s.connected.add(args.p_to);
        return [200, "connected"];
      }
      s.sent.add(args.p_to);
      return [200, "sent"];
    case "withdraw_connection_request":
      s.sent.delete(args.p_to);
      return [200, "none"];
    case "respond_connection_request":
      s.received.delete(args.p_from);
      if (args.p_accept) s.connected.add(args.p_from);
      else s.declinedAt.set(args.p_from, Date.now());
      return [200, args.p_accept ? "connected" : "none"];
    case "undo_connection_decline": {
      const at = s.declinedAt.get(args.p_from);
      if (!at || Date.now() - at > 10_000) return [400, { code: "P0001", message: "too_late", details: null, hint: null }];
      s.declinedAt.delete(args.p_from);
      s.received.add(args.p_from);
      return [200, "received"];
    }
    case "remove_connection":
      s.connected.delete(args.p_other);
      return [200, "none"];
    case "skip_profile":
      s.skips.add(`${s.round}:${args.p_id}`);
      return [204, undefined];
    case "start_over_discover":
      s.round += 1;
      return [204, undefined];
    case "block_user":
      s.blocked.add(args.p_id);
      for (const set of [s.sent, s.received, s.connected]) set.delete(args.p_id);
      return [204, undefined];
    case "report_user":
      s.reports.push(args);
      return [204, undefined];
    default:
      return null;
  }
}

export function peopleSnapshot(s) {
  return {
    sent: [...s.sent],
    received: [...s.received],
    connected: [...s.connected],
    blocked: [...s.blocked],
    reports: s.reports,
    round: s.round,
  };
}

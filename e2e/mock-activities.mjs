// Test-only stand-in for the S10–S15 RPCs in 0005_activities.sql. The real rules are covered by
// src/server/sql.test.ts; this only needs believable behaviour for browser tests. Viewer is "u1".
import { DEMO } from "./mock-people.mjs";

const DAY = 86_400_000;
// Local (IST) day n days from today at hh:mm, as an ISO string.
function at(days, hh, mm = 0) {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const base = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) + days * DAY;
  return new Date(base + (hh * 60 + mm) * 60_000 - 5.5 * 3600_000).toISOString();
}

const A = (id, host, interest_id, title, o) => ({
  id, host, interest_id, title, description: null, city: "Bengaluru", address: null, ends_at: null,
  visibility: "connections_and_nearby", status: "open", cancel_note: null, ...o,
});

function demoActivities() {
  return [
    A("a-swim", "p-rohan", 2, "Early swim at the club", {
      area_name: "BTM Layout", distance_km: 3.7, starts_at: at(2, 6, 30), ends_at: at(2, 8), limit: 4, visibility: "connections",
    }),
    A("a-hike", "p-sneha", 6, "Nandi Hills sunrise hike", {
      area_name: "Sarjapur Road", distance_km: 4.1, starts_at: at(6, 4, 30), limit: 5,
    }),
    A("a-doubles", "p-meera", 1, "Saturday morning doubles", {
      description: "Friendly intermediate doubles. I've booked the court and we split it four ways.",
      address: "Court 3, Koramangala Indoor Stadium",
      area_name: "Koramangala", distance_km: 3.6, starts_at: at(5, 7), ends_at: at(5, 9), limit: 4,
    }),
    A("a-coffee", "p-ananya", 8, "Coffee exploration", {
      area_name: "BTM Layout", distance_km: 2.5, starts_at: at(5, 10), limit: 5,
    }),
    A("a-trek", "p-kabir", 6, "Sunrise trek", { area_name: "Bellandur", distance_km: 3.4, starts_at: at(4, 5), limit: 2 }),
    A("a-poker-far", "p-kabir", 3, "Poker (not my interest)", { area_name: "Bellandur", distance_km: 3.4, starts_at: at(4, 20), limit: 4 }),
    A("a-mine", "u1", 3, "Poker Night", {
      description: "Friendly low-stakes Texas Hold'em.", address: "Flat 4B, 27th Main",
      area_name: "HSR Layout", distance_km: 0, starts_at: at(5, 19), limit: 5,
    }),
    A("a-past", "p-meera", 4, "Friday board games", {
      description: "Catan and Codenames.", address: "Meera's place, 5th Cross",
      area_name: "Koramangala", distance_km: 3.6, starts_at: at(-2, 19), ends_at: at(-2, 22), limit: 6,
    }),
  ];
}

const P = (activityId, userId, role, status) => ({ id: `pid-${activityId}-${userId}`, activityId, userId, role, status, declineAt: null });

function demoParticipations() {
  return [
    P("a-swim", "p-rohan", "host", "accepted"), P("a-swim", "p-ananya", "participant", "accepted"),
    P("a-hike", "p-sneha", "host", "accepted"), P("a-hike", "p-meera", "participant", "accepted"),
    P("a-hike", "u1", "participant", "accepted"),
    P("a-doubles", "p-meera", "host", "accepted"), P("a-doubles", "p-rohan", "participant", "accepted"),
    P("a-doubles", "p-sneha", "participant", "accepted"),
    P("a-coffee", "p-ananya", "host", "accepted"),
    P("a-trek", "p-kabir", "host", "accepted"), P("a-trek", "p-sneha", "participant", "accepted"),
    P("a-poker-far", "p-kabir", "host", "accepted"),
    P("a-mine", "u1", "host", "accepted"), P("a-mine", "p-rohan", "participant", "accepted"),
    P("a-mine", "p-kabir", "participant", "requested"), P("a-mine", "p-meera", "participant", "requested"),
    P("a-past", "p-meera", "host", "accepted"), P("a-past", "u1", "participant", "accepted"),
    P("a-past", "p-sneha", "participant", "accepted"), P("a-past", "p-kabir", "participant", "accepted"),
    P("a-past", "p-ananya", "participant", "accepted"),
  ];
}

const MSG = (id, sender_id, body, minsAgo) => ({ id, sender_id, body, created_at: new Date(Date.now() - minsAgo * 60_000).toISOString() });

function demoMessages() {
  return {
    "c-a-hike": [
      MSG("m1", "p-sneha", "Pickup at Agara lake at 4:15.", 60),
      MSG("m2", "p-meera", "I'll bring snacks.", 50),
      MSG("m3", "u1", "See you there!", 40),
    ],
    "c-a-past": [MSG("m4", "p-meera", "Thanks for coming, everyone!", 2000)],
    "d-p-rohan": [MSG("m5", "p-rohan", "Hey! Up for a swim this week?", 30)],
  };
}

export const freshActivityState = (enabled) => ({
  enabled: Boolean(enabled),
  list: enabled ? demoActivities() : [],
  parts: enabled ? demoParticipations() : [],
  messages: enabled ? demoMessages() : {},
  // S20 "Earlier" (minutes ago); needs-reply items come from live requests.
  earlier: enabled
    ? [
        { id: "n-acc", type: "connection_accepted", actor: "p-sneha", activity: null, mins: 26 * 60 },
        { id: "n-in", type: "join_accepted", actor: "p-sneha", activity: "a-hike", mins: 27 * 60 },
        { id: "n-new", type: "activity_created", actor: "p-rohan", activity: "a-swim", mins: 3 * 24 * 60 },
      ]
    : [],
  reads: {}, // conversation id → ms; default 35 minutes ago
  reports: [],
  seq: 1,
});

const err = (message) => [400, { code: "P0001", message, details: null, hint: null }];
const effective = (p) => (p.status === "requested" && p.declineAt && p.declineAt <= Date.now() ? "declined" : p.status);
const endOf = (a) => (a.ends_at ? Date.parse(a.ends_at) : Date.parse(a.starts_at) + 3 * 3600_000);
const phase = (a) =>
  a.status === "cancelled" ? "cancelled" : Date.now() >= endOf(a) ? "completed" : Date.parse(a.starts_at) <= Date.now() ? "started" : "open";
const goingOf = (s, id) => s.parts.filter((p) => p.activityId === id && p.status === "accepted").length;

function who(id, viewerRow) {
  if (id === "u1") return { id, first_name: viewerRow.first_name, photo_path: viewerRow.photo_path, age: 28 };
  const d = DEMO.find((x) => x.id === id);
  return { id, first_name: d.first_name, photo_path: d.photo_path, age: d.age, interest_ids: d.interest_ids, distance_km: d.distance_km };
}

function visible(s, people, a, viewerInterestIds, radius) {
  if (a.host === "u1") return true;
  if (people.blocked.has(a.host)) return false;
  if (s.parts.some((p) => p.activityId === a.id && p.userId === "u1")) return true;
  if (a.status === "cancelled") return false;
  if (people.connected.has(a.host)) return true;
  return a.visibility === "connections_and_nearby" && viewerInterestIds.includes(a.interest_id) && a.distance_km <= radius;
}

/** Returns [status, body] or null when the RPC isn't an activities one. */
export function handleActivityRpc(fn, args, s, people, viewerRow, viewerInterestIds) {
  const radius = viewerRow.radius_km ?? 5;
  const find = (id) => s.list.find((a) => a.id === id);
  const mine = (id) => s.parts.find((p) => p.activityId === id && p.userId === "u1");

  switch (fn) {
    case "activities_feed": {
      const rows = s.list
        .filter((a) => a.host !== "u1" && a.status === "open" && phase(a) === "open" && !people.blocked.has(a.host))
        .filter((a) => a.distance_km <= radius)
        .filter((a) => viewerInterestIds.includes(a.interest_id))
        .filter((a) => people.connected.has(a.host) || a.visibility === "connections_and_nearby")
        .sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at))
        .map((a) => {
          const h = who(a.host, viewerRow);
          return {
            id: a.id, section: people.connected.has(a.host) ? "people" : "nearby", interest_id: a.interest_id, title: a.title,
            host_id: a.host, host_first_name: h.first_name, host_photo_path: h.photo_path, starts_at: a.starts_at,
            ends_at: a.ends_at, area_name: a.area_name, distance_km: a.distance_km, participant_limit: a.limit,
            going: goingOf(s, a.id), visibility: a.visibility,
            viewer_state: mine(a.id) ? effective(mine(a.id)) : "none",
          };
        });
      return [200, s.enabled ? rows : []];
    }
    case "search_activities": {
      const q = (args.p_text ?? "").toLowerCase();
      const istDay = (iso) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);
      const rows = s.list
        .filter((a) => a.status === "open" && phase(a) === "open" && visible(s, people, a, viewerInterestIds, radius))
        .filter((a) => a.distance_km <= radius)
        .filter((a) => args.p_interest_id == null || a.interest_id === args.p_interest_id)
        .filter((a) => !args.p_date || istDay(a.starts_at) === args.p_date)
        .filter((a) => !args.p_from_people || people.connected.has(a.host))
        .filter((a) => !q || a.title.toLowerCase().includes(q))
        .sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at))
        .map((a) => {
          const h = who(a.host, viewerRow);
          return {
            id: a.id, interest_id: a.interest_id, title: a.title, host_id: a.host, host_first_name: h.first_name,
            host_photo_path: h.photo_path, starts_at: a.starts_at, ends_at: a.ends_at, area_name: a.area_name,
            distance_km: a.distance_km, participant_limit: a.limit, going: goingOf(s, a.id), visibility: a.visibility,
            viewer_state: a.host === "u1" ? "host" : mine(a.id) ? effective(mine(a.id)) : "none",
          };
        });
      return [200, s.enabled ? rows : []];
    }
    case "activity_details": {
      const a = find(args.p_id);
      if (!a || !visible(s, people, a, viewerInterestIds, radius)) return [200, null];
      const p = mine(a.id);
      const state = a.host === "u1" ? "host" : p ? effective(p) : "none";
      const h = who(a.host, viewerRow);
      return [200, {
        id: a.id, interest_id: a.interest_id, title: a.title, description: a.description, area_name: a.area_name,
        city: a.city, address: state === "host" || state === "accepted" ? a.address : null, distance_km: a.distance_km,
        starts_at: a.starts_at, ends_at: a.ends_at, participant_limit: a.limit, visibility: a.visibility, phase: phase(a),
        cancel_note: state === "none" ? null : a.cancel_note, going: goingOf(s, a.id), viewer_state: state,
        host: {
          id: a.host, first_name: h.first_name, photo_path: h.photo_path, connected: people.connected.has(a.host),
          shared_count: (h.interest_ids ?? viewerInterestIds).filter((i) => viewerInterestIds.includes(i)).length,
          hosted_count: s.list.filter((x) => x.host === a.host && x.status !== "cancelled").length,
        },
        participants: s.parts
          .filter((x) => x.activityId === a.id && x.status === "accepted" && !people.blocked.has(x.userId))
          .map((x) => ({ ...who(x.userId, viewerRow), role: x.role })),
      }];
    }
    case "manage_activity": {
      const a = find(args.p_id);
      if (!a || a.host !== "u1") return [200, null];
      return [200, {
        id: a.id, interest_id: a.interest_id, title: a.title, description: a.description, area_name: a.area_name,
        city: a.city, address: a.address, starts_at: a.starts_at, ends_at: a.ends_at, participant_limit: a.limit,
        visibility: a.visibility, phase: phase(a), cancel_note: a.cancel_note, going: goingOf(s, a.id),
        requests: s.parts
          .filter((x) => x.activityId === a.id && x.status === "requested" && !x.declineAt && !people.blocked.has(x.userId))
          .map((x) => {
            const u = who(x.userId, viewerRow);
            return {
              id: x.id, user_id: u.id, first_name: u.first_name, age: u.age, photo_path: u.photo_path,
              connected: people.connected.has(u.id), distance_km: u.distance_km ?? 0,
              shared_interest_ids: (u.interest_ids ?? []).filter((i) => viewerInterestIds.includes(i)),
            };
          }),
        participants: s.parts
          .filter((x) => x.activityId === a.id && x.status === "accepted")
          .map((x) => ({ ...who(x.userId, viewerRow), role: x.role, connected: people.connected.has(x.userId) })),
      }];
    }
    case "create_activity": {
      if (Date.parse(args.p_starts_at) <= Date.now()) return err("start_in_past");
      const id = `a-new-${s.seq++}`;
      s.list.push(A(id, "u1", args.p_interest_id, args.p_title, {
        description: args.p_description || null, area_name: args.p_area_name, address: args.p_address || null,
        distance_km: 0, starts_at: args.p_starts_at, ends_at: args.p_ends_at, limit: args.p_limit, visibility: args.p_visibility,
      }));
      s.parts.push(P(id, "u1", "host", "accepted"));
      return [200, id];
    }
    case "update_activity_details": {
      const a = find(args.p_id);
      if (!a || a.host !== "u1" || a.status !== "open") return err("not_found");
      a.title = args.p_title;
      a.description = args.p_description || null;
      return [204, undefined];
    }
    case "request_to_join": {
      const a = find(args.p_id);
      if (!a || a.host === "u1" || !visible(s, people, a, viewerInterestIds, radius)) return err("not_found");
      const p = mine(a.id);
      if (p && effective(p) === "requested") return [200, "requested"];
      if (p && effective(p) === "declined") return err("declined");
      if (goingOf(s, a.id) >= a.limit) return err("full");
      if (p) Object.assign(p, { status: "requested", declineAt: null });
      else s.parts.push(P(a.id, "u1", "participant", "requested"));
      return [200, "requested"];
    }
    case "withdraw_join_request":
      s.parts = s.parts.filter((p) => !(p.activityId === args.p_id && p.userId === "u1" && p.status === "requested"));
      return [200, "none"];
    case "withdraw_from_activity": {
      const p = mine(args.p_id);
      if (!p || p.status !== "accepted" || p.role !== "participant") return err("not_found");
      p.status = "withdrawn";
      return [200, "withdrawn"];
    }
    case "accept_join_request": {
      const p = s.parts.find((x) => x.id === args.p_participation);
      const a = p && find(p.activityId);
      if (!a || a.host !== "u1" || p.status !== "requested" || p.declineAt) return err("not_found");
      if (goingOf(s, a.id) >= a.limit) return err("full");
      p.status = "accepted";
      return [200, "accepted"];
    }
    case "decline_join_request": {
      const p = s.parts.find((x) => x.id === args.p_participation);
      if (!p || p.status !== "requested" || p.declineAt) return err("not_found");
      p.declineAt = Date.now() + 10_000;
      return [200, new Date(p.declineAt).toISOString()];
    }
    case "undo_decline": {
      const p = s.parts.find((x) => x.id === args.p_participation);
      if (!p || !p.declineAt || p.declineAt <= Date.now()) return err("too_late");
      p.declineAt = null;
      return [204, undefined];
    }
    case "cancel_activity": {
      const a = find(args.p_id);
      if (!a || a.host !== "u1") return err("not_found");
      if (a.status !== "open") return err("closed");
      a.status = "cancelled";
      a.cancel_note = args.p_note || null;
      for (const p of s.parts) {
        if (p.activityId === a.id && p.role === "participant" && (p.status === "accepted" || effective(p) === "requested")) {
          p.status = "closed";
          p.declineAt = null;
        }
      }
      return [200, "cancelled"];
    }
    case "inbox_notifications": {
      if (!s.enabled) return [200, { unread: 0, items: [] }];
      const ago = (m) => new Date(Date.now() - m * 60_000).toISOString();
      const actor = (id) => {
        const d = DEMO.find((x) => x.id === id);
        return { id, first_name: d.first_name, photo_path: d.photo_path, connected: people.connected.has(id), distance_km: d.distance_km,
          shared_count: d.interest_ids.filter((i) => viewerInterestIds.includes(i)).length };
      };
      const act = (id) => {
        const a = find(id);
        return { id, title: a.title, host_first_name: who(a.host, viewerRow).first_name, cancel_note: a.cancel_note };
      };
      const reply = [
        ...[...people.received].filter((id) => !people.blocked.has(id)).map((id) => ({
          id: `n-req-${id}`, type: "connection_request", created_at: ago(120), needs_reply: true, actor: actor(id), activity: null,
        })),
        ...s.parts
          .filter((p) => p.status === "requested" && !p.declineAt && find(p.activityId).host === "u1" && phase(find(p.activityId)) === "open")
          .filter((p) => !people.blocked.has(p.userId))
          .map((p) => ({ id: `n-join-${p.id}`, type: "join_requested", created_at: ago(240), needs_reply: true, actor: actor(p.userId), activity: act(p.activityId) })),
      ];
      const earlier = s.earlier.filter((n) => !people.blocked.has(n.actor)).map((n) => ({
        id: n.id, type: n.type, created_at: ago(n.mins), needs_reply: false, actor: actor(n.actor), activity: n.activity ? act(n.activity) : null,
      }));
      return [200, { unread: people.unread, items: [...reply, ...earlier] }];
    }
    case "mark_notifications_read":
      people.unread = 0;
      return [204, undefined];
    case "inbox_conversations":
      return [200, conversationsOf(s, people, viewerRow)];
    case "unread_chat_count":
      return [200, conversationsOf(s, people, viewerRow).reduce((n, c) => n + c.unread, 0)];
    case "my_profile": {
      const friends = [...people.connected].filter((id) => s.enabled && !people.blocked.has(id)).map((id) => who(id, viewerRow))
        .sort((x, y) => x.first_name.localeCompare(y.first_name));
      const rows = s.parts.filter((p) => p.userId === "u1").map((p) => {
        const a = find(p.activityId);
        const ph = phase(a);
        const st = a.host === "u1" ? "host" : effective(p);
        const upcoming = ph === "open" || ph === "started";
        const tab =
          (ph === "cancelled" && (st === "host" || st === "closed")) || (ph === "completed" && (st === "host" || st === "accepted")) ? "past"
          : upcoming && st === "host" ? "created"
          : (upcoming && st === "accepted") || (ph === "open" && st === "requested") ? "joined"
          : null;
        return tab && { id: a.id, interest_id: a.interest_id, title: a.title, starts_at: a.starts_at, participant_limit: a.limit,
          going: goingOf(s, a.id), phase: ph, tab, my_status: st, host_first_name: who(a.host, viewerRow).first_name };
      }).filter(Boolean).sort((x, y) => x.tab.localeCompare(y.tab)
        || (x.tab === "past" ? Date.parse(y.starts_at) - Date.parse(x.starts_at) : Date.parse(x.starts_at) - Date.parse(y.starts_at)));
      return [200, {
        connections_count: friends.length,
        created_count: s.list.filter((a) => a.host === "u1" && a.status !== "cancelled").length,
        joined_count: s.parts.filter((p) => p.userId === "u1" && p.role === "participant" && p.status === "accepted"
          && find(p.activityId).status !== "cancelled").length,
        pending_count: [...people.received].filter((id) => s.enabled && !people.blocked.has(id)).length,
        connections_preview: friends.slice(0, 3).map((f) => ({ id: f.id, first_name: f.first_name, photo_path: f.photo_path })),
        activities: rows,
      }];
    }
    case "my_connections": {
      if (!s.enabled) return [200, { pending: [], connections: [] }];
      const row = (id) => {
        const d = DEMO.find((x) => x.id === id);
        return { id, first_name: d.first_name, photo_path: d.photo_path, area_name: d.area_name, distance_km: d.distance_km,
          shared_count: d.interest_ids.filter((i) => viewerInterestIds.includes(i)).length };
      };
      return [200, {
        pending: [...people.received].filter((id) => !people.blocked.has(id)).map(row),
        connections: [...people.connected].filter((id) => !people.blocked.has(id)).map(row)
          .sort((x, y) => x.first_name.localeCompare(y.first_name)),
      }];
    }
    default:
      return handleChatRpc(fn, args, s, people, viewerRow);
  }
}

// S20 Chats: activity chats u1 is in + direct chats with connections; unread since u1's last read.
function conversationsOf(s, people, viewerRow) {
  if (!s.enabled) return [];
  const rows = [
    ...s.list.filter((a) => chatMembers(s, a).some((p) => p.userId === "u1")).map((a) => ({ cid: `c-${a.id}`, a })),
    ...[...people.connected].filter((id) => !people.blocked.has(id)).map((id) => ({ cid: `d-${id}`, other: id })),
  ];
  return rows.map((r) => {
    const msgs = (s.messages[r.cid] ?? []).filter((m) => !people.blocked.has(m.sender_id));
    const last = msgs.at(-1);
    const read = s.reads[r.cid] ?? Date.now() - 35 * 60_000;
    const o = r.other ? who(r.other, viewerRow) : null;
    return {
      id: r.cid, type: r.a ? "activity" : "direct", activity_id: r.a?.id ?? null, title: r.a?.title ?? null,
      interest_id: r.a?.interest_id ?? null, other_id: r.other ?? null, other_first_name: o?.first_name ?? null,
      other_photo_path: o?.photo_path ?? null, last_body: last?.body ?? null, last_sender_id: last?.sender_id ?? null,
      last_sender_first_name: last ? who(last.sender_id, viewerRow).first_name : null, last_at: last?.created_at ?? null,
      unread: msgs.filter((m) => m.sender_id !== "u1" && Date.parse(m.created_at) > read).length,
    };
  }).sort((x, y) => (y.last_at ? Date.parse(y.last_at) : 0) - (x.last_at ? Date.parse(x.last_at) : 0));
}

// ---------- S16 / S16-D / S17 ----------
const chatMembers = (s, a) =>
  s.parts.filter((p) => p.activityId === a.id && (p.status === "accepted" || (a.status === "cancelled" && p.status === "closed")));

function handleChatRpc(fn, args, s, people, viewerRow) {
  const find = (id) => s.list.find((a) => a.id === id);
  const conv = (cid) => {
    if (cid?.startsWith("c-")) {
      const a = find(cid.slice(2));
      if (!a || !chatMembers(s, a).some((p) => p.userId === "u1")) return null;
      const readOnly = a.status === "cancelled" ? "cancelled" : Date.now() > endOf(a) + 7 * 86_400_000 ? "closed" : null;
      return { type: "activity", a, readOnly, members: chatMembers(s, a).map((p) => p.userId) };
    }
    if (cid?.startsWith("d-")) {
      const other = cid.slice(2);
      if (!people.connected.has(other) || people.blocked.has(other)) return null;
      return { type: "direct", other, readOnly: null, members: [other, "u1"] };
    }
    return null;
  };

  switch (fn) {
    case "activity_conversation": {
      const cid = `c-${args.p_activity}`;
      return [200, conv(cid) ? cid : null];
    }
    case "direct_conversation":
      return [200, conv(`d-${args.p_other}`) ? `d-${args.p_other}` : null];
    case "chat_thread": {
      const c = conv(args.p_conversation);
      if (!c) return [200, null];
      const all = (s.messages[args.p_conversation] ?? []).filter(
        (m) => !people.blocked.has(m.sender_id) && (!args.p_before || m.created_at < args.p_before),
      );
      const own = all.filter((m) => m.sender_id === "u1").at(-1);
      const a = c.a;
      const host = a && who(a.host, viewerRow);
      return [200, {
        id: args.p_conversation,
        type: c.type,
        read_only: c.readOnly,
        activity: a ? {
          id: a.id, interest_id: a.interest_id, title: a.title, starts_at: a.starts_at, ends_at: a.ends_at,
          area_name: a.area_name, address: a.address, distance_km: a.distance_km, participant_limit: a.limit,
          going: goingOf(s, a.id), phase: phase(a), host_id: a.host,
          viewer_role: a.host === "u1" ? "host" : "participant", host_first_name: host.first_name,
        } : null,
        other: c.type === "direct" ? (({ id, first_name, photo_path }) => ({ id, first_name, photo_path }))(who(c.other, viewerRow)) : null,
        members: c.members.filter((id) => !people.blocked.has(id)).map((id) => ({ ...who(id, viewerRow), is_host: a?.host === id })),
        messages: all.slice(-50),
        has_more: all.length > 50,
        last_own_id: own?.id ?? null,
        // Seeded history counts as read by everyone else; new messages start unseen.
        seen_by: own && own.id.startsWith("m") ? c.members.length - 1 : 0,
      }];
    }
    case "send_message": {
      const c = conv(args.p_conversation);
      if (!c) return err("not_found");
      if (c.readOnly) return err("read_only");
      const body = String(args.p_body ?? "").trim();
      if (!body || body.length > 1000) return err("invalid_body");
      const msg = { id: `n${s.seq++}`, sender_id: "u1", body, created_at: new Date().toISOString() };
      (s.messages[args.p_conversation] ??= []).push(msg);
      return [200, msg];
    }
    case "mark_read":
      s.reads[args.p_conversation] = Date.now();
      return [204, undefined];
    case "after_activity": {
      const a = find(args.p_id);
      if (!a || !s.parts.some((p) => p.activityId === a.id && p.userId === "u1" && p.status === "accepted")) return [200, null];
      const rel = (id) => (people.connected.has(id) ? "connected" : people.sent.has(id) ? "sent" : people.received.has(id) ? "received" : "none");
      return [200, {
        id: a.id, interest_id: a.interest_id, title: a.title, description: a.description, area_name: a.area_name,
        address: a.address, starts_at: a.starts_at, participant_limit: a.limit, visibility: a.visibility,
        phase: phase(a), viewer_first_name: viewerRow.first_name,
        chat_read_only: Date.now() > endOf(a) + 7 * 86_400_000 ? "closed" : null,
        participants: s.parts
          .filter((p) => p.activityId === a.id && p.status === "accepted" && p.userId !== "u1" && !people.blocked.has(p.userId))
          .map((p) => ({ ...who(p.userId, viewerRow), is_host: p.role === "host", relationship: rel(p.userId), together: 1 }))
          .sort((x, y) => Number(y.is_host) - Number(x.is_host) || x.first_name.localeCompare(y.first_name)),
      }];
    }
    case "report_activity":
      s.reports.push(args);
      return [204, undefined];
    default:
      return null;
  }
}

// Others last read 35 minutes ago (after the seeded history, before anything sent in a test).
export function memberReads(s, people, cid) {
  const rest = cid.slice(2);
  const ids = cid.startsWith("c-")
    ? s.parts.filter((p) => p.activityId === rest && p.status === "accepted").map((p) => p.userId)
    : people.connected.has(rest) ? [rest, "u1"] : [];
  if (!ids.includes("u1")) return [];
  const ago = new Date(Date.now() - 35 * 60_000).toISOString();
  return ids.filter((id) => !people.blocked.has(id)).map((id) => ({ user_id: id, last_read_at: id === "u1" ? new Date().toISOString() : ago }));
}

export function activitySnapshot(s) {
  return { list: s.list, parts: s.parts.map((p) => ({ ...p, effective: effective(p) })), messages: s.messages, reports: s.reports };
}

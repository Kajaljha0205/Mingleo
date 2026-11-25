import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Msg } from "@/lib/chat";

const actions = {
  sendMessage: vi.fn(async (_c: string, body: string): Promise<{ message?: Msg; error?: string }> => ({
    message: { id: `srv-${body}`, senderId: "me", body, createdAt: "2026-11-23T10:00:00Z" },
  })),
  markRead: vi.fn(async () => {}),
  loadEarlier: vi.fn(async () => ({ messages: [], hasMore: false })),
};
vi.mock("@/app/(app)/chats/actions", () => actions);
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

type Handler = (p: { new: Record<string, string> }) => void;
const handlers: Record<string, Handler> = {};
const channel = {
  on: vi.fn((_e: string, f: { table: string }, cb: Handler) => {
    handlers[f.table] = cb;
    return channel;
  }),
  subscribe: vi.fn(() => channel),
};
vi.mock("@/lib/supabase/browser", () => ({
  browserClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  }),
}));

const { ChatRoom } = await import("./ChatRoom");

const MEMBERS = [
  { id: "host", firstName: "Tanvi", photoUrl: null, isHost: true, lastReadAt: "2026-11-23T04:00:00Z" },
  { id: "sneha", firstName: "Sneha", photoUrl: null, isHost: false, lastReadAt: "2026-11-23T02:30:00Z" },
  { id: "me", firstName: "Aarav", photoUrl: null, isHost: false, lastReadAt: "2026-11-23T03:00:00Z" },
];
const M = (id: string, senderId: string, body: string, at: string): Msg => ({ id, senderId, body, createdAt: `2026-11-23T0${at}:00Z` });
const HISTORY = [
  M("1", "host", "Court 3 at 6:45", "1:00"),
  M("2", "sneha", "Spare racquet?", "2:00"),
  M("3", "me", "I'll bring one", "3:00"),
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(handlers)) delete handlers[k];
});

function renderRoom(props: Partial<Parameters<typeof ChatRoom>[0]> = {}) {
  return render(
    <ToastProvider>
      <ChatRoom
        conversationId="c1"
        viewerId="me"
        members={MEMBERS}
        initialMessages={HISTORY}
        hasMore={false}
        readOnly={null}
        placeholder="Message the group"
        quickReplies
        header={<h1>Saturday doubles</h1>}
        {...props}
      />
    </ToastProvider>,
  );
}

describe("S16 chat room (ST-143)", () => {
  it("others on the left with name (host tagged), own on the right, Seen by n under the latest own message", async () => {
    renderRoom();
    const items = screen.getAllByTestId("message");
    expect(items[0]).toHaveTextContent("Tanvi · host");
    expect(items[1]).toHaveTextContent("Sneha");
    expect(within(items[2]).getByText("I'll bring one")).toHaveClass("bg-blue-600");
    // Tanvi read after my 03:00 message; Sneha hasn't yet.
    expect(screen.getByTestId("own-status")).toHaveTextContent("Seen by 1");
    await vi.waitFor(() => expect(actions.markRead).toHaveBeenCalledWith("c1"), { timeout: 2000 });
  });

  it("Seen by n updates live when someone reads (ST-143.6)", async () => {
    renderRoom();
    await vi.waitFor(() => expect(handlers.conversation_members).toBeDefined());
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "conversation_members", filter: "conversation_id=eq.c1" }),
      expect.any(Function),
    );
    act(() => handlers.conversation_members({ new: { user_id: "sneha", last_read_at: "2026-11-23T05:00:00+00:00" } }));
    expect(screen.getByTestId("own-status")).toHaveTextContent("Seen by 2");
  });

  it("sends from the composer and quick replies; status goes back to Sent", async () => {
    const user = userEvent.setup();
    renderRoom();
    await user.type(screen.getByPlaceholderText("Message the group"), "See you at 6:45");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(actions.sendMessage).toHaveBeenCalledWith("c1", "See you at 6:45");
    expect(await screen.findByText("See you at 6:45")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message the group")).toHaveValue("");
    expect(await screen.findByTestId("own-status")).toHaveTextContent("Sent");

    await user.click(screen.getByRole("button", { name: "Running 10 min late" }));
    expect(actions.sendMessage).toHaveBeenLastCalledWith("c1", "Running 10 min late");
  });

  it("rolls back and keeps the text when sending fails", async () => {
    actions.sendMessage.mockResolvedValueOnce({ error: "This chat is read-only now." });
    const user = userEvent.setup();
    renderRoom();
    await user.type(screen.getByPlaceholderText("Message the group"), "Hello?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("This chat is read-only now.")).toBeInTheDocument();
    expect(screen.queryByText("Hello?", { selector: "p" })).toBeNull();
    expect(screen.getByPlaceholderText("Message the group")).toHaveValue("Hello?");
  });

  it("new messages arrive through Realtime without a reload", async () => {
    renderRoom();
    await vi.waitFor(() => expect(handlers.messages).toBeDefined());
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "messages", filter: "conversation_id=eq.c1" }),
      expect.any(Function),
    );
    act(() => handlers.messages({ new: { id: "9", sender_id: "sneha", body: "Shuttles are on me", created_at: "2026-11-23T09:00:00Z" } }));
    expect(screen.getByText("Shuttles are on me")).toBeInTheDocument();
    act(() => handlers.messages({ new: { id: "10", sender_id: "new-person", body: "Hi all", created_at: "2026-11-23T09:30:00Z" } }));
    expect(refresh).toHaveBeenCalled(); // unknown sender → reload members
  });

  it("read-only chats show why and hide the composer", () => {
    renderRoom({ readOnly: "This activity was cancelled, so the chat is read-only." });
    expect(screen.getByRole("status")).toHaveTextContent("cancelled");
    expect(screen.queryByPlaceholderText("Message the group")).toBeNull();
    expect(screen.queryByRole("button", { name: "On my way" })).toBeNull();
  });
});

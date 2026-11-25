import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
}));

const { POST } = await import("./route");
const { GET } = await import("./callback/route");

beforeEach(() => vi.clearAllMocks());

describe("POST /auth/google", () => {
  it("redirects (303) to the Google authorize URL with our callback", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://test-project.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });
    const res = await POST(new NextRequest("http://localhost:3000/auth/google", { method: "POST" }));

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/google/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/auth/v1/authorize?provider=google");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("falls back to S01 when Supabase returns an error", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: new Error("x") });
    const res = await POST(new NextRequest("http://localhost:3000/auth/google", { method: "POST" }));
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });
});

describe("GET /auth/google/callback", () => {
  it("exchanges the code and returns to / for routing", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      new NextRequest("http://localhost:3000/auth/google/callback?code=abc&next=https://evil.test"),
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("does not call Supabase without a code", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/auth/google/callback"));
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });
});

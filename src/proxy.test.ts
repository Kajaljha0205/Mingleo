import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

const { proxy } = await import("./proxy");

const signedOut = { data: null, error: null };
const signedIn = { data: { claims: { sub: "u1" } }, error: null };

beforeEach(() => vi.clearAllMocks());

describe("proxy", () => {
  it("lets signed-out visitors see S01 at /", async () => {
    getClaims.mockResolvedValue(signedOut);
    const res = await proxy(new NextRequest("http://localhost:3000/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends signed-in users from S01 to the onboarding resolver", async () => {
    getClaims.mockResolvedValue(signedIn);
    const res = await proxy(new NextRequest("http://localhost:3000/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  it("sends signed-out visitors on onboarding steps back to S01", async () => {
    getClaims.mockResolvedValue(signedOut);
    const res = await proxy(new NextRequest("http://localhost:3000/onboarding/photo"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("lets signed-in users through to onboarding steps", async () => {
    getClaims.mockResolvedValue(signedIn);
    const res = await proxy(new NextRequest("http://localhost:3000/onboarding/photo"));
    expect(res.headers.get("location")).toBeNull();
  });
});

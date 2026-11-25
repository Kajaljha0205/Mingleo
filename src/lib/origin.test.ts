import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOrigin } from "./origin";

afterEach(() => vi.unstubAllEnvs());

const req = (host: string) => new NextRequest("http://localhost:3000/auth/google", { headers: { host } });

describe("requestOrigin", () => {
  it("uses the LAN host when it is listed in DEV_ORIGINS", () => {
    vi.stubEnv("DEV_ORIGINS", "192.168.1.6, 10.0.0.2");
    expect(requestOrigin(req("192.168.1.6:3000"))).toBe("http://192.168.1.6:3000");
  });

  it("ignores hosts that aren't allowed (no Host-header injection)", () => {
    vi.stubEnv("DEV_ORIGINS", "192.168.1.6");
    expect(requestOrigin(req("evil.test"))).toBe("http://localhost:3000");
  });

  it("falls back to the request URL when DEV_ORIGINS is unset", () => {
    vi.stubEnv("DEV_ORIGINS", "");
    expect(requestOrigin(req("192.168.1.6:3000"))).toBe("http://localhost:3000");
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jwtVerify } from "jose";

const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      set: mockCookieSet,
      get: vi.fn(),
      delete: vi.fn(),
    })
  ),
}));

const { createSession } = await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets the auth-token cookie", async () => {
    await createSession("user-123", "test@example.com");
    expect(mockCookieSet).toHaveBeenCalledOnce();
    expect(mockCookieSet.mock.calls[0][0]).toBe("auth-token");
  });

  it("sets the cookie as httpOnly", async () => {
    await createSession("user-123", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
  });

  it("sets sameSite to lax", async () => {
    await createSession("user-123", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.sameSite).toBe("lax");
  });

  it("sets path to /", async () => {
    await createSession("user-123", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.path).toBe("/");
  });

  it("sets secure to false outside of production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    await createSession("user-123", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.secure).toBe(false);
  });

  it("sets secure to true in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession("user-123", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.secure).toBe(true);
  });

  it("sets cookie expiry to approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const options = mockCookieSet.mock.calls[0][2];
    const expiresMs = options.expires.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs);
  });

  it("stores a valid JWT as the cookie value", async () => {
    await createSession("user-123", "test@example.com");
    const token = mockCookieSet.mock.calls[0][1];
    await expect(jwtVerify(token, JWT_SECRET)).resolves.toBeDefined();
  });

  it("encodes userId and email in the JWT payload", async () => {
    await createSession("user-123", "test@example.com");
    const token = mockCookieSet.mock.calls[0][1];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("test@example.com");
  });

  it("encodes expiresAt in the JWT payload", async () => {
    const before = Date.now();
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const token = mockCookieSet.mock.calls[0][1];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const expiresAt = new Date(payload.expiresAt as string).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs);
    expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs);
  });
});

import { SignJWT, jwtVerify, errors } from "jose";

interface VerifyOk {
  ok: true;
  playerId: string;
  name: string;
}

interface VerifyErr {
  ok: false;
  error: "invalid-token" | "expired-token";
}

type VerifyResult = VerifyOk | VerifyErr;

interface RefreshOk {
  ok: true;
  token: string;
}

interface RefreshErr {
  ok: false;
  error: string;
}

type RefreshResult = RefreshOk | RefreshErr;

export interface GuestAuth {
  issue: (playerId: string, name: string) => Promise<string>;
  verify: (token: string) => Promise<VerifyResult>;
  refresh: (token: string) => Promise<RefreshResult>;
}

export function createGuestAuth(secret: string, expiresIn: string = "7d"): GuestAuth {
  const encodedSecret = new TextEncoder().encode(secret);

  async function issue(playerId: string, name: string): Promise<string> {
    return new SignJWT({ pid: playerId, name })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(encodedSecret);
  }

  async function verify(token: string): Promise<VerifyResult> {
    try {
      const { payload } = await jwtVerify(token, encodedSecret);
      const pid = payload["pid"];
      const name = payload["name"];
      if (typeof pid !== "string" || typeof name !== "string") {
        return { ok: false, error: "invalid-token" };
      }
      return { ok: true, playerId: pid, name };
    } catch (err) {
      if (err instanceof errors.JWTExpired) {
        return { ok: false, error: "expired-token" };
      }
      return { ok: false, error: "invalid-token" };
    }
  }

  async function refresh(token: string): Promise<RefreshResult> {
    const result = await verify(token);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    const newToken = await issue(result.playerId, result.name);
    return { ok: true, token: newToken };
  }

  return { issue, verify, refresh };
}

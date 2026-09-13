import { blocksClient } from "./client";
import { blocksConfig } from "./config";
import { isJwtExpired } from "./jwt";

// IAM's hosted IdP flow sets the session as a Secure, httpOnly cookie by
// default -- this app never sees that token and must not try to. Bearer
// tokens below are only populated when a tenant's OIDC config explicitly
// opts into returning tokens in the response body instead of a cookie; in
// the default cookie flow every function below simply no-ops around them.
//
// Everything here is browser-only. Next.js server-renders client components,
// so every storage access is guarded and only ever runs inside effects or
// event handlers.
const TOKEN_KEY = "pathaopoth:access-token";
const RETURN_KEY = "pathaopoth:oidc-return-to";

export type CallbackResult = { ok: true; returnTo: string } | { ok: false; message: string };

let cachedAccessToken: string | undefined;
let cachedRefreshToken: string | undefined;
let refreshInFlight: Promise<string | undefined> | undefined;

const sessionExpiredListeners = new Set<() => void>();

function storage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener();
}

function getAccessToken(): string | undefined {
  if (cachedAccessToken && !isJwtExpired(cachedAccessToken)) return cachedAccessToken;

  const stored = storage()?.getItem(TOKEN_KEY);
  if (stored && !isJwtExpired(stored)) {
    cachedAccessToken = stored;
    return stored;
  }

  return undefined;
}

// In-memory only, deliberately: a refresh token is long-lived and anything
// readable from JS is readable by an XSS payload. IAM's httpOnly cookie
// re-establishes the session after a reload.
function getRefreshToken(): string | undefined {
  return cachedRefreshToken;
}

function persistTokens(accessToken: string, refreshToken?: string): void {
  cachedAccessToken = accessToken;
  storage()?.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) cachedRefreshToken = refreshToken;
}

function clearLocalTokens(): void {
  cachedAccessToken = undefined;
  cachedRefreshToken = undefined;
  storage()?.removeItem(TOKEN_KEY);
}

// `accessToken` resolver for createBlocksClient: returns the cached token when
// fresh, otherwise refreshes it -- concurrent callers share one in-flight
// refresh. Resolves to undefined in the default cookie flow; the SDK still
// sends the session cookie on every request.
export async function getValidAccessToken(): Promise<string | undefined> {
  const current = getAccessToken();
  if (current) return current;
  return forceRefreshAccessToken();
}

// `onUnauthorized` for createBlocksClient: a 401 means the server already
// disagreed with our local freshness judgment, so go straight to refresh.
export async function forceRefreshAccessToken(): Promise<string | undefined> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return undefined;

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(refreshToken).finally(() => {
      refreshInFlight = undefined;
    });
  }

  return refreshInFlight;
}

async function refreshAccessToken(refreshToken: string): Promise<string | undefined> {
  let response: Awaited<ReturnType<typeof blocksClient.auth.oidc.refreshToken>>;
  try {
    response = await blocksClient.auth.oidc.refreshToken({ refreshToken });
  } catch {
    // Transport failure says nothing about the token; keep it for next time.
    return undefined;
  }

  const accessToken = response.access_token ?? response.accessToken;
  if (!accessToken) {
    clearLocalTokens();
    await blocksClient.auth.logout({ refreshToken }).catch(() => undefined);
    notifySessionExpired();
    return undefined;
  }

  const nextRefreshToken = response.refresh_token ?? response.refreshToken ?? refreshToken;
  persistTokens(accessToken, nextRefreshToken);
  return accessToken;
}

// The session's source of truth is IAM (GET /iam/v4/auth/me), not a token this
// app can inspect. A successful call is what "signed in" means.
export async function fetchSessionClaims(): Promise<Record<string, unknown> | undefined> {
  try {
    return await blocksClient.auth.userInfo();
  } catch {
    return undefined;
  }
}

export async function startLogin(returnTo?: string): Promise<void> {
  if (!blocksConfig.oidcClientId) {
    throw new Error("Login is not configured. Set NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID in .env.");
  }
  storage()?.setItem(RETURN_KEY, returnTo || "/");
  await blocksClient.auth.idp.redirectToProvider();
}

export async function completeLogin(callbackUrl: string): Promise<CallbackResult> {
  const returnTo = storage()?.getItem(RETURN_KEY) || "/";
  storage()?.removeItem(RETURN_KEY);

  const data = await blocksClient.auth.idp.callback(callbackUrl);
  if (data.error) {
    return { message: data.error_description || data.error, ok: false };
  }

  // In the default cookie flow IAM sets the session via Set-Cookie and returns
  // no token in the body -- that's success, not a failure.
  const accessToken = data.access_token ?? data.accessToken;
  if (accessToken) persistTokens(accessToken, data.refresh_token ?? data.refreshToken);

  return { ok: true, returnTo };
}

export async function logout(): Promise<void> {
  await blocksClient.auth.logout({ refreshToken: getRefreshToken() }).catch(() => undefined);
  clearLocalTokens();
}

import { createBlocksClient } from "@seliseblocks/client";
import { forceRefreshAccessToken, getValidAccessToken } from "./auth";
import { getBlocksConfig } from "./config";

// The OIDC redirect URI must match the origin the app is actually served from
// (https://<domain>:3000 locally, https://<domain> deployed) -- both are
// registered on the public client. In the browser that is the live origin;
// during server rendering the configured app domain stands in, since no
// login can start there anyway.
function redirectUri(): string {
  const origin = typeof window === "undefined" ? getBlocksConfig().appDomain.replace(/\/+$/, "") : window.location.origin;
  return `${origin}/login/callback`;
}

type BlocksClient = ReturnType<typeof createBlocksClient>;

function createClient(): BlocksClient {
  const config = getBlocksConfig();
  return createBlocksClient({
    accessToken: () => getValidAccessToken(),
    apiUrl: config.apiUrl,
    appDomain: config.appDomain,
    onUnauthorized: () => forceRefreshAccessToken(),
    oidc: {
      clientId: config.oidcClientId,
      redirectUri: redirectUri(),
      scope: config.oidcScope,
      url: config.oidcUrl
    },
    xBlocksKey: config.xBlocksKey
  });
}

let cached: BlocksClient | undefined;

// Built on first use so production can read runtime env (and the layout
// script) instead of values baked at `next build`.
export const blocksClient: BlocksClient = new Proxy({} as BlocksClient, {
  get(_target, prop, _receiver) {
    cached ??= createClient();
    const value = Reflect.get(cached as object, prop, cached);
    return typeof value === "function" ? value.bind(cached) : value;
  }
});

import { createBlocksClient } from "@seliseblocks/client";
import { blocksConfig } from "./config";
import { forceRefreshAccessToken, getValidAccessToken } from "./auth";

// The OIDC redirect URI must match the origin the app is actually served from
// (https://<domain>:5173 locally, https://<domain> deployed) -- both are
// registered on the public client. In the browser that is the live origin;
// during server rendering the configured app domain stands in, since no
// login can start there anyway.
function redirectUri(): string {
  const origin = typeof window === "undefined" ? blocksConfig.appDomain.replace(/\/+$/, "") : window.location.origin;
  return `${origin}/login/callback`;
}

// The single Blocks API entry point for this app. Every Auth, IAM, Data,
// Notifier and Localization call goes through this client -- never a
// hand-written fetch() against a Blocks host. Importing it from
// server-rendered client components is safe; the redirect/callback helpers
// only run in event handlers and effects.
export const blocksClient = createBlocksClient({
  accessToken: () => getValidAccessToken(),
  apiUrl: blocksConfig.apiUrl,
  appDomain: blocksConfig.appDomain,
  onUnauthorized: () => forceRefreshAccessToken(),
  oidc: {
    clientId: blocksConfig.oidcClientId,
    redirectUri: redirectUri(),
    scope: blocksConfig.oidcScope,
    url: blocksConfig.oidcUrl
  },
  xBlocksKey: blocksConfig.xBlocksKey
});

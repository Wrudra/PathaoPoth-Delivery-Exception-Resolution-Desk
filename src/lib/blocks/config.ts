// Public Blocks identifiers for this app. Safe in the browser: the tenant
// key routes requests, the client id names a public PKCE client. Values come
// from process env (local .env, or the Blocks Release secret set at runtime)
// -- never from committed Dockerfile defaults.
//
// Prefer BLOCKS_* (not inlined at `next build`) then NEXT_PUBLIC_BLOCKS_*.
// Getters stay lazy so importing this module during build does not throw.

export type BlocksPublicConfig = {
  apiUrl: string;
  appDomain: string;
  oidcUrl: string;
  oidcClientId: string;
  oidcScope: string;
  xBlocksKey: string;
};

declare global {
  interface Window {
    __PATHAOPOTH_BLOCKS__?: BlocksPublicConfig;
  }
}

function pick(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function readBlocksConfigFromEnv(): BlocksPublicConfig {
  return {
    apiUrl: pick(process.env.BLOCKS_API_URL, process.env.NEXT_PUBLIC_BLOCKS_API_URL),
    appDomain: pick(process.env.BLOCKS_APP_DOMAIN, process.env.NEXT_PUBLIC_BLOCKS_APP_DOMAIN),
    oidcUrl: pick(process.env.BLOCKS_OIDC_URL, process.env.NEXT_PUBLIC_BLOCKS_OIDC_URL) || "https://iam.seliseblocks.com",
    oidcClientId: pick(process.env.BLOCKS_OIDC_CLIENT_ID, process.env.NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID),
    oidcScope: pick(process.env.BLOCKS_OIDC_SCOPE, process.env.NEXT_PUBLIC_BLOCKS_OIDC_SCOPE) || "openid profile",
    xBlocksKey: pick(
      process.env.BLOCKS_PROJECT_KEY,
      process.env.NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY,
      process.env.NEXT_PUBLIC_BLOCKS_PROJECT_KEY
    )
  };
}

export function getBlocksConfig(): BlocksPublicConfig {
  if (typeof window !== "undefined") {
    const injected = window.__PATHAOPOTH_BLOCKS__;
    if (injected?.apiUrl && injected.xBlocksKey) return injected;
  }
  return readBlocksConfigFromEnv();
}

export const blocksConfig: BlocksPublicConfig = new Proxy({} as BlocksPublicConfig, {
  get(_target, prop) {
    if (typeof prop !== "string") return undefined;
    return getBlocksConfig()[prop as keyof BlocksPublicConfig];
  }
});

export function isBlocksConfigured(): boolean {
  const config = getBlocksConfig();
  return Boolean(config.apiUrl && config.xBlocksKey && config.appDomain);
}

export function isLoginConfigured(): boolean {
  const config = getBlocksConfig();
  return Boolean(config.apiUrl && config.oidcUrl && config.oidcClientId);
}

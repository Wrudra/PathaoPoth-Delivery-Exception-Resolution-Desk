// Public Blocks identifiers for this app. Safe in the browser: the tenant
// key routes requests, the client id names a public PKCE client. Values come
// from process env (local .env, or the Blocks Release secret set at runtime)
// -- never from committed Dockerfile defaults.

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

function read(name: string, fallback = ""): string {
  const value = typeof process !== "undefined" ? process.env[name] : undefined;
  return value?.trim() || fallback;
}

export function readBlocksConfigFromEnv(): BlocksPublicConfig {
  return {
    apiUrl: read("NEXT_PUBLIC_BLOCKS_API_URL"),
    appDomain: read("NEXT_PUBLIC_BLOCKS_APP_DOMAIN"),
    oidcUrl: read("NEXT_PUBLIC_BLOCKS_OIDC_URL", "https://iam.seliseblocks.com"),
    oidcClientId: read("NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID"),
    oidcScope: read("NEXT_PUBLIC_BLOCKS_OIDC_SCOPE", "openid profile"),
    xBlocksKey: read("NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY")
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

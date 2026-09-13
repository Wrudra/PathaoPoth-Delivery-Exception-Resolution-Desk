// Public Blocks identifiers for this app. All of these are safe in the browser:
// the tenant key routes requests, the client id names a *public* PKCE client.
export const blocksConfig = {
  apiUrl: process.env.NEXT_PUBLIC_BLOCKS_API_URL ?? "",
  appDomain: process.env.NEXT_PUBLIC_BLOCKS_APP_DOMAIN ?? "",
  oidcUrl: process.env.NEXT_PUBLIC_BLOCKS_OIDC_URL ?? "https://iam.seliseblocks.com",
  oidcClientId: process.env.NEXT_PUBLIC_BLOCKS_OIDC_CLIENT_ID ?? "",
  oidcScope: process.env.NEXT_PUBLIC_BLOCKS_OIDC_SCOPE ?? "openid profile",
  // Sent as the x-blocks-key header on every Blocks API call and as tenant_id
  // on the OIDC login request.
  xBlocksKey: process.env.NEXT_PUBLIC_BLOCKS_X_BLOCKS_KEY ?? ""
};

export function isBlocksConfigured(): boolean {
  return Boolean(blocksConfig.apiUrl && blocksConfig.xBlocksKey && blocksConfig.appDomain);
}

export function isLoginConfigured(): boolean {
  return Boolean(blocksConfig.apiUrl && blocksConfig.oidcUrl && blocksConfig.oidcClientId);
}

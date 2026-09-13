import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import { ensureDevCert } from "./generate-cert.mjs";
import { devHost, devPort, readDevEnv } from "./env.mjs";

// `npm run dev`: serve the app over HTTPS on the project's own domain and the
// port registered in the OIDC client's redirect URI. Anything else (http://,
// localhost, another port) loads fine but never receives the session cookie.
const env = readDevEnv();
const host = devHost(env);
const port = devPort(env);

if (!host) {
  console.error("BLOCKS_DEV_HOST is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const cert = ensureDevCert({ domain: host });
if (cert.created) console.log(`Created dev certificate for ${host} in .cert/`);

try {
  const { address } = await dns.lookup(host);
  if (address !== "127.0.0.1" && address !== "::1") {
    console.warn(`\nWarning: ${host} resolves to ${address}, not this machine.`);
    console.warn(`Add this line to your hosts file so the browser reaches the dev server:\n  127.0.0.1 ${host}\n`);
  }
} catch {
  console.warn(`\n${host} does not resolve yet. Add this line to your hosts file (macOS/Linux: /etc/hosts):`);
  console.warn(`  127.0.0.1 ${host}\n`);
}

console.log(`Starting Next.js on https://${host}:${port}  (open exactly this URL, not localhost)\n`);

// Bind every interface rather than the hostname: until the hosts entry exists
// the domain resolves to the Blocks cloud IP and the bind would fail. The
// domain itself is allowed as a dev origin in next.config.ts.
const child = spawn(
  "npx",
  [
    "next",
    "dev",
    "-H",
    "0.0.0.0",
    "-p",
    String(port),
    "--experimental-https",
    "--experimental-https-key",
    cert.keyPath,
    "--experimental-https-cert",
    cert.certPath
  ],
  { stdio: "inherit", env: process.env }
);

child.on("exit", (code) => process.exit(code ?? 0));

import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import { ensureDevCert } from "./generate-cert.mjs";
import { devHost, devPort, readDevEnv } from "./env.mjs";

// `npm run dev:https`: serve the app over HTTPS on the project's own domain and
// the port registered in the OIDC client's redirect URI. Anything else
// (http://, localhost, another port) loads fine but never receives the Blocks
// session cookie, so this script refuses to fall back to localhost.
const env = readDevEnv();
const host = devHost(env);
const port = devPort(env);

if (!host) {
  console.error("BLOCKS_DEV_HOST is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const cert = ensureDevCert({ domain: host });
if (cert.created) console.log(`Created dev certificate for ${host} in .cert/`);

// The domain must resolve to this machine before we bind to it; otherwise the
// browser would reach the Blocks cloud edge instead of the dev server.
let resolved;
try {
  resolved = (await dns.lookup(host)).address;
} catch {
  resolved = undefined;
}
if (resolved !== "127.0.0.1" && resolved !== "::1") {
  console.error(`\n${host} resolves to ${resolved ?? "nothing"}, not this machine.`);
  console.error("Add the hosts entry once, then run this again:\n");
  console.error(`  echo "127.0.0.1 ${host}" | sudo tee -a /etc/hosts\n`);
  process.exit(1);
}

console.log(`\nPathaoPoth desk → https://${host}:${port}\n(open exactly this URL; localhost will not receive the login cookie)\n`);

const child = spawn(
  "npx",
  [
    "next",
    "dev",
    "-H",
    host,
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

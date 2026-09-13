import fs from "node:fs";
import path from "node:path";
import selfsigned from "selfsigned";
import { devHost, readDevEnv } from "./env.mjs";

// Writes a self-signed dev certificate for the project's real domain so the
// app can be served over HTTPS locally. Pure Node (no OpenSSL): the hosted
// Blocks login sets a Secure, domain-scoped cookie that browsers refuse on
// plain http://localhost, so the dev server has to look like the real origin.
export function ensureDevCert({ cwd = process.cwd(), domain, force = false } = {}) {
  const host = domain || devHost(readDevEnv(cwd));
  if (!host) {
    throw new Error("No domain given. Set BLOCKS_DEV_HOST in .env or run `npm run cert -- <domain>`.");
  }

  const dir = path.join(cwd, ".cert");
  const keyPath = path.join(dir, "dev-key.pem");
  const certPath = path.join(dir, "dev-cert.pem");
  if (!force && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { certPath, created: false, host, keyPath };
  }

  const pems = selfsigned.generate([{ name: "commonName", value: host }], {
    algorithm: "sha256",
    days: 825,
    keySize: 2048,
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: host },
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" }
        ]
      }
    ]
  });

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  return { certPath, created: true, host, keyPath };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  const domainArg = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  const result = ensureDevCert({ domain: domainArg, force: process.argv.includes("--force") });
  console.log(`${result.created ? "Created" : "Reusing"} dev certificate for ${result.host}`);
  console.log(`  ${result.keyPath}\n  ${result.certPath}`);
  console.log("\nTrust it once so the browser stops warning (then restart the browser):");
  if (process.platform === "darwin") {
    console.log("  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .cert/dev-cert.pem");
  } else if (process.platform === "win32") {
    console.log("  certutil -addstore -f Root .cert\\dev-cert.pem   (elevated prompt)");
  } else {
    console.log("  sudo cp .cert/dev-cert.pem /usr/local/share/ca-certificates/blocks-dev.crt && sudo update-ca-certificates");
  }
}

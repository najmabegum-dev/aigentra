#!/usr/bin/env node
/**
 * scripts/generate-keys.mjs
 *
 * Generates an Ed25519 (EdDSA) key pair for AIGENTRA authority mandate signing
 * and public SPKI verification.
 *
 * Formats the output as single-line strings with newlines escaped as "\\n"
 * so they can be pasted cleanly into Render dashboard environment variables or .env files.
 */

import * as jose from "jose";

async function main() {
  const { privateKey, publicKey } = await jose.generateKeyPair("EdDSA", {
    extractable: true,
  });

  const privateKeyPem = await jose.exportPKCS8(privateKey);
  const publicKeyPem = await jose.exportSPKI(publicKey);

  // Convert newlines to literal \n for single-line env pasting
  const singleLinePrivate = privateKeyPem.trim().replace(/\r?\n/g, "\\n");
  const singleLinePublic = publicKeyPem.trim().replace(/\r?\n/g, "\\n");

  console.log("# Generated Ed25519 Mandate Key Pair for AIGENTRA");
  console.log("# Paste the values below into your .env or Render dashboard:\n");
  console.log(`MANDATE_SIGNING_PRIVATE_KEY="${singleLinePrivate}"`);
  console.log(`MANDATE_SIGNING_PUBLIC_KEY="${singleLinePublic}"\n`);
}

main().catch((err) => {
  console.error("Error generating mandate keys:", err);
  process.exit(1);
});

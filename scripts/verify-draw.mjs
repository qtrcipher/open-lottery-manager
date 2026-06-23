#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";

function usage() {
  console.error("Usage: npm run verify:draw -- <bundle-json-file-or-url>");
}

function fail(message) {
  console.error(`Verification failed: ${message}`);
  process.exit(1);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)])
    );
  }

  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashToNumber(seed, index) {
  const hash = createHash("sha256").update(`${seed}:${index}`).digest();
  return hash.readUInt32BE(0);
}

function selectWinners(entries, prizes, seed) {
  const pool = entries
    .map((entry) => ({ id: entry.entryId, createdAt: new Date(entry.createdAt) }))
    .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime() || first.id.localeCompare(second.id));
  const orderedPrizes = [...prizes].sort((first, second) => first.sortOrder - second.sortOrder || first.prizeId.localeCompare(second.prizeId));
  const winners = [];
  let poolIndex = 0;
  let rank = 1;

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = hashToNumber(seed, index) % (index + 1);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  for (const prize of orderedPrizes) {
    for (let count = 0; count < prize.quantity && poolIndex < pool.length; count += 1) {
      const entry = entries.find((candidate) => candidate.entryId === pool[poolIndex].id);
      winners.push({
        rank,
        entryId: pool[poolIndex].id,
        ticketCode: entry?.ticketCode ?? "",
        prizeId: prize.prizeId,
        prizeName: prize.name
      });
      poolIndex += 1;
      rank += 1;
    }
  }

  return winners;
}

async function readBundle(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      fail(`could not fetch bundle (${response.status} ${response.statusText})`);
    }
    return response.json();
  }

  return JSON.parse(await fs.readFile(source, "utf8"));
}

const source = process.argv[2];
if (!source) {
  usage();
  process.exit(1);
}

const bundle = await readBundle(source);
const errors = [];
const seedHash = sha256(bundle.draw.seed);
const entryManifestHash = sha256(canonicalJson(bundle.entries));
const bundleHash = sha256(canonicalJson({ ...bundle, draw: { ...bundle.draw, verificationBundleHash: null } }));
const winners = selectWinners(bundle.entries, bundle.prizes, bundle.draw.seed);

if (seedHash !== bundle.draw.seedHash) {
  errors.push("seed hash mismatch");
}

if (entryManifestHash !== bundle.draw.entryManifestHash) {
  errors.push("entry manifest hash mismatch");
}

if (bundle.draw.verificationBundleHash && bundleHash !== bundle.draw.verificationBundleHash) {
  errors.push("verification bundle hash mismatch");
}

if (canonicalJson(winners) !== canonicalJson(bundle.winners)) {
  errors.push("winner replay mismatch");
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Draw bundle verified.");
console.log(`Campaign: ${bundle.campaign.title}`);
console.log(`Draw: ${bundle.draw.id}`);
console.log(`Winners: ${bundle.winners.length}`);
console.log(`Seed hash: ${seedHash}`);
console.log(`Entry manifest hash: ${entryManifestHash}`);
console.log(`Bundle hash: ${bundleHash}`);

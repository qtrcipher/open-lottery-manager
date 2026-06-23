import { describe, expect, it } from "vitest";
import {
  buildDrawVerificationBundle,
  createDrawEntryManifest,
  createVerificationBundleHash,
  createVerificationHash,
  createDrawVerificationSummary,
  verifyDrawBundle
} from "./draw-verification";

describe("createDrawVerificationSummary", () => {
  it("counts total and eligible entries", () => {
    const summary = createDrawVerificationSummary(
      [{ isEligible: true }, { isEligible: false }, { isEligible: true }],
      []
    );

    expect(summary.totalEntryCount).toBe(3);
    expect(summary.eligibleEntryCount).toBe(2);
  });

  it("sets winner count from ordered winner rows", () => {
    const summary = createDrawVerificationSummary(
      [{ isEligible: true }],
      [
        {
          rank: 1,
          prize: { name: "Grand Prize" },
          entry: { name: "Amina Hassan", ticketCode: "TKT-1" }
        }
      ]
    );

    expect(summary.winnerCount).toBe(summary.winners.length);
  });

  it("preserves winner rank order in the summary", () => {
    const summary = createDrawVerificationSummary(
      [{ isEligible: true }, { isEligible: true }],
      [
        {
          rank: 2,
          prize: { name: "Second Prize" },
          entry: { name: "Omar Ali", ticketCode: "TKT-2" }
        },
        {
          rank: 1,
          prize: { name: "First Prize" },
          entry: { name: "Fatima Noor", ticketCode: "TKT-1" }
        }
      ]
    );

    expect(summary.winners).toEqual([
      {
        rank: 1,
        prizeName: "First Prize",
        participantName: "Fatima Noor",
        ticketCode: "TKT-1"
      },
      {
        rank: 2,
        prizeName: "Second Prize",
        participantName: "Omar Ali",
        ticketCode: "TKT-2"
      }
    ]);
  });
});

describe("draw verification bundle", () => {
  const entries = [
    { id: "entry-b", ticketCode: "TKT-B", isEligible: true, createdAt: new Date("2026-06-22T10:00:01.000Z") },
    { id: "entry-x", ticketCode: "TKT-X", isEligible: false, createdAt: new Date("2026-06-22T10:00:00.000Z") },
    { id: "entry-a", ticketCode: "TKT-A", isEligible: true, createdAt: new Date("2026-06-22T10:00:00.000Z") }
  ];
  const prizes = [
    { id: "prize-2", name: "Second", quantity: 1, sortOrder: 2 },
    { id: "prize-1", name: "First", quantity: 1, sortOrder: 1 }
  ];

  it("freezes only eligible entries in deterministic order", () => {
    const manifest = createDrawEntryManifest(entries);

    expect(manifest.entries.map((entry) => entry.entryId)).toEqual(["entry-a", "entry-b"]);
    expect(manifest.entries.map((entry) => entry.ticketCode)).toEqual(["TKT-A", "TKT-B"]);
    expect(manifest.hash).toBe(createVerificationHash(manifest.entries));
  });

  it("builds and verifies a replayable public bundle", () => {
    const manifest = createDrawEntryManifest(entries);
    const bundle = buildDrawVerificationBundle({
      campaign: { id: "campaign-1", slug: "summer", title: "Summer Draw" },
      draw: {
        id: "draw-1",
        createdAt: new Date("2026-06-22T11:00:00.000Z"),
        seed: "fixed-seed",
        seedHash: "a76adeebd4a238b42161a8d8b52b8978df81fc96c50dc76ef302a9f7476df431",
        algorithmVersion: "olm-random-shuffle-v1",
        entryManifestHash: manifest.hash,
        verificationBundleHash: null
      },
      entries: manifest.entries,
      prizes,
      winners: [
        { entryId: "entry-b", prizeId: "prize-1", rank: 1 },
        { entryId: "entry-a", prizeId: "prize-2", rank: 2 }
      ]
    });
    const withStoredHash = {
      ...bundle,
      draw: {
        ...bundle.draw,
        verificationBundleHash: createVerificationBundleHash(bundle)
      }
    };

    expect(verifyDrawBundle(withStoredHash)).toMatchObject({
      ok: true,
      errors: [],
      computedEntryManifestHash: manifest.hash
    });
  });

  it("reports tampered winner bundles", () => {
    const manifest = createDrawEntryManifest(entries);
    const bundle = buildDrawVerificationBundle({
      campaign: { id: "campaign-1", slug: "summer", title: "Summer Draw" },
      draw: {
        id: "draw-1",
        createdAt: new Date("2026-06-22T11:00:00.000Z"),
        seed: "fixed-seed",
        seedHash: "a76adeebd4a238b42161a8d8b52b8978df81fc96c50dc76ef302a9f7476df431",
        algorithmVersion: "olm-random-shuffle-v1",
        entryManifestHash: manifest.hash,
        verificationBundleHash: null
      },
      entries: manifest.entries,
      prizes,
      winners: [
        { entryId: "entry-a", prizeId: "prize-1", rank: 1 },
        { entryId: "entry-b", prizeId: "prize-2", rank: 2 }
      ]
    });

    expect(verifyDrawBundle(bundle).errors).toContain("Replayed winners do not match the published winners.");
  });
});

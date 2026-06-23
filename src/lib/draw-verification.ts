import { createHash } from "node:crypto";
import { createSeedHash, selectWinners, type WinnerSelection } from "./draw";

export type VerificationEntry = {
  isEligible: boolean;
};

export type VerificationWinner = {
  rank: number;
  prize: {
    name: string;
  };
  entry: {
    name: string;
    ticketCode: string;
  };
};

export type VerificationWinnerRow = {
  rank: number;
  prizeName: string;
  participantName: string;
  ticketCode: string;
};

export type DrawVerificationSummary = {
  totalEntryCount: number;
  eligibleEntryCount: number;
  winnerCount: number;
  winners: VerificationWinnerRow[];
};

export type DrawManifestEntry = {
  entryKey: string;
  ticketCode: string;
  createdAt: string;
};

export type StoredDrawManifestEntry = DrawManifestEntry & {
  sourceEntryId: string;
};

export type DrawManifestSourceEntry = {
  id: string;
  ticketCode: string;
  isEligible: boolean;
  createdAt: Date;
};

export type DrawManifest = {
  entries: StoredDrawManifestEntry[];
  publicEntries: DrawManifestEntry[];
  json: string;
  hash: string;
};

export type DrawVerificationBundle = {
  schemaVersion: "olm-draw-bundle-v2";
  campaign: {
    slug: string;
    title: string;
  };
  draw: {
    createdAt: string;
    seed: string;
    seedHash: string;
    algorithmVersion: string;
    entryManifestHash: string;
    verificationBundleHash: string | null;
  };
  entries: DrawManifestEntry[];
  prizes: {
    prizeKey: string;
    name: string;
    quantity: number;
    sortOrder: number;
  }[];
  winners: {
    rank: number;
    entryKey: string;
    ticketCode: string;
    prizeKey: string;
    prizeName: string;
  }[];
};

export type DrawVerificationResult = {
  ok: boolean;
  errors: string[];
  computedSeedHash: string;
  computedEntryManifestHash: string;
  computedBundleHash: string;
  computedWinners: DrawVerificationBundle["winners"];
};

type BundleCampaign = {
  slug: string;
  title: string;
};

type BundleDraw = {
  createdAt: Date;
  seed: string;
  seedHash: string;
  algorithmVersion: string;
  entryManifestHash: string | null;
  verificationBundleHash: string | null;
};

type BundlePrize = {
  id: string;
  name: string;
  quantity: number;
  sortOrder: number;
};

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
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

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function createVerificationHash(value: unknown): string {
  return hashString(canonicalJson(value));
}

function publicEntryKey(index: number): string {
  return `entry-${String(index + 1).padStart(6, "0")}`;
}

function publicPrizeKey(index: number): string {
  return `prize-${String(index + 1).padStart(4, "0")}`;
}

function toPublicManifestEntry(entry: StoredDrawManifestEntry): DrawManifestEntry {
  return {
    entryKey: entry.entryKey,
    ticketCode: entry.ticketCode,
    createdAt: entry.createdAt
  };
}

export function isStoredDrawManifestEntries(value: unknown): value is StoredDrawManifestEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as StoredDrawManifestEntry).entryKey === "string" &&
        typeof (entry as StoredDrawManifestEntry).sourceEntryId === "string" &&
        typeof (entry as StoredDrawManifestEntry).ticketCode === "string" &&
        typeof (entry as StoredDrawManifestEntry).createdAt === "string"
    )
  );
}

export function hasPublicDrawManifest(manifestJson: string | null): boolean {
  if (!manifestJson) {
    return false;
  }

  try {
    return isStoredDrawManifestEntries(JSON.parse(manifestJson));
  } catch {
    return false;
  }
}

export function createDrawEntryManifest(entries: DrawManifestSourceEntry[]): DrawManifest {
  const manifestEntries = entries
    .filter((entry) => entry.isEligible)
    .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime() || first.id.localeCompare(second.id))
    .map((entry, index) => ({
      entryKey: publicEntryKey(index),
      sourceEntryId: entry.id,
      ticketCode: entry.ticketCode,
      createdAt: entry.createdAt.toISOString()
    }));
  const publicEntries = manifestEntries.map(toPublicManifestEntry);
  const json = canonicalJson(manifestEntries);

  return {
    entries: manifestEntries,
    publicEntries,
    json,
    hash: hashString(canonicalJson(publicEntries))
  };
}

function bundleWithoutHash(bundle: DrawVerificationBundle): DrawVerificationBundle {
  return {
    ...bundle,
    draw: {
      ...bundle.draw,
      verificationBundleHash: null
    }
  };
}

export function createVerificationBundleHash(bundle: DrawVerificationBundle): string {
  return createVerificationHash(bundleWithoutHash(bundle));
}

export function buildDrawVerificationBundle({
  campaign,
  draw,
  entries,
  prizes,
  winners
}: {
  campaign: BundleCampaign;
  draw: BundleDraw;
  entries: StoredDrawManifestEntry[];
  prizes: BundlePrize[];
  winners: WinnerSelection[];
}): DrawVerificationBundle {
  const entryBySourceId = new Map(entries.map((entry) => [entry.sourceEntryId, entry]));
  const orderedPrizes = [...prizes].sort((first, second) => first.sortOrder - second.sortOrder || first.id.localeCompare(second.id));
  const prizeRows = orderedPrizes.map((prize, index) => ({
    sourcePrizeId: prize.id,
    prizeKey: publicPrizeKey(index),
    name: prize.name,
    quantity: prize.quantity,
    sortOrder: prize.sortOrder
  }));
  const prizeBySourceId = new Map(prizeRows.map((prize) => [prize.sourcePrizeId, prize]));
  const publicEntries = entries.map(toPublicManifestEntry);
  const bundle: DrawVerificationBundle = {
    schemaVersion: "olm-draw-bundle-v2",
    campaign: {
      slug: campaign.slug,
      title: campaign.title
    },
    draw: {
      createdAt: draw.createdAt.toISOString(),
      seed: draw.seed,
      seedHash: draw.seedHash,
      algorithmVersion: draw.algorithmVersion,
      entryManifestHash: draw.entryManifestHash ?? createVerificationHash(publicEntries),
      verificationBundleHash: draw.verificationBundleHash
    },
    entries: publicEntries,
    prizes: prizeRows.map((prize) => ({
      prizeKey: prize.prizeKey,
      name: prize.name,
      quantity: prize.quantity,
      sortOrder: prize.sortOrder
    })),
    winners: winners
      .sort((first, second) => first.rank - second.rank)
      .map((winner) => {
        const entry = entryBySourceId.get(winner.entryId);
        const prize = prizeBySourceId.get(winner.prizeId);

        if (!entry || !prize) {
          throw new Error("Verification bundle winner references a missing entry or prize.");
        }

        return {
          rank: winner.rank,
          entryKey: entry.entryKey,
          ticketCode: entry.ticketCode,
          prizeKey: prize.prizeKey,
          prizeName: prize.name
        };
      })
  };

  return {
    ...bundle,
    draw: {
      ...bundle.draw,
      verificationBundleHash: draw.verificationBundleHash ?? createVerificationBundleHash(bundle)
    }
  };
}

export function verifyDrawBundle(bundle: DrawVerificationBundle): DrawVerificationResult {
  const errors: string[] = [];
  const computedSeedHash = createSeedHash(bundle.draw.seed);
  const computedEntryManifestHash = hashString(canonicalJson(bundle.entries));
  const bundleForHash = {
    ...bundle,
    draw: {
      ...bundle.draw,
      verificationBundleHash: null
    }
  };
  const computedBundleHash = createVerificationHash(bundleForHash);
  const entryLookup = new Map(bundle.entries.map((entry) => [entry.entryKey, entry]));
  const computedSelection = selectWinners(
    bundle.entries.map((entry) => ({
      id: entry.entryKey,
      isEligible: true,
      createdAt: new Date(entry.createdAt)
    })),
    bundle.prizes.map((prize) => ({
      id: prize.prizeKey,
      quantity: prize.quantity,
      sortOrder: prize.sortOrder
    })),
    bundle.draw.seed
  );
  const computedWinners = computedSelection.winners.map((winner) => {
    const entry = entryLookup.get(winner.entryId);
    const prize = bundle.prizes.find((candidate) => candidate.prizeKey === winner.prizeId);

    return {
      rank: winner.rank,
      entryKey: winner.entryId,
      ticketCode: entry?.ticketCode ?? "",
      prizeKey: winner.prizeId,
      prizeName: prize?.name ?? ""
    };
  });

  if (computedSeedHash !== bundle.draw.seedHash) {
    errors.push("Seed hash does not match the revealed seed.");
  }

  if (computedEntryManifestHash !== bundle.draw.entryManifestHash) {
    errors.push("Entry manifest hash does not match the bundle entries.");
  }

  if (bundle.draw.verificationBundleHash && computedBundleHash !== bundle.draw.verificationBundleHash) {
    errors.push("Verification bundle hash does not match the bundle payload.");
  }

  if (canonicalJson(computedWinners) !== canonicalJson(bundle.winners)) {
    errors.push("Replayed winners do not match the published winners.");
  }

  return {
    ok: errors.length === 0,
    errors,
    computedSeedHash,
    computedEntryManifestHash,
    computedBundleHash,
    computedWinners
  };
}

export function createDrawVerificationSummary(
  entries: VerificationEntry[],
  winners: VerificationWinner[]
): DrawVerificationSummary {
  const orderedWinners = [...winners]
    .sort((first, second) => first.rank - second.rank)
    .map((winner) => ({
      rank: winner.rank,
      prizeName: winner.prize.name,
      participantName: winner.entry.name,
      ticketCode: winner.entry.ticketCode
    }));

  return {
    totalEntryCount: entries.length,
    eligibleEntryCount: entries.filter((entry) => entry.isEligible).length,
    winnerCount: orderedWinners.length,
    winners: orderedWinners
  };
}

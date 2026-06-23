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
  entryId: string;
  ticketCode: string;
  createdAt: string;
};

export type DrawManifestSourceEntry = {
  id: string;
  ticketCode: string;
  isEligible: boolean;
  createdAt: Date;
};

export type DrawManifest = {
  entries: DrawManifestEntry[];
  json: string;
  hash: string;
};

export type DrawVerificationBundle = {
  schemaVersion: "olm-draw-bundle-v1";
  campaign: {
    id: string;
    slug: string;
    title: string;
  };
  draw: {
    id: string;
    createdAt: string;
    seed: string;
    seedHash: string;
    algorithmVersion: string;
    entryManifestHash: string;
    verificationBundleHash: string | null;
  };
  entries: DrawManifestEntry[];
  prizes: {
    prizeId: string;
    name: string;
    quantity: number;
    sortOrder: number;
  }[];
  winners: {
    rank: number;
    entryId: string;
    ticketCode: string;
    prizeId: string;
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
  id: string;
  slug: string;
  title: string;
};

type BundleDraw = {
  id: string;
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

export function createDrawEntryManifest(entries: DrawManifestSourceEntry[]): DrawManifest {
  const manifestEntries = entries
    .filter((entry) => entry.isEligible)
    .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime() || first.id.localeCompare(second.id))
    .map((entry) => ({
      entryId: entry.id,
      ticketCode: entry.ticketCode,
      createdAt: entry.createdAt.toISOString()
    }));
  const json = canonicalJson(manifestEntries);

  return {
    entries: manifestEntries,
    json,
    hash: hashString(json)
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
  entries: DrawManifestEntry[];
  prizes: BundlePrize[];
  winners: WinnerSelection[];
}): DrawVerificationBundle {
  const entryById = new Map(entries.map((entry) => [entry.entryId, entry]));
  const prizeById = new Map(prizes.map((prize) => [prize.id, prize]));
  const bundle: DrawVerificationBundle = {
    schemaVersion: "olm-draw-bundle-v1",
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title
    },
    draw: {
      id: draw.id,
      createdAt: draw.createdAt.toISOString(),
      seed: draw.seed,
      seedHash: draw.seedHash,
      algorithmVersion: draw.algorithmVersion,
      entryManifestHash: draw.entryManifestHash ?? createVerificationHash(entries),
      verificationBundleHash: draw.verificationBundleHash
    },
    entries,
    prizes: prizes
      .map((prize) => ({
        prizeId: prize.id,
        name: prize.name,
        quantity: prize.quantity,
        sortOrder: prize.sortOrder
      }))
      .sort((first, second) => first.sortOrder - second.sortOrder || first.prizeId.localeCompare(second.prizeId)),
    winners: winners
      .sort((first, second) => first.rank - second.rank)
      .map((winner) => {
        const entry = entryById.get(winner.entryId);
        const prize = prizeById.get(winner.prizeId);

        if (!entry || !prize) {
          throw new Error("Verification bundle winner references a missing entry or prize.");
        }

        return {
          rank: winner.rank,
          entryId: winner.entryId,
          ticketCode: entry.ticketCode,
          prizeId: winner.prizeId,
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
  const entryLookup = new Map(bundle.entries.map((entry) => [entry.entryId, entry]));
  const computedSelection = selectWinners(
    bundle.entries.map((entry) => ({
      id: entry.entryId,
      isEligible: true,
      createdAt: new Date(entry.createdAt)
    })),
    bundle.prizes.map((prize) => ({
      id: prize.prizeId,
      quantity: prize.quantity,
      sortOrder: prize.sortOrder
    })),
    bundle.draw.seed
  );
  const computedWinners = computedSelection.winners.map((winner) => {
    const entry = entryLookup.get(winner.entryId);
    const prize = bundle.prizes.find((candidate) => candidate.prizeId === winner.prizeId);

    return {
      rank: winner.rank,
      entryId: winner.entryId,
      ticketCode: entry?.ticketCode ?? "",
      prizeId: winner.prizeId,
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

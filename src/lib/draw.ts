import { createHash, randomBytes } from "node:crypto";

export const drawAlgorithmVersion = "olm-random-shuffle-v1";

export type DrawEntry = {
  id: string;
  isEligible: boolean;
};

export type DrawPrize = {
  id: string;
  quantity: number;
  sortOrder: number;
};

export type WinnerSelection = {
  entryId: string;
  prizeId: string;
  rank: number;
};

function hashToNumber(seed: string, index: number): number {
  const hash = createHash("sha256").update(`${seed}:${index}`).digest();
  return hash.readUInt32BE(0);
}

export function createDrawSeed(): string {
  return randomBytes(32).toString("base64url");
}

export function createSeedHash(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

export function selectWinners(entries: DrawEntry[], prizes: DrawPrize[], seed = createDrawSeed()): {
  seed: string;
  seedHash: string;
  winners: WinnerSelection[];
} {
  const pool = entries.filter((entry) => entry.isEligible);
  const orderedPrizes = [...prizes].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = hashToNumber(seed, index) % (index + 1);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  const winners: WinnerSelection[] = [];
  let poolIndex = 0;
  let rank = 1;

  for (const prize of orderedPrizes) {
    for (let count = 0; count < prize.quantity && poolIndex < pool.length; count += 1) {
      winners.push({
        entryId: pool[poolIndex].id,
        prizeId: prize.id,
        rank
      });
      poolIndex += 1;
      rank += 1;
    }
  }

  return {
    seed,
    seedHash: createSeedHash(seed),
    winners
  };
}

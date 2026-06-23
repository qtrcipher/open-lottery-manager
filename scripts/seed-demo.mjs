import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const demoSlug = "demo-summer-rewards";
const seed = "open-lottery-manager-demo-seed-v1";
const algorithmVersion = "olm-random-shuffle-v1";
const appSettingsId = "app";

const entries = [
  ["Jordan Lee", "jordan.lee@example.com", "DEMO-1001"],
  ["Taylor Morgan", "taylor.morgan@example.com", "DEMO-1002"],
  ["Casey Bennett", "casey.bennett@example.com", "DEMO-1003"],
  ["Morgan Price", "morgan.price@example.com", "DEMO-1004"],
  ["Riley Carter", "riley.carter@example.com", "DEMO-1005"],
  ["Avery Brooks", "avery.brooks@example.com", "DEMO-1006"],
  ["Quinn Parker", "quinn.parker@example.com", "DEMO-1007"],
  ["Jamie Rivera", "jamie.rivera@example.com", "DEMO-1008"],
  ["Alex Foster", "alex.foster@example.com", "DEMO-1009"],
  ["Reese Walker", "reese.walker@example.com", "DEMO-1010"],
  ["Sydney Hayes", "sydney.hayes@example.com", "DEMO-1011"],
  ["Cameron Reed", "cameron.reed@example.com", "DEMO-1012"]
];

function hashToNumber(value, index) {
  const hash = createHash("sha256").update(`${value}:${index}`).digest();
  return hash.readUInt32BE(0);
}

function seedHash(value) {
  return createHash("sha256").update(value).digest("hex");
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

function verificationHash(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function createManifest(entryRecords) {
  const manifestEntries = entryRecords
    .filter((entry) => entry.isEligible)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .map((entry) => ({
      entryId: entry.id,
      ticketCode: entry.ticketCode,
      createdAt: entry.createdAt.toISOString()
    }));
  const json = canonicalJson(manifestEntries);

  return {
    entries: manifestEntries,
    json,
    hash: createHash("sha256").update(json).digest("hex")
  };
}

function selectWinners(entryRecords, prizeRecords) {
  const pool = entryRecords
    .filter((entry) => entry.isEligible)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const prizes = [...prizeRecords].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = hashToNumber(seed, index) % (index + 1);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  const winners = [];
  let poolIndex = 0;
  let rank = 1;

  for (const prize of prizes) {
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

  return winners;
}

function createBundle({ campaign, draw, manifest, prizes, winners }) {
  const entryById = new Map(manifest.entries.map((entry) => [entry.entryId, entry]));
  const prizeById = new Map(prizes.map((prize) => [prize.id, prize]));

  return {
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
      entryManifestHash: manifest.hash,
      verificationBundleHash: null
    },
    entries: manifest.entries,
    prizes: prizes
      .map((prize) => ({
        prizeId: prize.id,
        name: prize.name,
        quantity: prize.quantity,
        sortOrder: prize.sortOrder
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.prizeId.localeCompare(b.prizeId)),
    winners: winners
      .sort((a, b) => a.rank - b.rank)
      .map((winner) => {
        const entry = entryById.get(winner.entryId);
        const prize = prizeById.get(winner.prizeId);

        return {
          rank: winner.rank,
          entryId: winner.entryId,
          ticketCode: entry?.ticketCode ?? "",
          prizeId: winner.prizeId,
          prizeName: prize?.name ?? ""
        };
      })
  };
}

async function main() {
  await prisma.appSettings.upsert({
    where: { id: appSettingsId },
    create: {
      id: appSettingsId,
      operatorName: "Open Lottery Manager",
      publicTagline:
        "Self-hosted campaign management for lawful prize draws, raffles, promotional giveaways, and licensed lottery-style operations.",
      brandColor: "#3f6f5f"
    },
    update: {}
  });

  const existing = await prisma.campaign.findUnique({
    where: { slug: demoSlug },
    select: { id: true }
  });

  if (existing) {
    await prisma.campaign.delete({ where: { id: existing.id } });
  }

  await prisma.auditLog.deleteMany({
    where: {
      action: { in: ["demo.seed", "demo.draw"] }
    }
  });

  const campaign = await prisma.campaign.create({
    data: {
      title: "Demo Customer Rewards Draw",
      slug: demoSlug,
      description:
        "A sample rewards campaign showing public details, participant records, prize setup, auditable draw results, and admin workflows.",
      rules:
        "Demo campaign for evaluating Open Lottery Manager.\n\nNo purchase, payment, or real prize is involved. Operators must replace these rules with their own lawful campaign terms before using the app in production.\n\nSample entries are fictional and use example.com email addresses.",
      timezone: "UTC",
      drawScheduledAt: new Date("2026-08-01T15:00:00.000Z"),
      sponsorName: "Open Lottery Manager Demo",
      eligibilitySummary: "Fictional demo participants only. No real entry, payment, purchase, or prize is involved.",
      prizeValueSummary: "Demo reward values are placeholders for product evaluation.",
      jurisdictionNotice: "Operators must replace this demo notice with campaign-specific lawful terms before publishing a live campaign.",
      status: "DRAWN",
      startsAt: new Date("2026-07-01T09:00:00.000Z"),
      endsAt: new Date("2026-07-31T18:00:00.000Z"),
      isPublic: true,
      allowPublicEntries: false,
      requireLookupReference: true,
      prizes: {
        create: [
          {
            name: "Premium Reward Package",
            description: "One featured reward for the headline campaign winner.",
            quantity: 1,
            sortOrder: 1
          },
          {
            name: "Runner-Up Gift Card",
            description: "Two gift card rewards for additional verified participants.",
            quantity: 2,
            sortOrder: 2
          },
          {
            name: "Participant Bonus",
            description: "Three bonus rewards for eligible campaign participants.",
            quantity: 3,
            sortOrder: 3
          }
        ]
      },
      entries: {
        create: entries.map(([name, email, reference], index) => ({
          name,
          email,
          reference,
          ticketCode: `TKT-DEMO-${String(index + 1).padStart(4, "0")}`,
          isEligible: true
        }))
      }
    }
  });

  const created = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
    include: {
      entries: true,
      prizes: true
    }
  });

  const manifest = createManifest(created.entries);
  const winners = selectWinners(created.entries, created.prizes);
  const draw = await prisma.draw.create({
    data: {
      campaignId: created.id,
      seed,
      seedHash: seedHash(seed),
      algorithmVersion,
      entryManifestHash: manifest.hash,
      entryManifestJson: manifest.json,
      status: "COMPLETED",
      winners: {
        create: winners
      }
    }
  });
  const bundle = createBundle({ campaign: created, draw, manifest, prizes: created.prizes, winners });
  const verificationBundleHash = verificationHash(bundle);

  await prisma.draw.update({
    where: { id: draw.id },
    data: { verificationBundleHash }
  });

  await prisma.auditLog.createMany({
    data: [
      {
        action: "demo.seed",
        entityType: "Campaign",
        entityId: demoSlug,
        metadata: JSON.stringify({ campaignId: created.id, entries: entries.length, prizes: created.prizes.length })
      },
      {
        action: "demo.draw",
        entityType: "Draw",
        entityId: draw.id,
        metadata: JSON.stringify({ campaignId: created.id, winnerCount: winners.length, seedHash: seedHash(seed), verificationBundleHash })
      }
    ]
  });

  console.log(`Seeded demo campaign: /campaigns/${demoSlug}`);
  console.log(`Admin campaign id: ${created.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

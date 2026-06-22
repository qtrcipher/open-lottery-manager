import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const demoSlug = "demo-summer-rewards";
const seed = "open-lottery-manager-demo-seed-v1";
const algorithmVersion = "olm-random-shuffle-v1";
const appSettingsId = "app";

const entries = [
  ["Amina Hassan", "amina@example.com", "DEMO-1001"],
  ["Omar Ali", "omar@example.com", "DEMO-1002"],
  ["Fatima Noor", "fatima@example.com", "DEMO-1003"],
  ["Yousef Rahman", "yousef@example.com", "DEMO-1004"],
  ["Layla Karim", "layla@example.com", "DEMO-1005"],
  ["Noura Saleh", "noura@example.com", "DEMO-1006"],
  ["Hamad Jaber", "hamad@example.com", "DEMO-1007"],
  ["Mariam Khalid", "mariam@example.com", "DEMO-1008"],
  ["Zaid Mansour", "zaid@example.com", "DEMO-1009"],
  ["Sara Ahmed", "sara@example.com", "DEMO-1010"],
  ["Khaled Aziz", "khaled@example.com", "DEMO-1011"],
  ["Reem Faris", "reem@example.com", "DEMO-1012"]
];

function hashToNumber(value, index) {
  const hash = createHash("sha256").update(`${value}:${index}`).digest();
  return hash.readUInt32BE(0);
}

function seedHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function selectWinners(entryRecords, prizeRecords) {
  const pool = entryRecords.filter((entry) => entry.isEligible);
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
      entityType: "Campaign",
      entityId: demoSlug
    }
  });

  const campaign = await prisma.campaign.create({
    data: {
      title: "Demo Summer Rewards Draw",
      slug: demoSlug,
      description:
        "A sample public campaign showing entries, prizes, auditable draw results, and operator-facing management screens.",
      rules:
        "Demo campaign for evaluating Open Lottery Manager.\n\nNo purchase, payment, or real prize is involved. Operators must replace these rules with their own lawful campaign terms before using the app in production.",
      status: "DRAWN",
      startsAt: new Date("2026-07-01T09:00:00.000Z"),
      endsAt: new Date("2026-07-31T18:00:00.000Z"),
      isPublic: true,
      allowPublicEntries: false,
      prizes: {
        create: [
          {
            name: "Grand Prize",
            description: "One featured winner for the headline campaign reward.",
            quantity: 1,
            sortOrder: 1
          },
          {
            name: "Runner-Up Gift Card",
            description: "Two runner-up rewards for additional verified participants.",
            quantity: 2,
            sortOrder: 2
          },
          {
            name: "Community Bonus",
            description: "Three small bonus rewards for campaign engagement.",
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

  const winners = selectWinners(created.entries, created.prizes);
  const draw = await prisma.draw.create({
    data: {
      campaignId: created.id,
      seed,
      seedHash: seedHash(seed),
      algorithmVersion,
      status: "COMPLETED",
      winners: {
        create: winners
      }
    }
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
        metadata: JSON.stringify({ campaignId: created.id, winnerCount: winners.length, seedHash: seedHash(seed) })
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

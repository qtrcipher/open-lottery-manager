import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { buildDrawVerificationBundle, isStoredDrawManifestEntries } from "@/lib/draw-verification";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { slug, isPublic: true, status: { not: "ARCHIVED" } },
    include: {
      draws: {
        orderBy: { createdAt: "desc" },
        include: {
          winners: {
            orderBy: { rank: "asc" },
            include: { entry: true, prize: true }
          }
        }
      },
      prizes: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }
    }
  });

  if (!campaign) {
    notFound();
  }

  const draw = campaign.draws[0];
  if (!draw?.entryManifestJson || !draw.entryManifestHash) {
    notFound();
  }

  const entries = JSON.parse(draw.entryManifestJson);
  if (!isStoredDrawManifestEntries(entries)) {
    notFound();
  }

  const bundle = buildDrawVerificationBundle({
    campaign,
    draw: {
      createdAt: draw.createdAt,
      seed: draw.seed,
      seedHash: draw.seedHash,
      algorithmVersion: draw.algorithmVersion,
      entryManifestHash: draw.entryManifestHash,
      verificationBundleHash: draw.verificationBundleHash
    },
    entries,
    prizes: campaign.prizes,
    winners: draw.winners.map((winner) => ({
      entryId: winner.entryId,
      prizeId: winner.prizeId,
      rank: winner.rank
    }))
  });

  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${campaign.slug}-draw-bundle.json"`
    }
  });
}

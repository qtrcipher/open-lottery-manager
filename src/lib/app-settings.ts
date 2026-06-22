import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { appSettingsSchema } from "@/lib/validators";
import { isReadableBrandColor } from "@/lib/validators";
import type { z } from "zod";

export const appSettingsId = "app";

export const defaultAppSettings = {
  id: appSettingsId,
  operatorName: "Open Lottery Manager",
  publicTagline:
    "Self-hosted campaign management for lawful prize draws, raffles, promotional giveaways, and licensed lottery-style operations.",
  supportEmail: null,
  logoUrl: null,
  brandColor: "#3f6f5f"
};

export type AppSettingsInput = z.infer<typeof appSettingsSchema>;

export async function getAppSettings() {
  const settings = await prisma.appSettings
    .findUnique({
      where: { id: appSettingsId }
    })
    .catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
        return null;
      }

      throw error;
    });

  if (!settings) {
    return defaultAppSettings;
  }

  return {
    ...settings,
    brandColor: isReadableBrandColor(settings.brandColor) ? settings.brandColor : defaultAppSettings.brandColor
  };
}

export async function upsertAppSettings(settings: AppSettingsInput) {
  return prisma.appSettings.upsert({
    where: { id: appSettingsId },
    create: {
      id: appSettingsId,
      ...settings
    },
    update: settings
  });
}

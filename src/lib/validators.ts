import { z } from "zod";

function emptyToNull(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function channelToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function hexToRgb(value: string): { red: number; green: number; blue: number } | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hex = match[1];
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function relativeLuminance(value: string): number | null {
  const rgb = hexToRgb(value);
  if (!rgb) {
    return null;
  }

  return 0.2126 * channelToLinear(rgb.red) + 0.7152 * channelToLinear(rgb.green) + 0.0722 * channelToLinear(rgb.blue);
}

export function isReadableBrandColor(value: string): boolean {
  const luminance = relativeLuminance(value);
  if (luminance === null) {
    return false;
  }

  return 1.05 / (luminance + 0.05) >= 4.5;
}

export const campaignSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(1).max(1000),
  rules: z.string().min(1).max(4000),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isPublic: z.boolean().default(false),
  allowPublicEntries: z.boolean().default(false)
});

export const prizeSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  quantity: z.coerce.number().int().min(1).max(1000),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0)
});

export const entrySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200).transform((value) => value.toLowerCase()),
  reference: z.string().max(120).optional()
});

export const entryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()),
  reference: z.preprocess(emptyToNull, z.string().max(120).nullable()),
  isEligible: z.boolean()
});

export const publicEntrySchema = entrySchema;

export const ticketLookupSchema = z.object({
  email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()),
  reference: z.string().trim().max(120).optional().transform((value) => value || undefined)
});

export const appSettingsSchema = z.object({
  operatorName: z.string().trim().min(2).max(120),
  publicTagline: z.string().trim().min(1).max(280),
  supportEmail: z.preprocess(emptyToNull, z.string().email().max(200).nullable()),
  logoUrl: z.preprocess(
    emptyToNull,
    z
      .string()
      .url()
      .max(500)
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "Logo URL must start with http:// or https://.")
      .nullable()
  ),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #3f6f5f.")
    .refine(isReadableBrandColor, "Choose a darker brand color with readable contrast against white text.")
});

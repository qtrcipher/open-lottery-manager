import { z } from "zod";

function emptyToNull(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export const campaignSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(1).max(1000),
  rules: z.string().min(1).max(4000),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isPublic: z.boolean().default(false)
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
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #3f6f5f.")
});

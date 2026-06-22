import { z } from "zod";

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

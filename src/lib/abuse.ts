export const reviewStatuses = ["APPROVED", "FLAGGED", "REJECTED"] as const;

export type ReviewStatus = (typeof reviewStatuses)[number];

const disposableEmailDomains = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "yopmail.com"
]);

export type EntryRiskInput = {
  email: string;
};

export function isReviewStatus(value: string): value is ReviewStatus {
  return reviewStatuses.includes(value as ReviewStatus);
}

export function normalizeReviewStatus(value: string | null | undefined): ReviewStatus {
  return isReviewStatus(value ?? "") ? (value as ReviewStatus) : "APPROVED";
}

export function detectEntryRisk(input: EntryRiskInput): string[] {
  const domain = input.email.split("@").at(1)?.toLowerCase();
  const flags: string[] = [];

  if (domain && disposableEmailDomains.has(domain)) {
    flags.push("disposable_email_domain");
  }

  return flags;
}

export function reviewStatusForRiskFlags(flags: string[]): ReviewStatus {
  return flags.length > 0 ? "FLAGGED" : "APPROVED";
}

export function isApprovedForDraw(entry: { isEligible: boolean; reviewStatus?: string | null }): boolean {
  return entry.isEligible && normalizeReviewStatus(entry.reviewStatus) === "APPROVED";
}

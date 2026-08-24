import { randomBytes } from "node:crypto";

export function createTicketCode(): string {
  return `TKT-${randomBytes(8).toString("hex").toUpperCase()}`;
}

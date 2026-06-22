import { randomBytes } from "node:crypto";

export function createTicketCode(): string {
  return `TKT-${randomBytes(5).toString("hex").toUpperCase()}`;
}

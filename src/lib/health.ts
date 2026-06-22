import packageJson from "../../package.json";
import { prisma } from "./prisma";

export type HealthStatus = "ok" | "error";

export type HealthPayload = {
  status: HealthStatus;
  version: string;
  database: {
    status: HealthStatus;
  };
  timestamp: string;
};

export function createHealthPayload({
  databaseStatus,
  now = new Date(),
  version = packageJson.version
}: {
  databaseStatus: HealthStatus;
  now?: Date;
  version?: string;
}): HealthPayload {
  return {
    status: databaseStatus === "ok" ? "ok" : "error",
    version,
    database: {
      status: databaseStatus
    },
    timestamp: now.toISOString()
  };
}

export async function checkDatabaseHealth(): Promise<HealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

import packageJson from "../../package.json";
import { prisma } from "./prisma";

export type HealthStatus = "ok" | "error";

export type HealthPayload = {
  status: HealthStatus;
  version: string;
  database: {
    status: HealthStatus;
  };
  uptime: {
    seconds: number;
    display: string;
  };
  publicUrl: string | null;
  timestamp: string;
};

export function getConfiguredPublicUrl(value: string | null | undefined = process.env.PUBLIC_APP_URL): string | null {
  const publicUrl = value?.trim();

  return publicUrl ? publicUrl.replace(/\/+$/, "") : null;
}

export function formatUptime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

export function createHealthPayload({
  databaseStatus,
  now = new Date(),
  publicUrl = getConfiguredPublicUrl(),
  uptimeSeconds = process.uptime(),
  version = packageJson.version
}: {
  databaseStatus: HealthStatus;
  now?: Date;
  publicUrl?: string | null;
  uptimeSeconds?: number;
  version?: string;
}): HealthPayload {
  const normalizedUptime = Math.max(0, Math.floor(uptimeSeconds));

  return {
    status: databaseStatus === "ok" ? "ok" : "error",
    version,
    database: {
      status: databaseStatus
    },
    uptime: {
      seconds: normalizedUptime,
      display: formatUptime(normalizedUptime)
    },
    publicUrl: publicUrl === undefined ? getConfiguredPublicUrl() : getConfiguredPublicUrl(publicUrl),
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

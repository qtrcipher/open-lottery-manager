import nodemailer from "nodemailer";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
};

export type TicketReceiptInput = {
  to: string;
  participantName: string;
  campaignTitle: string;
  ticketCode: string;
  lookupUrl: string;
  supportEmail?: string | null;
};

export type EmailSendResult = {
  attempted: boolean;
  sent: boolean;
  error?: string;
};

function envValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

export function smtpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = envValue(env, "SMTP_HOST");
  const from = envValue(env, "SMTP_FROM");

  if (!host || !from) {
    return null;
  }

  const parsedPort = Number.parseInt(envValue(env, "SMTP_PORT") ?? "587", 10);

  return {
    host,
    port: Number.isFinite(parsedPort) ? parsedPort : 587,
    secure: envValue(env, "SMTP_SECURE") === "true",
    user: envValue(env, "SMTP_USER"),
    password: envValue(env, "SMTP_PASSWORD"),
    from
  };
}

export function isSmtpConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return smtpConfigFromEnv(env) !== null;
}

export async function sendTicketReceipt(input: TicketReceiptInput, env: NodeJS.ProcessEnv = process.env): Promise<EmailSendResult> {
  const config = smtpConfigFromEnv(env);

  if (!config) {
    return { attempted: false, sent: false };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.password ? { auth: { user: config.user, pass: config.password } } : {})
    });

    await transporter.sendMail({
      from: config.from,
      to: input.to,
      subject: `Your ticket for ${input.campaignTitle}`,
      text: [
        `Hello ${input.participantName},`,
        "",
        `Your entry for ${input.campaignTitle} was received.`,
        `Ticket code: ${input.ticketCode}`,
        `Ticket lookup: ${input.lookupUrl}`,
        input.supportEmail ? `Support: ${input.supportEmail}` : "",
        "",
        "Keep this ticket code for your records. This message is a receipt only and does not replace the campaign rules."
      ]
        .filter(Boolean)
        .join("\n")
    });

    return { attempted: true, sent: true };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      error: error instanceof Error ? error.message : "Unknown email delivery error."
    };
  }
}

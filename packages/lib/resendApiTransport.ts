import type { Transport } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type MailMessage from "nodemailer/lib/mailer/mail-message";
import type MimeNode from "nodemailer/lib/mime-node";

const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 15_000;

type ResendAttachment = {
  filename?: string;
  content: string;
  content_type?: string;
};

type ResendEmailRequest = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: ResendAttachment[];
};

type ResendSentMessageInfo = {
  messageId: string;
  envelope: MimeNode.Envelope;
  accepted: string[];
  rejected: string[];
};

type NormalizableContent = { content?: unknown; encoding?: string; filename?: string | false };

type ParsedAddress = { name?: string; address: string };

function isParsedAddress(value: unknown): value is ParsedAddress {
  return (
    typeof value === "object" && value !== null && "address" in value && typeof value.address === "string"
  );
}

function formatAddress(value: unknown): string | null {
  // @types/nodemailer declares getAddresses() entries as strings, but nodemailer returns { name, address }.
  if (typeof value === "string") return value;
  if (!isParsedAddress(value)) return null;
  const { name, address } = value;
  if (!name) return address;
  if (!/[",;:<>@()[\]\\]/.test(name)) return `${name} <${address}>`;
  return `"${name.replace(/(["\\])/g, "\\$1")}" <${address}>`;
}

function formatAddresses(addresses: readonly unknown[] | undefined): string[] | undefined {
  const formatted = (addresses ?? []).map(formatAddress).filter((address) => address !== null);
  return formatted.length ? formatted : undefined;
}

function toBase64({ content, encoding }: NormalizableContent): string | null {
  if (typeof content !== "string") return null;
  if (encoding === "base64") return content;
  return Buffer.from(content, (encoding as BufferEncoding | undefined) ?? "utf8").toString("base64");
}

function toAttachments(data: Mail.Options): ResendAttachment[] | undefined {
  const attachments: ResendAttachment[] = [];

  for (const attachment of data.attachments ?? []) {
    const content = toBase64(attachment);
    if (content === null) continue;
    attachments.push({
      filename: attachment.filename || undefined,
      content,
      content_type: attachment.contentType,
    });
  }

  // SMTP sends icalEvent as an inline text/calendar part; the Resend API only takes attachments,
  // and calendar clients (Apple Calendar, Outlook, Gmail) all recognise a .ics attachment.
  const { icalEvent } = data;
  if (icalEvent) {
    const ical: NormalizableContent & { method?: string } =
      typeof icalEvent === "string" ? { content: icalEvent } : (icalEvent as NormalizableContent);
    const content = toBase64(ical);
    if (content !== null) {
      const method = (ical.method ?? "PUBLISH").toUpperCase();
      attachments.push({
        filename: ical.filename || "invite.ics",
        content,
        content_type: `text/calendar; charset=utf-8; method=${method}`,
      });
    }
  }

  return attachments.length ? attachments : undefined;
}

function toHeaders(headers: Mail.Options["headers"]): Record<string, string> | undefined {
  if (!headers) return undefined;
  const entries = Array.isArray(headers)
    ? headers.map(({ key, value }) => [key, value] as const)
    : Object.entries(headers).map(([key, value]) => {
        const first = Array.isArray(value) ? value[0] : value;
        return [key, typeof first === "string" ? first : first?.value] as const;
      });
  const result = Object.fromEntries(entries.filter(([, value]) => typeof value === "string" && value));
  return Object.keys(result).length ? result : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function postEmail(apiKey: string, body: ResendEmailRequest): Promise<string> {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const json: { id?: string; message?: string } = await response.json().catch(() => ({}));
  if (!response.ok || !json.id) {
    throw new Error(
      `Resend API request failed with status ${response.status}: ${json.message ?? response.statusText}`
    );
  }
  return json.id;
}

/**
 * Nodemailer transport that sends through Resend's HTTPS API instead of SMTP. Hosts such as Railway
 * block outbound SMTP on lower-tier plans, which makes SMTP delivery time out.
 */
export function createResendApiTransport(apiKey: string): Transport<ResendSentMessageInfo | null> {
  return {
    name: "ResendApi",
    version: "1.0.0",
    send(mail: MailMessage<ResendSentMessageInfo | null>, callback) {
      const addresses = mail.message.getAddresses();
      const envelope = mail.message.getEnvelope();

      mail.normalize((normalizeError, data) => {
        if (normalizeError || !data) {
          callback(normalizeError ?? new Error("Unable to prepare email for Resend"), null);
          return;
        }

        const from = formatAddresses(addresses.from)?.[0];
        const to = formatAddresses(addresses.to);
        if (!from || !to) {
          callback(new Error("Unable to send email through Resend: missing from or to address"), null);
          return;
        }

        const body: ResendEmailRequest = {
          from,
          to,
          cc: formatAddresses(addresses.cc),
          bcc: formatAddresses(addresses.bcc),
          reply_to: formatAddresses(addresses["reply-to"]),
          subject: asString(data.subject) ?? "",
          html: asString(data.html),
          text: asString(data.text),
          headers: toHeaders(data.headers),
          attachments: toAttachments(data),
        };

        postEmail(apiKey, body).then(
          (messageId) => callback(null, { messageId, envelope, accepted: envelope.to, rejected: [] }),
          (error: Error) => callback(error, null)
        );
      });
    },
  };
}

export type { ResendSentMessageInfo };

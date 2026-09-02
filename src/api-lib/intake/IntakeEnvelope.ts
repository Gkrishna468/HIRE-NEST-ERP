export type IntakeSource =
  | "gmail"
  | "linkedin"
  | "website"
  | "api"
  | "csv"
  | "mailos"
  | "whatsapp"
  | "unknown";

export interface IntakeAttachment {
  filename: string;
  mimeType: string;
  content: string; // Base64 or text
  size?: number;
}

export interface IntakeEnvelope {
  id: string;
  tenantId: string;
  correlationId: string;
  channel: string; // e.g., email address, phone number
  source: IntakeSource;
  sender: string;
  subject?: string;
  body: string;
  attachments: IntakeAttachment[];
  receivedAt: string;
  metadata?: Record<string, any>;
}

import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class ResendProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly isConfigured: boolean;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.isConfigured = !!apiKey;
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = process.env.RESEND_FROM || 'onboarding@resend.dev';

    if (!this.isConfigured) {
      this.logger.warn(
        'RESEND_API_KEY not configured. Email sending is disabled.',
      );
    }
  }

  async send({
    to,
    subject,
    html,
    text,
  }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    if (!this.isConfigured || !this.resend) {
      this.logger.warn(
        `Email not sent (Resend not configured): to=${to}, subject=${subject}`,
      );
      return;
    }

    try {
      // Add 10 second timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout')), 10000),
      );

      const sendPromise = this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        text,
      });

      await Promise.race([sendPromise, timeoutPromise]);
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(
        `Resend error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

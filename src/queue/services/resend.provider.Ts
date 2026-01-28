import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class ResendProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private readonly from =
    process.env.RESEND_FROM || 'onboarding@resend.dev'; // fallback for testing

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
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        text,
      });
    } catch (error) {
      this.logger.error(
        `Resend error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

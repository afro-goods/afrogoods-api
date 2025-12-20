import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('email') // Matches queue name
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<any, any, string>): Promise<void> {
    this.logger.log(`Processing email job ${job.id}`);

    try {
      // Your real email logic here (e.g., Nodemailer, Resend, SendGrid)
      // const { to, subject, template, data } = job.data;

      // Simulate sending
      // await this.sendEmail(to, subject, template, data);

      await job.log('Email sent successfully');
      // this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
      throw error; // Let BullMQ handle retry
    }
  }

  //   private async sendEmail(
  //     to: string,
  //     subject: string,
  //     template: string,
  //     data: any,
  //   ) {
  //     // Replace with real service later
  //     console.log('Sending email:', { to, subject, template, data });
  //     // await emailService.send(...)
  //   }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.verbose(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.warn(`Job ${job.id} failed: ${err.message}`);
  }
}

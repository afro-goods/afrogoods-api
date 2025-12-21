import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';

@Injectable()
@Processor('email') // Matches queue name
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  /**
   * This method is called automatically when a job is added to the 'email' queue
   */
  async process(job: Job<any, any, string>): Promise<void> {
    this.logger.log(`Processing email job ${job.id} - Type: ${job.name}`);

    try {
      const { to, subject, template, data } = job.data;

      // Send email based on template
      await this.sendEmail(to, subject, template, data);

      await job.log(`Email sent successfully to ${to}`);
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error; // Let BullMQ handle retry
    }
  }

  /**
   * Actual email sending logic
   * Replace with your email service (Nodemailer, Resend, SendGrid, etc.)
   */
  private async sendEmail(
    to: string,
    subject: string,
    template: string,
    data: any,
  ) {
    // TODO: Replace with your actual email service
    this.logger.debug(`Sending email:`, { to, subject, template, data });

    // Example with Nodemailer:
    // await this.mailerService.sendMail({
    //   to,
    //   subject,
    //   template: `./${template}`,
    //   context: data,
    // });

    // Example with Resend:
    // await this.resend.emails.send({
    //   from: 'noreply@afrogoods.com',
    //   to,
    //   subject,
    //   html: await this.renderTemplate(template, data),
    // });

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Called when a job completes successfully
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.verbose(`✅ Job ${job.id} completed successfully`);
  }

  /**
   * Called when a job fails (after all retries)
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`❌ Job ${job.id} failed: ${err.message}`);

    // You could send an alert here
    // await this.notifyAdmins(`Email job ${job.id} failed: ${err.message}`);
  }

  /**
   * Called when a job is active (being processed)
   */
  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`🔄 Job ${job.id} is now active`);
  }
}

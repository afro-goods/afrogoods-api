import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { EmailJobDto } from '../dto/email-job.dto';
import { EmailTemplateService } from '../services/email-template.service';
import { ResendProvider } from '../services/resend.provider';

@Injectable()
@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly templateService: EmailTemplateService,
    private readonly resendProvider: ResendProvider,
  ) {
    super();
  }

  async process(job: Job<EmailJobDto>): Promise<void> {
    this.logger.log(`Processing email job ${job.id} - Type: ${job.name}`);

    try {
      const { to, subject, template, data } = job.data;
      const finalSubject = subject || `AfroGoods – ${template || 'Notification'}`;

      const html = this.templateService.render(template || '', data || {});

      await this.resendProvider.send({
        to,
        subject: finalSubject,
        html,
      });

      await job.log(`Email sent successfully to ${to}`);
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.verbose(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(` Job ${job.id} failed: ${err.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is now active`);
  }
}

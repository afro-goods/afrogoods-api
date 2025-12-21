import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  EmailJobDto,
  SendWelcomeEmailDto,
  SendPasswordResetEmailDto,
  SendVerificationEmailDto,
  SendOrderConfirmationEmailDto,
} from '../dto/email-job.dto';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  /**
   * Generic method to add email jobs to queue
   */
  async sendEmail(dto: EmailJobDto, priority: number = 5) {
    this.logger.log(`Adding email job to queue: ${dto.to}`);

    return this.emailQueue.add('send-email', dto, {
      priority,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(dto: SendWelcomeEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: 'Welcome to AfroGoods!',
      template: 'welcome',
      data: { name: dto.name },
    };

    return this.sendEmail(emailJob);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(dto: SendPasswordResetEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: 'Reset Your Password',
      template: 'password-reset',
      data: { token: dto.token, name: dto.name },
    };

    return this.sendEmail(emailJob, 1); // High priority
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(dto: SendVerificationEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: 'Verify Your Email',
      template: 'email-verification',
      data: { token: dto.token, name: dto.name },
    };

    return this.sendEmail(emailJob, 1); // High priority
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(dto: SendOrderConfirmationEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: 'Order Confirmation',
      template: 'order-confirmation',
      data: { orderId: dto.orderId, ...dto.orderDetails },
    };

    return this.sendEmail(emailJob);
  }
}

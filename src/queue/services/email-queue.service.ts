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
import {
  SendOrderStatusUpdateEmailDto,
  SendAdminCommunicationEmailDto,
  SendCancellationConfirmationEmailDto,
  SendShippingNotificationEmailDto,
} from '../dto/order-email-job.dto';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(@InjectQueue('email') private emailQueue: Queue) { }

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
      template: 'welcomeemail',
      data: {
        name: dto.name,
        appName: 'AfroGoods',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
      },
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
      template: 'passwordreset',
      data: {
        token: dto.token,
        name: dto.name,
        resetUrl: dto.token,
        expiryMinutes: 60,
        appName: 'AfroGoods',
      },
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
      subject: `Order Confirmation - ${dto.orderId}`,
      template: 'order-confirmation',
      data: { orderId: dto.orderId, ...dto.orderDetails },
    };

    return this.sendEmail(emailJob, 2);
  }

  /**
   * Send order status update email
   */
  async sendOrderStatusUpdateEmail(dto: SendOrderStatusUpdateEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: `Order ${dto.orderId} Status Update`,
      template: 'order-status-update',
      data: { orderId: dto.orderId, ...dto.statusData },
    };

    return this.sendEmail(emailJob, 3); // Medium-high priority
  }

  /**
   * Send admin communication email
   */
  async sendAdminCommunicationEmail(dto: SendAdminCommunicationEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: dto.subject,
      template: dto.template,
      data: dto.data,
    };

    return this.sendEmail(emailJob, 1); // Highest priority for admin communications
  }

  /**
   * Send order cancellation confirmation email
   */
  async sendCancellationConfirmationEmail(
    dto: SendCancellationConfirmationEmailDto,
  ) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: `Order Cancellation Confirmation - ${dto.orderId}`,
      template: 'order-cancellation-confirmation',
      data: {
        orderId: dto.orderId,
        ...dto.cancellationData,
        hasRefund: dto.cancellationData.refundAmount > 0,
      },
    };

    return this.sendEmail(emailJob, 2); // High priority for cancellation confirmations
  }

  /**
   * Send shipping notification email
   */
  async sendShippingNotificationEmail(dto: SendShippingNotificationEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: `Your Order ${dto.orderId} Has Shipped`,
      template: 'shipping-notification',
      data: { orderId: dto.orderId, ...dto.shippingData },
    };

    return this.sendEmail(emailJob, 3); // Medium-high priority
  }
}

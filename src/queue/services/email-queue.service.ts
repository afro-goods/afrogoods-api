import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  EmailJobDto,
  SendWelcomeEmailDto,
  SendPasswordResetEmailDto,
  SendVerificationEmailDto,
  SendOrderConfirmationEmailDto,
  SendAdvertSubmittedEmailDto,
  SendAdvertReviewedEmailDto,
} from '../dto/email-job.dto';
import {
  SendOrderStatusUpdateEmailDto,
  SendAdminCommunicationEmailDto,
  SendCancellationConfirmationEmailDto,
} from '../dto/order-email-job.dto';

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
      template: 'orderconfirmation',
      data: {
        customerName: dto.orderDetails.customerName,
        orderId: dto.orderId,
        orderDate: new Date(),
        total: dto.orderDetails.totalAmount,
        currency: 'USD',
        itemCount: dto.orderDetails.itemCount,
        items: dto.orderDetails.items || [],
        subtotal: dto.orderDetails.totalAmount,
        shippingCost: dto.orderDetails.shippingCost || 0,
        shippingAddress: dto.orderDetails.shippingAddress || {},
        paymentMethod: dto.orderDetails.paymentMethod || 'Credit Card',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
        ...dto.orderDetails,
      },
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
      template: 'orderstatusupdate',
      data: {
        orderId: dto.orderId,
        customerName: dto.statusData.customerName,
        previousStatus: dto.statusData.previousStatus,
        newStatus: dto.statusData.newStatus,
        updateDate: new Date(),
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
        ...dto.statusData,
      },
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
      template: 'ordercancellation',
      data: {
        customerName: dto.cancellationData.customerName,
        orderId: dto.orderId,
        orderDate: new Date(),
        cancellationDate: new Date(),
        orderTotal: dto.cancellationData.orderTotal,
        currency: 'USD',
        cancellationReason: dto.cancellationData.cancellationReason,
        items: dto.cancellationData.items || [],
        hasRefund: dto.cancellationData.refundAmount > 0,
        refundAmount: dto.cancellationData.refundAmount,
        refundMethod:
          dto.cancellationData.refundMethod || 'Original Payment Method',
        refundTimeline: dto.cancellationData.refundTimeline,
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
        supportEmail: 'support@afrogoods.com',
      },
    };

    return this.sendEmail(emailJob, 2); // High priority for cancellation confirmations
  }

  /**
   * Send email when a user submits an advert (confirmation)
   */
  async sendAdvertSubmittedEmail(dto: SendAdvertSubmittedEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject: `Your advert has been submitted – ${dto.advertTitle}`,
      template: 'advertsubmitted',
      data: {
        customerName: dto.customerName,
        customerEmail: dto.email,
        advertTitle: dto.advertTitle,
        advertType: dto.advertType,
        submittedAt: new Date(),
        appName: 'AfroGoods',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
      },
    };

    return this.sendEmail(emailJob, 4);
  }

  /**
   * Send email when an advert has been reviewed (approved or rejected)
   */
  async sendAdvertReviewedEmail(dto: SendAdvertReviewedEmailDto) {
    const emailJob: EmailJobDto = {
      to: dto.email,
      subject:
        dto.status === 'approved'
          ? `Your advert has been approved – ${dto.advertTitle}`
          : `Advert review update – ${dto.advertTitle}`,
      template: 'advertreviewed',
      data: {
        customerName: dto.customerName,
        customerEmail: dto.email,
        advertTitle: dto.advertTitle,
        status: dto.status,
        rejectionReason: dto.rejectionReason,
        reviewedAt: new Date(),
        appName: 'AfroGoods',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
      },
    };

    return this.sendEmail(emailJob, 3);
  }
}

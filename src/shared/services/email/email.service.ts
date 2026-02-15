import { Injectable, Logger } from '@nestjs/common';
import { ResendProvider } from './resend.provider';
import { EmailTemplateService } from './services/email-template.service';
import {
  SendWelcomeEmailDto,
  SendPasswordResetEmailDto,
  SendOrderConfirmationEmailDto,
  SendOrderStatusUpdateEmailDto,
  SendCancellationConfirmationEmailDto,
  SendAdvertSubmittedEmailDto,
  SendAdvertReviewedEmailDto,
} from './dto/email.dto';
import {
  EmailResult,
  AdminOrderNotificationParams,
} from './interfaces/email.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly resendProvider: ResendProvider,
    private readonly templateService: EmailTemplateService,
  ) {}

  /**
   * Private helper method to send email with error handling
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param templateName - Name of the template to use
   * @param data - Data to pass to the template
   * @returns EmailResult with success status
   */
  private async sendEmail(
    to: string,
    subject: string,
    templateName: string,
    data: Record<string, any>,
  ): Promise<EmailResult> {
    try {
      this.logger.log(`Attempting to send email: ${templateName} to ${to}`);

      // Render the email template
      const html = this.templateService.render(templateName, data);

      // Send via Resend provider
      await this.resendProvider.send({
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent successfully to ${to}: ${subject}`);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email to ${to} (${templateName}): ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send welcome email to new user
   * @param dto - Welcome email data
   * @returns EmailResult
   */
  async sendWelcomeEmail(dto: SendWelcomeEmailDto): Promise<EmailResult> {
    return this.sendEmail(dto.email, 'Welcome to AfroGoods!', 'welcomeemail', {
      name: dto.name,
      appName: 'AfroGoods',
      appUrl: process.env.APP_URL || 'https://afrogoods.com',
    });
  }

  /**
   * Send password reset email
   * @param dto - Password reset email data
   * @returns EmailResult
   */
  async sendPasswordResetEmail(
    dto: SendPasswordResetEmailDto,
  ): Promise<EmailResult> {
    // The token is already a complete Firebase password reset URL from generatePasswordResetLink()
    // No need to construct a new URL - use it directly
    const resetUrl = dto.token;

    return this.sendEmail(
      dto.email,
      'Reset Your Password - AfroGoods',
      'passwordreset',
      {
        name: dto.name,
        email: dto.email,
        resetUrl,
        expiryMinutes: dto.expiryMinutes || 60,
        appName: 'AfroGoods',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
      },
    );
  }

  /**
   * Send order confirmation email
   * @param dto - Order confirmation email data
   * @returns EmailResult
   */
  async sendOrderConfirmationEmail(
    dto: SendOrderConfirmationEmailDto,
  ): Promise<EmailResult> {
    // Check if this is a payment confirmation (special instructions contains "Payment Confirmed")
    const isPaymentConfirmed =
      dto.orderDetails.specialInstructions?.includes('Payment Confirmed');
    const subject = isPaymentConfirmed
      ? `Order Confirmation - Payment Confirmed - ${dto.orderId}`
      : `Order Received - ${dto.orderId}`;

    return this.sendEmail(dto.email, subject, 'orderconfirmation', {
      orderId: dto.orderId,
      customerName: dto.orderDetails.customerName,
      orderDate: dto.orderDetails.orderDate || new Date(),
      total: dto.orderDetails.total || dto.orderDetails.totalAmount,
      currency: dto.orderDetails.currency || 'CAD',
      itemCount: dto.orderDetails.itemCount,
      items: dto.orderDetails.items,
      subtotal: dto.orderDetails.subtotal || dto.orderDetails.totalAmount,
      discount: dto.orderDetails.discount || 0,
      discountCode: dto.orderDetails.discountCode,
      shippingCost: dto.orderDetails.shippingCost,
      tax: dto.orderDetails.tax || 0,
      shippingAddress: dto.orderDetails.shippingAddress,
      paymentMethod: dto.orderDetails.paymentMethod,
      paymentDetails: dto.orderDetails.paymentDetails,
      estimatedDelivery:
        dto.orderDetails.estimatedDelivery || '5-7 business days',
      specialInstructions: dto.orderDetails.specialInstructions,
      appName: 'AfroGoods',
      appUrl: process.env.APP_URL || 'https://afrogoods.com',
    });
  }

  /**
   * Send order status update email
   * @param dto - Order status update email data
   * @returns EmailResult
   */
  async sendOrderStatusUpdateEmail(
    dto: SendOrderStatusUpdateEmailDto,
  ): Promise<EmailResult> {
    return this.sendEmail(
      dto.email,
      `Order Status Update - ${dto.orderId}`,
      'orderstatusupdate',
      {
        orderId: dto.orderId,
        customerName: dto.statusData.customerName,
        previousStatus: dto.statusData.previousStatus,
        newStatus: dto.statusData.newStatus,
        updateDate: dto.statusData.updateDate || new Date(),
        estimatedDelivery: dto.statusData.estimatedDelivery,
        trackingNumber: dto.statusData.trackingNumber,
        carrier: dto.statusData.carrier,
        trackingUrl: dto.statusData.trackingUrl,
        deliveryDate: dto.statusData.deliveryDate,
        refundInfo: dto.statusData.refundInfo,
        adminMessage: dto.statusData.adminMessage,
        fulfillmentLabel: dto.statusData.fulfillmentLabel,
        appName: 'AfroGoods',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
      },
    );
  }

  /**
   * Send order cancellation confirmation email
   * @param dto - Order cancellation email data
   * @returns EmailResult
   */
  async sendCancellationConfirmationEmail(
    dto: SendCancellationConfirmationEmailDto,
  ): Promise<EmailResult> {
    return this.sendEmail(
      dto.email,
      `Order Cancellation Confirmation - ${dto.orderId}`,
      'ordercancellation',
      {
        orderId: dto.orderId,
        customerName: dto.cancellationData.customerName,
        orderTotal: dto.cancellationData.orderTotal,
        cancellationReason: dto.cancellationData.cancellationReason,
        items: dto.cancellationData.items || [],
        refundAmount: dto.cancellationData.refundAmount,
        refundMethod:
          dto.cancellationData.refundMethod || 'Original payment method',
        refundTimeline: dto.cancellationData.refundTimeline,
        appName: 'AfroGoods',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
      },
    );
  }

  /**
   * Send admin order notification email
   * @param params - Admin notification parameters
   * @returns EmailResult
   */
  async sendAdminOrderNotification(
    params: AdminOrderNotificationParams,
  ): Promise<EmailResult> {
    return this.sendEmail(
      params.adminEmail,
      `New Order Received - ${params.orderId}`,
      'adminordernotification',
      {
        orderId: params.orderId,
        totalAmount: params.totalAmount,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        appName: 'AfroGoods',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
        adminDashboardUrl:
          process.env.ADMIN_DASHBOARD_URL || 'https://admin.afrogoods.com',
      },
    );
  }

  /**
   * Send email when an advert has been submitted for review
   * @param dto - Advert submission email data
   * @returns EmailResult
   */
  async sendAdvertSubmittedEmail(
    dto: SendAdvertSubmittedEmailDto,
  ): Promise<EmailResult> {
    return this.sendEmail(
      dto.email,
      `Your advert has been submitted – ${dto.advertTitle}`,
      'advertsubmitted',
      {
        customerName: dto.customerName,
        customerEmail: dto.email,
        advertTitle: dto.advertTitle,
        advertType: dto.advertType,
        submittedAt: new Date(),
        appName: 'AfroGoods',
        appUrl: process.env.APP_URL || 'https://afrogoods.com',
      },
    );
  }

  /**
   * Send email when an advert has been reviewed (approved or rejected)
   * @param dto - Advert review email data
   * @returns EmailResult
   */
  async sendAdvertReviewedEmail(
    dto: SendAdvertReviewedEmailDto,
  ): Promise<EmailResult> {
    const subject =
      dto.status === 'approved'
        ? `Your advert has been approved – ${dto.advertTitle}`
        : `Advert review update – ${dto.advertTitle}`;

    return this.sendEmail(dto.email, subject, 'advertreviewed', {
      customerName: dto.customerName,
      customerEmail: dto.email,
      advertTitle: dto.advertTitle,
      status: dto.status,
      rejectionReason: dto.rejectionReason,
      reviewedAt: new Date(),
      appName: 'AfroGoods',
      appUrl: process.env.APP_URL || 'https://afrogoods.com',
    });
  }
}

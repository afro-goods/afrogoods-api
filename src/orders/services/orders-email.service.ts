import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../shared/services/email/email.service';
import {
  SendOrderStatusUpdateEmailDto,
  SendOrderConfirmationEmailDto,
  SendCancellationConfirmationEmailDto,
} from '../../shared/services/email/dto/email.dto';

@Injectable()
export class OrdersEmailService {
  private readonly logger = new Logger(OrdersEmailService.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(
    email: string,
    orderId: string,
    orderDetails: Record<string, any>,
  ): Promise<void> {
    this.logger.log(
      `Sending order confirmation email for ${email}, order: ${orderId}`,
    );

    const dto: SendOrderConfirmationEmailDto = {
      email,
      orderId,
      orderDetails,
    };

    try {
      await this.emailService.sendOrderConfirmationEmail(dto);
    } catch (error) {
      this.logger.error(
        `Failed to send order confirmation email: ${error.message}`,
      );
      // Don't throw - email failures shouldn't block operations
    }
  }

  /**
   * Send order status update email
   */
  async sendOrderStatusUpdateEmail(
    email: string,
    orderId: string,
    statusData: Record<string, any>,
  ): Promise<void> {
    this.logger.log(
      `Sending status update email for ${email}, order: ${orderId}`,
    );

    const dto: SendOrderStatusUpdateEmailDto = {
      email,
      orderId,
      statusData,
    };

    try {
      await this.emailService.sendOrderStatusUpdateEmail(dto);
    } catch (error) {
      this.logger.error(
        `Failed to send order status update email: ${error.message}`,
      );
      // Don't throw - email failures shouldn't block operations
    }
  }

  /**
   * Send order cancellation confirmation email
   */
  async sendCancellationConfirmationEmail(
    email: string,
    orderId: string,
    cancellationData: {
      customerName: string;
      refundAmount: number;
      refundTimeline: string;
      cancellationReason: string;
      orderTotal: number;
    },
  ): Promise<void> {
    this.logger.log(
      `Sending cancellation confirmation email for ${email}, order: ${orderId}`,
    );

    const dto: SendCancellationConfirmationEmailDto = {
      email,
      orderId,
      cancellationData,
    };

    try {
      await this.emailService.sendCancellationConfirmationEmail(dto);
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation confirmation email: ${error.message}`,
      );
      // Don't throw - email failures shouldn't block operations
    }
  }

  /**
   * Send admin order notification
   */
  async sendAdminOrderNotification(
    adminEmail: string,
    orderId: string,
    totalAmount: number,
    customerName: string,
    customerEmail: string,
  ): Promise<void> {
    this.logger.log(`Sending admin order notification for order: ${orderId}`);

    try {
      await this.emailService.sendAdminOrderNotification({
        adminEmail,
        orderId,
        totalAmount,
        customerName,
        customerEmail,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send admin order notification: ${error.message}`,
      );
      // Don't throw - email failures shouldn't block operations
    }
  }
}

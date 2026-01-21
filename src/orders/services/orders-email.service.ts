import { Injectable, Logger } from '@nestjs/common';
import { EmailQueueService } from '../../queue/services/email-queue.service';
import {
  SendOrderStatusUpdateEmailDto,
  SendAdminCommunicationEmailDto,
  SendCancellationConfirmationEmailDto,
  SendShippingNotificationEmailDto,
} from '../../queue/dto/order-email-job.dto';
import { SendOrderConfirmationEmailDto } from '../../queue/dto/email-job.dto';

@Injectable()
export class OrdersEmailService {
  private readonly logger = new Logger(OrdersEmailService.name);

  constructor(private readonly emailQueueService: EmailQueueService) {}

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(
    email: string,
    orderId: string,
    orderDetails: Record<string, any>,
  ): Promise<void> {
    this.logger.log(
      `Queuing order confirmation email for ${email}, order: ${orderId}`,
    );

    const dto: SendOrderConfirmationEmailDto = {
      email,
      orderId,
      orderDetails,
    };

    await this.emailQueueService.sendOrderConfirmationEmail(dto);
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
      `Queuing status update email for ${email}, order: ${orderId}`,
    );

    const dto: SendOrderStatusUpdateEmailDto = {
      email,
      orderId,
      statusData,
    };

    await this.emailQueueService.sendOrderStatusUpdateEmail(dto);
  }

  /**
   * Send admin communication email
   */
  async sendAdminCommunicationEmail(
    email: string,
    subject: string,
    template: string,
    data: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Queuing admin communication email for ${email}`);

    const dto: SendAdminCommunicationEmailDto = {
      email,
      subject,
      template,
      data,
    };

    await this.emailQueueService.sendAdminCommunicationEmail(dto);
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
      `Queuing cancellation confirmation email for ${email}, order: ${orderId}`,
    );

    const dto: SendCancellationConfirmationEmailDto = {
      email,
      orderId,
      cancellationData,
    };

    await this.emailQueueService.sendCancellationConfirmationEmail(dto);
  }

  /**
   * Send shipping notification email
   */
  async sendShippingNotificationEmail(
    email: string,
    orderId: string,
    shippingData: {
      customerName: string;
      trackingNumber?: string;
      estimatedDelivery?: string;
      carrierInfo?: {
        name: string;
        trackingUrl?: string;
      };
    },
  ): Promise<void> {
    this.logger.log(
      `Queuing shipping notification email for ${email}, order: ${orderId}`,
    );

    const dto: SendShippingNotificationEmailDto = {
      email,
      orderId,
      shippingData,
    };

    await this.emailQueueService.sendShippingNotificationEmail(dto);
  }
}

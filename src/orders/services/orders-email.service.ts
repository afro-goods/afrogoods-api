import { Injectable, Logger } from '@nestjs/common';
import { EmailQueueService } from '../../queue/services/email-queue.service';
import {
  SendOrderStatusUpdateEmailDto,
  SendAdminCommunicationEmailDto,
  SendCancellationConfirmationEmailDto,
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
   * Send admin order notification
   */
  async sendAdminOrderNotification(
    adminEmail: string,
    orderId: string,
    totalAmount: number,
    customerName: string,
    customerEmail: string,
  ): Promise<void> {
    this.logger.log(`Queuing admin order notification for order: ${orderId}`);

    await this.emailQueueService.sendAdminOrderNotification(
      adminEmail,
      orderId,
      totalAmount,
      customerName,
      customerEmail,
    );
  }
}

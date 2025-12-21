import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ProcessPaymentDto,
  RefundPaymentDto,
  VerifyPaymentDto,
  Currency,
} from '../dto/payment-job.dto';

@Injectable()
export class PaymentQueueService {
  private readonly logger = new Logger(PaymentQueueService.name);

  constructor(@InjectQueue('payment') private paymentQueue: Queue) {}

  /**
   * Process a payment
   */
  async processPayment(dto: ProcessPaymentDto) {
    this.logger.log(`Adding payment job to queue: Order ${dto.orderId}`);

    const jobData = {
      ...dto,
      currency: dto.currency || Currency.USD,
    };

    return this.paymentQueue.add('process-payment', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  /**
   * Process a refund (high priority)
   */
  async refundPayment(dto: RefundPaymentDto) {
    this.logger.log(`Adding refund job to queue: Order ${dto.orderId}`);

    return this.paymentQueue.add('refund-payment', dto, {
      priority: 1, // High priority
      attempts: 3,
    });
  }

  /**
   * Verify payment status
   */
  async verifyPayment(dto: VerifyPaymentDto) {
    this.logger.log(`Adding payment verification job: Order ${dto.orderId}`);

    return this.paymentQueue.add('verify-payment', dto, {
      priority: 2,
    });
  }
}

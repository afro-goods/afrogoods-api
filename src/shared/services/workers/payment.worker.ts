import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('payment')
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  async process(job: Job<any, any, string>): Promise<void> {
    this.logger.log(`Processing payment job ${job.id}`);

    try {
      // const { orderId, amount, userId, paymentMethod } = job.data;

      // Your real payment processing (Stripe, PayPal, etc.)
      // await this.processPayment(orderId, amount, userId, paymentMethod);

      await job.log('Payment processed successfully');
      // this.logger.log(`Payment successful for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Payment failed: ${error}`);
      throw error; // Triggers retry
    }
  }

  //   private async processPayment(
  //     orderId: string,
  //     amount: number,
  //     userId: string,
  //     method: string,
  //   ) {
  //     console.log('Processing payment:', { orderId, amount, userId, method });
  //     // await paymentGateway.charge(...)
  //   }
}

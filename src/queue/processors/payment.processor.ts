import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';

@Injectable()
@Processor('payment')
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  /**
   * This method is called automatically when a job is added to the 'payment' queue
   */
  async process(job: Job<any, any, string>): Promise<void> {
    this.logger.log(`Processing payment job ${job.id} - Type: ${job.name}`);

    try {
      // Handle different job types
      switch (job.name) {
        case 'process-payment':
          await this.handleProcessPayment(job);
          break;
        case 'refund-payment':
          await this.handleRefund(job);
          break;
        case 'verify-payment':
          await this.handleVerifyPayment(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      await job.log('Payment job completed successfully');
    } catch (error) {
      this.logger.error(`Payment job failed: ${error.message}`);
      throw error; // Triggers retry
    }
  }

  /**
   * Process payment
   */
  private async handleProcessPayment(job: Job) {
    const { orderId, amount, userId, paymentMethod } = job.data;

    this.logger.log(`Processing payment: Order ${orderId}, Amount: ${amount}`);

    // TODO: Replace with your actual payment service (Stripe, PayPal, etc.)
    // const paymentResult = await this.stripeService.charge({
    //   amount,
    //   currency: 'usd',
    //   paymentMethod,
    //   metadata: { orderId, userId },
    // });

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update order status
    // await this.orderService.updatePaymentStatus(orderId, 'paid');

    this.logger.log(`Payment successful for order ${orderId}`);
  }

  /**
   * Process refund
   */
  private async handleRefund(job: Job) {
    const { orderId, amount } = job.data;

    this.logger.log(`Processing refund: Order ${orderId}, Amount: ${amount}`);

    // TODO: Replace with your actual refund logic
    // const refundResult = await this.stripeService.refund({
    //   orderId,
    //   amount,
    //   reason,
    // });

    // Simulate refund processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Update order status
    // await this.orderService.updatePaymentStatus(orderId, 'refunded');

    this.logger.log(`Refund successful for order ${orderId}`);
  }

  /**
   * Verify payment status
   */
  private async handleVerifyPayment(job: Job) {
    const { orderId } = job.data;

    this.logger.log(`Verifying payment for order ${orderId}`);

    // TODO: Check payment status with provider
    // const status = await this.stripeService.getPaymentStatus(orderId);

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.verbose(`Payment job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(` Payment job ${job.id} failed: ${err.message}`);

    // Notify user about payment failure
    // await this.emailQueueService.sendPaymentFailedEmail(job.data.userId);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(` Payment job ${job.id} is processing`);
  }
}

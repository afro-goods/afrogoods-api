import { Controller, Post, Body } from '@nestjs/common';
import { EmailQueueService } from '../queue/services/email-queue.service';
import {
  SendWelcomeEmailDto,
  SendPasswordResetEmailDto,
  SendVerificationEmailDto,
  SendOrderConfirmationEmailDto,
} from '../queue/dto/email-job.dto';
import {
  SendOrderStatusUpdateEmailDto,
  SendAdminCommunicationEmailDto,
  SendCancellationConfirmationEmailDto,
  SendShippingNotificationEmailDto,
} from '../queue/dto/order-email-job.dto';

@Controller('test-email')
export class TestEmailController {
  constructor(private readonly emailQueueService: EmailQueueService) {}

  @Post('welcome')
  async testWelcome(@Body() dto: SendWelcomeEmailDto) {
    await this.emailQueueService.sendWelcomeEmail(dto);
    return { message: 'Welcome email job added to queue!' };
  }

  @Post('password-reset')
  async testPasswordReset(@Body() dto: SendPasswordResetEmailDto) {
    await this.emailQueueService.sendPasswordResetEmail(dto);
    return { message: 'Password reset email job added to queue!' };
  }

  @Post('verify')
  async testVerify(@Body() dto: SendVerificationEmailDto) {
    await this.emailQueueService.sendVerificationEmail(dto);
    return { message: 'Verification email job added to queue!' };
  }

  @Post('order-confirmation')
  async testOrderConfirmation(@Body() dto: SendOrderConfirmationEmailDto) {
    await this.emailQueueService.sendOrderConfirmationEmail(dto);
    return { message: 'Order confirmation email job added to queue!' };
  }

  @Post('order-status')
  async testOrderStatus(@Body() dto: SendOrderStatusUpdateEmailDto) {
    await this.emailQueueService.sendOrderStatusUpdateEmail(dto);
    return { message: 'Order status email job added to queue!' };
  }

  @Post('admin')
  async testAdmin(@Body() dto: SendAdminCommunicationEmailDto) {
    await this.emailQueueService.sendAdminCommunicationEmail(dto);
    return { message: 'Admin email job added to queue!' };
  }

  @Post('cancellation')
  async testCancellation(@Body() dto: SendCancellationConfirmationEmailDto) {
    await this.emailQueueService.sendCancellationConfirmationEmail(dto);
    return { message: 'Cancellation email job added to queue!' };
  }

  @Post('shipping')
  async testShipping(@Body() dto: SendShippingNotificationEmailDto) {
    await this.emailQueueService.sendShippingNotificationEmail(dto);
    return { message: 'Shipping notification email job added to queue!' };
  }
}
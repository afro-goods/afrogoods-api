import { Module, Logger } from '@nestjs/common';
import { MediaService } from './services/media/services/media.service';
import { MediaProvider } from './services/media/constants/media.constant';
import { PaginationService } from './services/pagination/services/pagination.service';
import { EncryptionService } from './services/encryption/encryption.service';
import { ResendProvider } from './services/email/resend.provider';
import { EmailService } from './services/email/email.service';
import { EmailTemplateService } from './services/email/services/email-template.service';
import { StripeService } from './services/stripe/stripe.service';

@Module({
  providers: [
    MediaProvider,
    MediaService,
    PaginationService,
    EncryptionService,
    Logger,
    ResendProvider,
    EmailTemplateService,
    EmailService,
    StripeService,
  ],
  exports: [
    MediaService,
    PaginationService,
    EncryptionService,
    EmailService,
    StripeService,
  ],
})
export class SharedModule {}

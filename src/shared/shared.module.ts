import { Module, Logger } from '@nestjs/common';
import { MediaService } from './services/media/services/media.service';
import { MediaProvider } from './services/media/constants/media.constant';
import { PaginationService } from './services/pagination/services/pagination.service';
import { EncryptionService } from './services/encryption/encryption.service';
// import { CacheService } from './services/cache/cache.service'; // Temporarily commented out - will be removed in Phase 4
import { ResendProvider } from './services/email/resend.provider';
import { EmailService } from './services/email/email.service';
import { EmailTemplateService } from './services/email/services/email-template.service';

@Module({
  providers: [
    MediaProvider,
    MediaService,
    PaginationService,
    EncryptionService,
    Logger,
    // CacheService, // Temporarily commented out - will be removed in Phase 4
    ResendProvider,
    EmailTemplateService,
    EmailService,
  ],
  exports: [MediaService, PaginationService, EncryptionService, /* CacheService, */ EmailService],
})
export class SharedModule {}

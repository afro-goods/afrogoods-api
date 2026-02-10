import { Module, Logger } from '@nestjs/common';
import { MediaService } from './services/media/services/media.service';
import { MediaProvider } from './services/media/constants/media.constant';
import { RedisProvider } from './services/storage/providers/redis.provider';
import { PaginationService } from './services/pagination/services/pagination.service';
import { CacheService } from './services/cache/cache.service';

@Module({
  providers: [
    MediaProvider,
    MediaService,
    PaginationService,
    Logger,
    RedisProvider,
    CacheService,
  ],
  exports: [MediaService, PaginationService, CacheService],
})
export class SharedModule {}

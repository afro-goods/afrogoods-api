import { Module, Logger } from '@nestjs/common';
import { MediaService } from './services/media/services/media.service';
import { MediaProvider } from './services/media/constants/media.constant';
// import { RedisService } from './services/storage/services/redis.service';
// import { RedisProvider } from './services/storage/providers/redis.provider';
import { PaginationService } from './services/pagination/services/pagination.service';

@Module({
  providers: [MediaProvider, MediaService, PaginationService, Logger],
  exports: [MediaService, PaginationService],
})
export class SharedModule {}

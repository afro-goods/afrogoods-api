import { Module } from '@nestjs/common';
import { TestEmailController } from './test-email.controller';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [TestEmailController],
})
export class TestEmailModule {}

// import { Global, Module } from '@nestjs/common';
// import { BullModule } from '@nestjs/bullmq';
// import { REDIS_CLIENT } from 'src/shared/services/storage/providers/redis.provider';
// import { SharedModule } from 'src/shared/shared.module';
// import { RedisProvider } from 'src/shared/services/storage/providers/redis.provider';
// import type { Redis } from 'ioredis';
// import { EmailProcessor } from './processors/email.processor';
// import { PaymentProcessor } from './processors/payment.processor';
// import { EmailQueueService } from './services/email-queue.service';
// import { PaymentQueueService } from './services/payment-queue.service';

// @Global()
// @Module({
//   imports: [
//     BullModule.forRootAsync({
//       useFactory: (redisClient: Redis) => {
//         return {
//           connection: redisClient,
//           defaultJobOptions: {
//             removeOnComplete: 100,
//             removeOnFail: 500,
//             attempts: 5,
//             backoff: {
//               type: 'exponential',
//               delay: 3000,
//             },
//           },
//         };
//       },
//       inject: [REDIS_CLIENT],
//     }),
//     BullModule.registerQueue({ name: 'email' }, { name: 'payment' }),
//   ],
//   providers: [
//     EmailProcessor,
//     PaymentProcessor,
//     EmailQueueService,
//     PaymentQueueService,
//     RedisProvider,
//   ],
//   exports: [EmailQueueService, PaymentQueueService, REDIS_CLIENT],
// })
// export class QueueModule {}

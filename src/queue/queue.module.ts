// import { Global, Module } from '@nestjs/common';
// import { BullModule } from '@nestjs/bullmq';
// import { REDIS_CLIENT } from 'src/shared/services/storage/providers/redis.provider';

// @Global()
// @Module({
//   imports: [
//     BullModule.forRoot({
//       connection: {
//         inject: [REDIS_CLIENT],
//         useFactory: (redisClient: any) => redisClient,
//       },
//       defaultJobOptions: {
//         removeOnComplete: 100,
//         removeOnFail: 500,
//         attempts: 5,
//         backoff: {
//           type: 'exponential',
//           delay: 3000,
//         },
//       },
//     }),
//     BullModule.registerQueue(
//       { name: 'email' },
//       { name: 'payment' },
//       // Add more queues here as needed
//     ),
//   ],
//   exports: [BullModule],
// })
// export class QueueModule {}

import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REDIS_CLIENT } from 'src/shared/services/storage/providers/redis.provider';
import type { Redis } from 'ioredis';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (redisClient: Redis) => {
        return {
          connection: redisClient,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 3000,
            },
          },
        };
      },
      inject: [REDIS_CLIENT],
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'payment' },
      // Add more queues here as needed
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}

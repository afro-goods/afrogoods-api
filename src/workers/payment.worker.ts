import { Worker, Job } from 'bullmq';
import { config } from '../config';

new Worker(
  'payment',
  async (job: Job) => {
    await job.log(`Processing payment: ${JSON.stringify(job.data)}`);
    // Your actual payment processing logic here
    console.log('Processing payment:', job.data);
  },
  {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
    },
  },
);

import { Worker, Job } from 'bullmq';
import { config } from '../config';

new Worker(
  'email',
  async (job: Job) => {
    await job.log(`Sending email: ${JSON.stringify(job.data)}`);
    // Your actual email sending logic here
    console.log('Sending email:', job.data);
  },
  {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
    },
  },
);

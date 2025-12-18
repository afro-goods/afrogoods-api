import { Queue } from 'bullmq';
import { config } from '../config';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

export const emailQueue = new Queue('email', { connection });
export const paymentQueue = new Queue('payment', { connection });

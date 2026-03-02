import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { type Response } from 'express';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  check(@Res() res: Response) {
    const dbStatus =
      this.connection.readyState === ConnectionStates.connected
        ? 'connected'
        : 'disconnected';
    const isHealthy = dbStatus === 'connected';

    const healthInfo = {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
    };

    if (isHealthy) {
      return res.status(HttpStatus.OK).json(healthInfo);
    } else {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(healthInfo);
    }
  }
}

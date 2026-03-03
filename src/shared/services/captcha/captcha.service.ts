import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { config } from '../../../config';

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly verifyUrl =
    'https://www.google.com/recaptcha/api/siteverify';

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    const secretKey = config.recaptcha.secretKey;

    // Handle development mode (skip verification if not configured)
    if (!secretKey) {
      if (config.env.isProd) {
        this.logger.error('RECAPTCHA_SECRET_KEY is missing in production!');
        return false;
      }
      this.logger.warn(
        'RECAPTCHA_SECRET_KEY is missing. Skipping CAPTCHA verification in development.',
      );
      return true;
    }

    try {
      const response = await axios.post(this.verifyUrl, null, {
        params: {
          secret: secretKey,
          response: token,
          remoteip: remoteIp,
        },
      });

      const { success, 'error-codes': errorCodes } = response.data;

      if (!success) {
        this.logger.warn(
          `CAPTCHA verification failed: ${errorCodes || 'invalid token'}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CAPTCHA verification error:', error.message);
      // In case of network error, we might want to fail-closed (return false)
      // or fail-open depending on the requirement.
      // Requirement 6.3 (from tasks.md) mentions network error handling.
      return false;
    }
  }
}

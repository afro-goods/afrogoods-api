import { Test, TestingModule } from '@nestjs/testing';
import { CaptchaService } from './captcha.service';
import axios from 'axios';
import { config } from '../../../config';

jest.mock('axios');
jest.mock('../../../config', () => ({
  config: {
    recaptcha: {
      secretKey: 'test-secret-key',
    },
    env: {
      isProd: false,
      isDev: true,
    },
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CaptchaService', () => {
  let service: CaptchaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaptchaService],
    }).compile();

    service = module.get<CaptchaService>(CaptchaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verify', () => {
    const token = 'test-token';
    const remoteIp = '127.0.0.1';

    it('should return true when CAPTCHA verification is successful', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
        },
      });

      const result = await service.verify(token, remoteIp);

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: 'test-secret-key',
            response: token,
            remoteip: remoteIp,
          },
        },
      );
    });

    it('should return false when CAPTCHA verification fails', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: false,
          'error-codes': ['invalid-input-response'],
        },
      });

      const result = await service.verify(token);

      expect(result).toBe(false);
    });

    it('should return false when there is a network error', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network Error'));

      const result = await service.verify(token);

      expect(result).toBe(false);
    });

    it('should return true in development when secret key is missing', async () => {
      // Temporarily change config for this test
      (config.recaptcha as any).secretKey = undefined;
      (config.env as any).isProd = false;

      const result = await service.verify(token);

      expect(result).toBe(true);
      expect(mockedAxios.post).not.toHaveBeenCalled();

      // Restore config
      (config.recaptcha as any).secretKey = 'test-secret-key';
    });

    it('should return false in production when secret key is missing', async () => {
      // Temporarily change config for this test
      (config.recaptcha as any).secretKey = undefined;
      (config.env as any).isProd = true;

      const result = await service.verify(token);

      expect(result).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();

      // Restore config
      (config.recaptcha as any).secretKey = 'test-secret-key';
    });
  });
});

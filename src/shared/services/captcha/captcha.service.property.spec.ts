import * as fc from 'fast-check';
import axios from 'axios';
import { CaptchaService } from './captcha.service';
import { config } from '../../../config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

jest.mock('axios');
jest.mock('../../../config', () => ({
  config: {
    recaptcha: {
      secretKey: 'test-secret-key',
    },
    env: {
      isProd: true, // Force production mode to ensure verification is called
      isDev: false,
    },
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CaptchaService Property Tests', () => {
  let service: CaptchaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaptchaService],
    }).compile();

    service = module.get<CaptchaService>(CaptchaService);
    jest.clearAllMocks();
  });

  // Property 9: CAPTCHA verification is called
  // This test ensures that for any valid string input, the service attempts to call the Google API
  it('Property 9: should always call Google API for any string token and IP', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // token
        fc.option(fc.ipV4()), // optional remoteIp
        async (token, remoteIp) => {
          jest.clearAllMocks();
          mockedAxios.post.mockResolvedValue({ data: { success: true } });

          await service.verify(token, remoteIp || undefined);

          expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://www.google.com/recaptcha/api/siteverify',
            null,
            {
              params: {
                secret: 'test-secret-key',
                response: token,
                remoteip: remoteIp || undefined,
              },
            },
          );
        },
      ),
    );
  });
});

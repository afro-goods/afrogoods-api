import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens = 100;
  private readonly refillRate = 100; // tokens per minute
  private lastRefill: number;

  constructor() {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    this.refill();
    
    if (this.tokens < 1) {
      const waitTime = (60 * 1000) / this.refillRate;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForToken();
    }
    
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refillAmount = (elapsed * this.refillRate) / (60 * 1000);
    
    this.tokens = Math.min(this.maxTokens, this.tokens + refillAmount);
    this.lastRefill = now;
  }
}

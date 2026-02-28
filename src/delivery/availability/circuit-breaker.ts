import { Injectable, Logger } from '@nestjs/common';

enum CircuitBreakerState {
  CLOSED,
  OPEN,
  HALF_OPEN
}

@Injectable()
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private readonly threshold = 5;
  private readonly cooldownPeriod = 5 * 60 * 1000; // 5 minutes
  private lastFailureTime: number;

  isOpen(): boolean {
    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.cooldownPeriod) {
        this.state = CircuitBreakerState.HALF_OPEN;
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.logger.error(`Circuit breaker opened after ${this.failures} failures.`);
      this.state = CircuitBreakerState.OPEN;
    }
  }
}

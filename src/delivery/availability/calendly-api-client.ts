import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RateLimiter } from './rate-limiter';
import { CircuitBreaker } from './circuit-breaker';

export interface CalendlyAvailabilitySlot {
  start_time: string;
  status: string;
}

export interface CalendlyAvailabilityResponse {
  collection: CalendlyAvailabilitySlot[];
}

interface CalendlyUserMeResponse {
  resource: { uri: string };
}

interface CalendlyEventTypeItem {
  uri: string;
  scheduling_url?: string;
}

interface CalendlyEventTypesResponse {
  collection: CalendlyEventTypeItem[];
}

@Injectable()
export class CalendlyApiClient {
  private readonly logger = new Logger(CalendlyApiClient.name);
  private readonly baseUrl = 'https://api.calendly.com';

  constructor(
    private readonly httpService: HttpService,
    private readonly rateLimiter: RateLimiter,
    private readonly circuitBreaker: CircuitBreaker,
  ) {}

  async getAvailableTimes(
    apiToken: string,
    eventTypeUri: string,
    startTime: string,
    endTime: string,
  ): Promise<CalendlyAvailabilityResponse> {
    if (this.circuitBreaker.isOpen()) {
      throw new Error('Circuit breaker is open. Calendly API request skipped.');
    }

    await this.rateLimiter.waitForToken();

    // Extract UUID from the event type URI if it's a full URL
    const eventTypeUuid = this.extractEventTypeUuid(eventTypeUri);
    
    return this.fetchWithRetry(apiToken, eventTypeUuid, startTime, endTime);
  }

  private extractEventTypeUuid(eventTypeUri: string): string {
    if (eventTypeUri.startsWith('https://api.calendly.com/event_types/')) {
      return eventTypeUri;
    }
    
    this.logger.warn(`Event type URI appears to be a scheduling link: ${eventTypeUri}. This may need to be converted to an API URI.`);
    return eventTypeUri;
  }

  private async fetchWithRetry(
    apiToken: string,
    eventTypeUri: string,
    startTime: string,
    endTime: string,
    retries = 3,
    delay = 1000,
  ): Promise<CalendlyAvailabilityResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<CalendlyAvailabilityResponse>(`${this.baseUrl}/event_type_available_times`, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            event_type: eventTypeUri,
            start_time: startTime,
            end_time: endTime,
          },
        }),
      );

      this.circuitBreaker.recordSuccess();
      return response.data;
    } catch (error) {
      this.logger.error(
        `Calendly API request failed: ${error.message}`,
        error.stack,
      );

      if (this.isTransientError(error) && retries > 0) {
        this.logger.warn(
          `Retrying Calendly API request... (${retries} attempts left)`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(
          apiToken,
          eventTypeUri,
          startTime,
          endTime,
          retries - 1,
          delay * 2,
        );
      }

      this.circuitBreaker.recordFailure();

      if (error.response) {
        this.logger.error(
          `Calendly API Error Response: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }

  private isTransientError(error: any): boolean {
    if (!error.response) return true; // Network errors
    const status = error.response.status;
    return status === 429 || (status >= 500 && status <= 599);
  }

  async getEventTypeFromSchedulingUrl(apiToken: string, schedulingUrl: string): Promise<string> {
    try {
      // First, get the current user to find their organization
      const userResponse = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/me`, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }),
      );

      const userUri = userResponse.data.resource.uri;
      this.logger.log(`Found user URI: ${userUri}`);

      // Get all event types for this user
      const eventTypesResponse = await firstValueFrom(
        this.httpService.get<CalendlyEventTypesResponse>(`${this.baseUrl}/event_types`, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            user: userUri,
          },
          timeout: 10000, // 10 second timeout
        }),
      );

      // Find the event type that matches the scheduling URL
      const eventTypes = eventTypesResponse.data.collection;
      this.logger.log(`Found ${eventTypes.length} event types`);
      
      const matchingEventType = eventTypes.find((et: any) => 
        et.scheduling_url === schedulingUrl
      );

      if (matchingEventType) {
        this.logger.log(`Found matching event type: ${matchingEventType.uri}`);
        return matchingEventType.uri;
      }

      throw new Error(`No event type found matching scheduling URL: ${schedulingUrl}`);
    } catch (error) {
      this.logger.error(`Failed to get event type from scheduling URL: ${error.message}`, error.stack);
      throw error;
    }
  }
}

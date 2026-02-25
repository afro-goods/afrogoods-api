import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CalendlyApiClient } from './calendly-api-client';
import { DeliverySettingsService } from '../settings/delivery-settings.service';
import { AvailabilityStatusDto } from './dto/availability-status.dto';

@Injectable()
export class DeliveryAvailabilityService {
  private readonly logger = new Logger(DeliveryAvailabilityService.name);
  private readonly CACHE_KEY = 'delivery_availability_status';

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly calendlyApiClient: CalendlyApiClient,
    private readonly settingsService: DeliverySettingsService,
  ) {}

  async getAvailabilityStatus(): Promise<AvailabilityStatusDto> {
    const settings = await this.settingsService.getSettings();

    this.logger.log(`Checking availability status. Enabled: ${settings.deliveryAvailabilityEnabled}`);

    if (!settings.deliveryAvailabilityEnabled) {
      return this.neutralResponse('Delivery availability tracking is currently disabled.');
    }

    if (!settings.calendlyApiTokenEncrypted || !settings.calendlyEventTypeUri) {
      this.logger.warn(`Calendly integration is enabled but missing credentials. Token exists: ${!!settings.calendlyApiTokenEncrypted}, URI exists: ${!!settings.calendlyEventTypeUri}`);
      return this.neutralResponse('Delivery scheduling is currently unavailable.');
    }

    this.logger.log(`Calendly credentials found. Event URI: ${settings.calendlyEventTypeUri}`);

    // Try to get from cache
    const cachedStatus = await this.cacheManager.get<AvailabilityStatusDto>(this.CACHE_KEY);
    if (cachedStatus) {
      this.logger.log('Returning cached availability status');
      return cachedStatus;
    }

    try {
      const now = new Date();
      // Add 1 minute to ensure start_time is in the future
      now.setMinutes(now.getMinutes() + 1);
      const startTime = now.toISOString();
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(now.getDate() + 7);
      const endTime = sevenDaysLater.toISOString();

      this.logger.log(`Fetching availability from Calendly. Start: ${startTime}, End: ${endTime}`);

      // If the event type URI is a scheduling URL, convert it to API URI
      let eventTypeUri = settings.calendlyEventTypeUri;
      if (eventTypeUri.startsWith('https://calendly.com/')) {
        // Check cache first for the converted URI
        const cacheKey = `event_type_uri_${eventTypeUri}`;
        const cachedUri = await this.cacheManager.get<string>(cacheKey);
        
        if (cachedUri) {
          this.logger.log(`Using cached API URI: ${cachedUri}`);
          eventTypeUri = cachedUri;
        } else {
          this.logger.log('Converting scheduling URL to API URI...');
          try {
            eventTypeUri = await this.calendlyApiClient.getEventTypeFromSchedulingUrl(
              settings.calendlyApiTokenEncrypted,
              eventTypeUri
            );
            this.logger.log(`Converted to API URI: ${eventTypeUri}`);
            
            // Cache the converted URI for 24 hours
            await this.cacheManager.set(cacheKey, eventTypeUri, 24 * 60 * 60 * 1000);
          } catch (error) {
            this.logger.error(`Failed to convert scheduling URL: ${error.message}`);
            // Fall back to using the scheduling URL directly
            this.logger.warn('Falling back to using scheduling URL directly');
          }
        }
      }

      // Token is already decrypted by settingsService.getSettings()
      const response = await this.calendlyApiClient.getAvailableTimes(
        settings.calendlyApiTokenEncrypted, // Already decrypted
        eventTypeUri,
        startTime,
        endTime,
      );

      this.logger.log(`Calendly API returned ${response.collection?.length || 0} slots`);

      const status = this.processAvailability(response.collection);
      
      // Store in cache
      await this.cacheManager.set(
        this.CACHE_KEY, 
        status, 
        settings.cacheDurationMinutes * 60 * 1000
      );

      return status;
    } catch (error) {
      this.logger.error(`Failed to fetch availability from Calendly: ${error.message}`, error.stack);
      return this.neutralResponse('Delivery scheduling is currently unavailable.');
    }
  }

  private processAvailability(slots: any[]): AvailabilityStatusDto {
    if (!slots || slots.length === 0) {
      return {
        isAvailable: false,
        message: 'No delivery slots available for the next 7 days.',
      };
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const availableToday = slots.some(slot => 
      slot.status === 'available' && slot.start_time.startsWith(today)
    );

    if (availableToday) {
      const todaySlots = slots.filter(slot => 
        slot.status === 'available' && slot.start_time.startsWith(today)
      );
      
      const firstSlot = new Date(todaySlots[0].start_time);
      const lastSlot = new Date(todaySlots[todaySlots.length - 1].start_time);
      
      const startTime = firstSlot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endTime = lastSlot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      return {
        isAvailable: true,
        message: `Delivery slots available today between ${startTime} - ${endTime}`,
      };
    }

    const nextSlot = slots.find(slot => slot.status === 'available');
    if (nextSlot) {
      const nextDate = new Date(nextSlot.start_time);
      const dayName = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
      const dateStr = nextDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
      
      // Get all slots for that day to find the time range
      const nextDay = nextDate.toISOString().split('T')[0];
      const daySlots = slots.filter(slot => 
        slot.status === 'available' && slot.start_time.startsWith(nextDay)
      );
      
      if (daySlots.length > 0) {
        const firstSlot = new Date(daySlots[0].start_time);
        const lastSlot = new Date(daySlots[daySlots.length - 1].start_time);
        
        const startTime = firstSlot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const endTime = lastSlot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        return {
          isAvailable: false,
          nextAvailableDate: nextSlot.start_time,
          message: `Next delivery available on ${dayName}, ${dateStr} between ${startTime} - ${endTime}`,
        };
      }
      
      const timeStr = nextDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return {
        isAvailable: false,
        nextAvailableDate: nextSlot.start_time,
        message: `Next delivery available on ${dayName}, ${dateStr} at ${timeStr}`,
      };
    }

    return {
      isAvailable: false,
      message: 'No delivery slots available for the next 7 days.',
    };
  }

  private neutralResponse(message: string): AvailabilityStatusDto {
    return {
      isAvailable: true, // Fail-open to avoid blocking checkout if feature is off or broken
      message,
    };
  }
}

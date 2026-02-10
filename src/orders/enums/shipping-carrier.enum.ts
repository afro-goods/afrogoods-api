export enum ShippingCarrier {
  CANADA_POST = 'canada_post',
  UPS = 'ups',
  FEDEX = 'fedex',
  DHL = 'dhl',
  PUROLATOR = 'purolator',
  LOCAL_COURIER = 'local_courier',
  SELF_DELIVERY = 'self_delivery',
  OTHER = 'other',
}

// Tracking URL patterns for each carrier
export const CARRIER_TRACKING_URLS: Record<ShippingCarrier, string | null> = {
  [ShippingCarrier.CANADA_POST]:
    'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={trackingNumber}',
  [ShippingCarrier.UPS]: 'https://www.ups.com/track?tracknum={trackingNumber}',
  [ShippingCarrier.FEDEX]: 'https://www.fedex.com/fedextrack/?trknbr={trackingNumber}',
  [ShippingCarrier.DHL]:
    'https://www.dhl.com/en/express/tracking.html?AWB={trackingNumber}',
  [ShippingCarrier.PUROLATOR]:
    'https://www.purolator.com/en/shipping/tracker?pin={trackingNumber}',
  [ShippingCarrier.LOCAL_COURIER]: null,
  [ShippingCarrier.SELF_DELIVERY]: null,
  [ShippingCarrier.OTHER]: null,
};

// Generate tracking URL from carrier and tracking number
export function generateTrackingUrl(
  carrier: ShippingCarrier,
  trackingNumber: string,
): string | null {
  const pattern = CARRIER_TRACKING_URLS[carrier];
  if (!pattern) return null;
  return pattern.replace('{trackingNumber}', encodeURIComponent(trackingNumber));
}

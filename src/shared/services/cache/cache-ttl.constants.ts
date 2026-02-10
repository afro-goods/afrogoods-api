/**
 * Cache TTL (Time-To-Live) constants in seconds
 */
export const CacheTTL = {
  // Product caching
  PRODUCT_LIST: 300, // 5 minutes - product lists change frequently
  PRODUCT_SINGLE: 600, // 10 minutes - individual products are more stable

  // Category caching - longer TTL as categories rarely change
  CATEGORY_ALL: 1800, // 30 minutes
  CATEGORY_SINGLE: 1800, // 30 minutes
  CATEGORY_TREE: 1800, // 30 minutes
  CATEGORY_PARENTS: 1800, // 30 minutes
  CATEGORY_SUBCATEGORIES: 1800, // 30 minutes

  // Advert caching - shorter TTL as adverts have time-sensitive status
  ADVERT_LIST: 300, // 5 minutes
  ADVERT_ACTIVE: 300, // 5 minutes
  ADVERT_SINGLE: 300, // 5 minutes
  ADVERT_BY_CATEGORY: 300, // 5 minutes
} as const;

export type CacheTTLKey = keyof typeof CacheTTL;

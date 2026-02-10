/**
 * Helper class for generating consistent cache keys
 */
export class CacheKeyBuilder {
  // ============================================================
  // PRODUCT KEYS
  // ============================================================

  /**
   * Generate cache key for product list
   * @param page - Page number
   * @param limit - Items per page
   * @param category - Category ID or 'all' if not filtered
   */
  static productList(page: number, limit: number, category?: string): string {
    return `products:list:${page}:${limit}:${category || 'all'}`;
  }

  /**
   * Generate cache key for single product
   * @param id - Product ID
   */
  static productSingle(id: string): string {
    return `products:single:${id}`;
  }

  /**
   * Pattern to match all product caches
   */
  static productPattern(): string {
    return 'products:*';
  }

  /**
   * Pattern to match all product list caches
   */
  static productListPattern(): string {
    return 'products:list:*';
  }

  // ============================================================
  // CATEGORY KEYS
  // ============================================================

  /**
   * Cache key for all categories
   */
  static categoryAll(): string {
    return 'categories:all';
  }

  /**
   * Generate cache key for single category
   * @param id - Category ID
   */
  static categorySingle(id: string): string {
    return `categories:single:${id}`;
  }

  /**
   * Generate cache key for category tree
   * @param type - Category type ('product', 'advert') or 'all'
   */
  static categoryTree(type?: string): string {
    return `categories:tree:${type || 'all'}`;
  }

  /**
   * Cache key for parent categories
   * @param type - Category type
   */
  static categoryParents(type?: string): string {
    return `categories:parents:${type || 'all'}`;
  }

  /**
   * Cache key for subcategories of a parent
   * @param parentId - Parent category ID
   */
  static categorySubcategories(parentId: string): string {
    return `categories:subcategories:${parentId}`;
  }

  /**
   * Pattern to match all category caches
   */
  static categoryPattern(): string {
    return 'categories:*';
  }

  // ============================================================
  // ADVERT KEYS
  // ============================================================

  /**
   * Cache key for active adverts
   */
  static advertActive(): string {
    return 'adverts:active';
  }

  /**
   * Generate cache key for adverts by category
   * @param categoryId - Category ID
   */
  static advertByCategory(categoryId: string): string {
    return `adverts:category:${categoryId}`;
  }

  /**
   * Generate cache key for single advert
   * @param id - Advert ID
   */
  static advertSingle(id: string): string {
    return `adverts:single:${id}`;
  }

  /**
   * Pattern to match all advert caches
   */
  static advertPattern(): string {
    return 'adverts:*';
  }

  /**
   * Pattern to match advert list caches (excludes single adverts)
   */
  static advertListPattern(): string {
    return 'adverts:list:*';
  }
}

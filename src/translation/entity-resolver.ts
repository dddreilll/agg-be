export interface ResolvedEntity {
  id: string;
  name: string;
}

/**
 * Resolves a platform's external ids to internal entities. The real implementation
 * (PlatformMappingService) hits the DB; unit tests pass a fake, which keeps the
 * translators pure and DB-free to test.
 */
export interface EntityResolver {
  resolveStoreId(platform: string, externalMerchantId: string): Promise<string>;
  resolveProduct(platform: string, externalProductId: string): Promise<ResolvedEntity>;
  resolveModifier(platform: string, externalModifierId: string): Promise<ResolvedEntity>;
}

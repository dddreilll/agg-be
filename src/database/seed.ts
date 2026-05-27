import 'reflect-metadata';
import dataSource from './data-source';
import { Modifier } from './entities/modifier.entity';
import { PlatformMapping } from './entities/platform-mapping.entity';
import { Product } from './entities/product.entity';
import { Store } from './entities/store.entity';

// Internal UUIDs match the canonical sample (gemini-code-1779851953784.json) so a
// translated GrabFood order reproduces it exactly.
const STORE_ID = 'd3b07384-d113-4c4e-9c8e-a20468307d14';
const PRODUCT_ID = 'a1af8342-9901-44bb-b1d3-3b2046801c11';
const MODIFIER_ID = '7cc83411-fa02-4bb3-bc12-1a2046899e02';

async function seed(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      await manager.getRepository(Store).upsert(
        { id: STORE_ID, name: 'Manila Branch 01', location: 'Manila, PH', isActive: true },
        ['id'],
      );
      await manager.getRepository(Product).upsert(
        {
          id: PRODUCT_ID,
          sku: 'GRAB-CHICK-1PC',
          name: '1-pc Spicy Chicken Meal',
          basePriceCents: 13000,
          isAvailable: true,
        },
        ['id'],
      );
      await manager.getRepository(Modifier).upsert(
        { id: MODIFIER_ID, name: 'Garlic Rice Upgrade', priceCents: 3000, isAvailable: true },
        ['id'],
      );

      // External-id → internal-entity mappings for GrabFood.
      await manager.getRepository(PlatformMapping).upsert(
        [
          {
            storeId: STORE_ID,
            entityType: 'STORE',
            internalEntityId: STORE_ID,
            platformName: 'GRABFOOD',
            platformMetadata: { external_id: '1-CYNGRUNGSBCCC' }, // official sample merchantID
          },
          {
            storeId: STORE_ID,
            entityType: 'PRODUCT',
            internalEntityId: PRODUCT_ID,
            platformName: 'GRABFOOD',
            platformMetadata: { external_id: 'item-1' }, // official sample items[].id
          },
          {
            storeId: STORE_ID,
            entityType: 'MODIFIER',
            internalEntityId: MODIFIER_ID,
            platformName: 'GRABFOOD',
            platformMetadata: { external_id: 'modifier-1' }, // official sample modifiers[].id
          },
        ],
        ['storeId', 'entityType', 'internalEntityId', 'platformName'],
      );
    });
    // eslint-disable-next-line no-console
    console.log('✓ seed complete (store, product, modifier, 3 platform mappings)');
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed failed:', err);
  process.exit(1);
});

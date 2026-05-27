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

// Foodpanda lists the same physical store (Manila Branch 01) under restaurant id
// 'sq-abcd', but with its own menu items. New internal product/modifier entities.
const FP_PRODUCT_ID = 'f1e2d3c4-b5a6-4789-9c8b-1a2b3c4d5e6f';
const FP_MODIFIER_ID = 'a9b8c7d6-e5f4-4012-8a3b-4c5d6e7f8091';

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

      // Foodpanda menu items for the same store.
      await manager.getRepository(Product).upsert(
        {
          id: FP_PRODUCT_ID,
          sku: 'FP-DBL-CHEESE',
          name: 'Double Cheese Burger',
          basePriceCents: 642,
          isAvailable: true,
        },
        ['id'],
      );
      await manager.getRepository(Modifier).upsert(
        { id: FP_MODIFIER_ID, name: 'Extra Cheese', priceCents: 150, isAvailable: true },
        ['id'],
      );

      // External-id → internal-entity mappings, per platform.
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
          {
            storeId: STORE_ID,
            entityType: 'STORE',
            internalEntityId: STORE_ID,
            platformName: 'FOODPANDA',
            platformMetadata: { external_id: 'sq-abcd' }, // sample platformRestaurant.id
          },
          {
            storeId: STORE_ID,
            entityType: 'PRODUCT',
            internalEntityId: FP_PRODUCT_ID,
            platformName: 'FOODPANDA',
            platformMetadata: { external_id: 'ID_FOR_DOUBLE_CHEESE_BURGER_ON_POS' }, // products[].remoteCode
          },
          {
            storeId: STORE_ID,
            entityType: 'MODIFIER',
            internalEntityId: FP_MODIFIER_ID,
            platformName: 'FOODPANDA',
            platformMetadata: { external_id: 'ID_FOR_EXTRA_CHEESE_ON_POS' }, // selectedToppings[].remoteCode
          },
        ],
        ['storeId', 'entityType', 'internalEntityId', 'platformName'],
      );
    });
    // eslint-disable-next-line no-console
    console.log('✓ seed complete (2 products, 2 modifiers, 6 platform mappings across GrabFood + Foodpanda)');
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed failed:', err);
  process.exit(1);
});

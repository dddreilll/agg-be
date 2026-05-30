import type { DataSourceOptions } from 'typeorm';
import { Category } from './entities/category.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { PlatformMapping } from './entities/platform-mapping.entity';
import { Product } from './entities/product.entity';
import { Store } from './entities/store.entity';
import { AddOrderShortIdAndUpdatedAt1779880000000 } from './migrations/1779880000000-AddOrderShortIdAndUpdatedAt';
import { CreateOrders1779870000000 } from './migrations/1779870000000-CreateOrders';
import { AddProductCode1779900000000 } from './migrations/1779900000000-AddProductCode';
import { DropModifiers1779890000000 } from './migrations/1779890000000-DropModifiers';
import { InitSchema1779860000000 } from './migrations/1779860000000-InitSchema';

// Entity/migration classes are referenced directly (not globbed) so this works
// identically under ts-node and compiled JS.
export const ENTITIES = [
  Store,
  Category,
  Product,
  PlatformMapping,
  Order,
  OrderItem,
];

export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: ENTITIES,
    migrations: [InitSchema1779860000000, CreateOrders1779870000000, AddOrderShortIdAndUpdatedAt1779880000000, DropModifiers1779890000000, AddProductCode1779900000000],
    synchronize: false,
  };
}

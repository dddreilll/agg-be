import type { DataSourceOptions } from 'typeorm';
import { Category } from './entities/category.entity';
import { OrderEvent } from './entities/order-event.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { PlatformMapping } from './entities/platform-mapping.entity';
import { Product } from './entities/product.entity';
import { Store } from './entities/store.entity';
import { InitSchema1779860000000 } from './migrations/1779860000000-InitSchema';
import { CreateOrders1779870000000 } from './migrations/1779870000000-CreateOrders';
import { AddOrderShortIdAndUpdatedAt1779880000000 } from './migrations/1779880000000-AddOrderShortIdAndUpdatedAt';
import { DropModifiers1779890000000 } from './migrations/1779890000000-DropModifiers';
import { AddProductCode1779900000000 } from './migrations/1779900000000-AddProductCode';
import { AddOrderEvents1779910000000 } from './migrations/1779910000000-AddOrderEvents';
import { AddOrderArchivedAt1779920000000 } from './migrations/1779920000000-AddOrderArchivedAt';

// Entity/migration classes are referenced directly (not globbed) so this works
// identically under ts-node and compiled JS.
export const ENTITIES = [
  Store,
  Category,
  Product,
  PlatformMapping,
  Order,
  OrderItem,
  OrderEvent,
];

export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: ENTITIES,
    migrations: [
      InitSchema1779860000000,
      CreateOrders1779870000000,
      AddOrderShortIdAndUpdatedAt1779880000000,
      DropModifiers1779890000000,
      AddProductCode1779900000000,
      AddOrderEvents1779910000000,
      AddOrderArchivedAt1779920000000,
    ],
    synchronize: false,
  };
}

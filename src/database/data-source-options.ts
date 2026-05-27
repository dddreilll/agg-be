import type { DataSourceOptions } from 'typeorm';
import { Modifier } from './entities/modifier.entity';
import { PlatformMapping } from './entities/platform-mapping.entity';
import { Product } from './entities/product.entity';
import { Store } from './entities/store.entity';
import { InitSchema1779860000000 } from './migrations/1779860000000-InitSchema';

// Entity classes are referenced directly (not globbed) so this works identically
// under ts-node and compiled JS.
export const ENTITIES = [Store, Product, Modifier, PlatformMapping];

export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: ENTITIES,
    migrations: [InitSchema1779860000000],
    synchronize: false,
  };
}

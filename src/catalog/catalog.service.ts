import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Category } from '../database/entities/category.entity';
import { PlatformMapping } from '../database/entities/platform-mapping.entity';
import { Product } from '../database/entities/product.entity';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { LinkPlatformDto } from './dto/link-platform.dto';
import type { SetAvailabilityDto } from './dto/set-availability.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(PlatformMapping) private readonly mappings: Repository<PlatformMapping>,
  ) {}

  // ── Categories ──────────────────────────────────────────────────────────────

  listCategories(storeId?: string): Promise<Category[]> {
    return this.categories.find({
      where: storeId ? { storeId } : undefined,
      order: { sortOrder: 'ASC' },
    });
  }

  createCategory(dto: CreateCategoryDto): Promise<Category> {
    return this.categories.save(this.categories.create(dto));
  }

  async updateCategory(id: string, dto: Partial<CreateCategoryDto>): Promise<Category> {
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    Object.assign(category, dto);
    return this.categories.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const result = await this.categories.delete(id);
    if (!result.affected) throw new NotFoundException(`Category ${id} not found`);
  }

  // ── Products ─────────────────────────────────────────────────────────────────

  listProducts(categoryId?: string): Promise<Product[]> {
    return this.products.find({
      where: categoryId ? { categoryId } : undefined,
      order: { createdAt: 'DESC' },
    });
  }

  async findProduct(id: string): Promise<Product> {
    const product = await this.products.findOneBy({ id });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  createProduct(dto: CreateProductDto): Promise<Product> {
    return this.products.save(this.products.create(dto));
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findProduct(id);
    Object.assign(product, dto);
    return this.products.save(product);
  }

  async deleteProduct(id: string): Promise<void> {
    const result = await this.products.delete(id);
    if (!result.affected) throw new NotFoundException(`Product ${id} not found`);
  }

  async listProductsForPlatform(
    platformName: string,
    externalStoreId: string,
  ): Promise<Array<{ id: string; externalId: string; name: string; description: string | null; sku: string | null; basePriceCents: number; isAvailable: boolean; imageUrl: string | null; categoryId: string | null; createdAt: Date; updatedAt: Date }>> {
    const storeMapping = await this.mappings
      .createQueryBuilder('pm')
      .where('pm.platform_name = :platform', { platform: platformName.toUpperCase() })
      .andWhere('pm.entity_type = :type', { type: 'STORE' })
      .andWhere("pm.platform_metadata ->> 'external_id' = :extId", { extId: externalStoreId })
      .getOne();

    if (!storeMapping) return [];

    const productMappings = await this.mappings.find({
      where: {
        entityType: 'PRODUCT',
        platformName: platformName.toUpperCase(),
        storeId: storeMapping.internalEntityId,
      },
    });

    if (productMappings.length === 0) return [];

    const productIds = productMappings.map((pm) => pm.internalEntityId);
    const products = await this.products.findBy({ id: In(productIds) });

    return products.map((p) => ({
      ...p,
      externalId:
        (productMappings.find((pm) => pm.internalEntityId === p.id)?.platformMetadata?.[
          'external_id'
        ] as string) ?? '',
    }));
  }

  // ── Platform linking ─────────────────────────────────────────────────────────

  async linkToPlatform(productId: string, dto: LinkPlatformDto): Promise<PlatformMapping> {
    await this.findProduct(productId);
    const existing = await this.mappings.findOne({
      where: {
        internalEntityId: productId,
        entityType: 'PRODUCT',
        platformName: dto.platform,
        storeId: dto.storeId,
      },
    });
    if (existing) {
      existing.platformMetadata = dto.platformMetadata as Record<string, unknown>;
      existing.isSynced = false;
      return this.mappings.save(existing);
    }
    return this.mappings.save(
      this.mappings.create({
        storeId: dto.storeId,
        entityType: 'PRODUCT',
        internalEntityId: productId,
        platformName: dto.platform,
        platformMetadata: dto.platformMetadata as Record<string, unknown>,
        isSynced: false,
      }),
    );
  }

  getPlatformLinks(productId: string): Promise<PlatformMapping[]> {
    return this.mappings.find({
      where: { internalEntityId: productId, entityType: 'PRODUCT' },
    });
  }

  // ── 86'ing ───────────────────────────────────────────────────────────────────

  async setAvailability(productId: string, dto: SetAvailabilityDto): Promise<Product> {
    const product = await this.findProduct(productId);

    if (dto.platform) {
      // Per-platform 86'ing: update is_available in the platform_mapping metadata.
      const link = await this.mappings.findOne({
        where: { internalEntityId: productId, entityType: 'PRODUCT', platformName: dto.platform },
      });
      if (link) {
        link.platformMetadata = { ...link.platformMetadata, is_available: dto.isAvailable };
        link.isSynced = false;
        await this.mappings.save(link);
      }
    } else {
      // Global 86'ing: set the product's own flag and mark all platform links unsynced.
      product.isAvailable = dto.isAvailable;
      await this.products.save(product);
      await this.mappings
        .createQueryBuilder()
        .update()
        .set({ isSynced: false })
        .where('internal_entity_id = :id AND entity_type = :type', { id: productId, type: 'PRODUCT' })
        .execute();
    }

    return product;
  }
}

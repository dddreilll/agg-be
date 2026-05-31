import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformMapping } from '../database/entities/platform-mapping.entity';
import { Store } from '../database/entities/store.entity';
import type {
  CreateMappingDto,
  CreateStoreDto,
  UpdateMappingDto,
  UpdateStoreDto,
} from './dto/store.dto';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(PlatformMapping) private readonly mappings: Repository<PlatformMapping>,
  ) {}

  list(): Promise<Store[]> {
    return this.stores.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Store> {
    const store = await this.stores.findOne({ where: { id } });
    if (!store) throw new NotFoundException(`Store ${id} not found`);
    return store;
  }

  create(dto: CreateStoreDto): Promise<Store> {
    return this.stores.save(this.stores.create({ name: dto.name, location: dto.location ?? null }));
  }

  async update(id: string, dto: UpdateStoreDto): Promise<Store> {
    const store = await this.findOne(id);
    if (dto.name !== undefined) store.name = dto.name;
    if (dto.location !== undefined) store.location = dto.location ?? null;
    if (dto.isActive !== undefined) store.isActive = dto.isActive;
    return this.stores.save(store);
  }

  async deactivate(id: string): Promise<Store> {
    const store = await this.findOne(id);
    store.isActive = false;
    return this.stores.save(store);
  }

  async listMappings(storeId: string): Promise<PlatformMapping[]> {
    await this.findOne(storeId);
    return this.mappings.find({
      where: { storeId },
      order: { platformName: 'ASC', entityType: 'ASC' },
    });
  }

  async createMapping(storeId: string, dto: CreateMappingDto): Promise<PlatformMapping> {
    await this.findOne(storeId);
    return this.mappings.save(
      this.mappings.create({
        storeId,
        entityType: dto.entityType,
        internalEntityId: dto.internalEntityId,
        platformName: dto.platformName,
        platformMetadata: dto.platformMetadata,
        isSynced: false,
        lastSyncedAt: null,
      }),
    );
  }

  async updateMapping(
    storeId: string,
    mappingId: string,
    dto: UpdateMappingDto,
  ): Promise<PlatformMapping> {
    await this.findOne(storeId);
    const mapping = await this.mappings.findOne({ where: { id: mappingId, storeId } });
    if (!mapping) throw new NotFoundException(`Mapping ${mappingId} not found for store ${storeId}`);
    if (dto.platformMetadata !== undefined) mapping.platformMetadata = dto.platformMetadata;
    if (dto.isSynced !== undefined) {
      mapping.isSynced = dto.isSynced;
      if (dto.isSynced) mapping.lastSyncedAt = new Date();
    }
    return this.mappings.save(mapping);
  }

  async deleteMapping(storeId: string, mappingId: string): Promise<void> {
    await this.findOne(storeId);
    const mapping = await this.mappings.findOne({ where: { id: mappingId, storeId } });
    if (!mapping) throw new NotFoundException(`Mapping ${mappingId} not found for store ${storeId}`);
    await this.mappings.remove(mapping);
  }
}

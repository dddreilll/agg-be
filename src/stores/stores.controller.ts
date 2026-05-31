import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlatformMapping } from '../database/entities/platform-mapping.entity';
import { Store } from '../database/entities/store.entity';
import {
  CreateMappingDto,
  CreateStoreDto,
  UpdateMappingDto,
  UpdateStoreDto,
} from './dto/store.dto';
import { StoresService } from './stores.service';

@ApiTags('Stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'List all stores' })
  @ApiResponse({ status: 200, type: [Store] })
  list(): Promise<Store[]> {
    return this.stores.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a store' })
  @ApiResponse({ status: 201, type: Store })
  create(@Body() dto: CreateStoreDto): Promise<Store> {
    return this.stores.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a store by ID' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 200, type: Store })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Store> {
    return this.stores.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a store' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 200, type: Store })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
  ): Promise<Store> {
    return this.stores.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a store (soft delete)' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 204, description: 'Deactivated.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.stores.deactivate(id);
  }

  // ── Platform mappings sub-resource ──────────────────────────────────────────

  @Get(':id/mappings')
  @ApiOperation({ summary: 'List platform mappings for a store' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 200, type: [PlatformMapping] })
  listMappings(@Param('id', ParseUUIDPipe) id: string): Promise<PlatformMapping[]> {
    return this.stores.listMappings(id);
  }

  @Post(':id/mappings')
  @ApiOperation({ summary: 'Add a platform mapping to a store' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 201, type: PlatformMapping })
  createMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMappingDto,
  ): Promise<PlatformMapping> {
    return this.stores.createMapping(id, dto);
  }

  @Patch(':id/mappings/:mappingId')
  @ApiOperation({ summary: 'Update a platform mapping' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiParam({ name: 'mappingId', description: 'Mapping UUID' })
  @ApiResponse({ status: 200, type: PlatformMapping })
  updateMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
    @Body() dto: UpdateMappingDto,
  ): Promise<PlatformMapping> {
    return this.stores.updateMapping(id, mappingId, dto);
  }

  @Delete(':id/mappings/:mappingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a platform mapping' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiParam({ name: 'mappingId', description: 'Mapping UUID' })
  @ApiResponse({ status: 204, description: 'Removed.' })
  async deleteMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
  ): Promise<void> {
    await this.stores.deleteMapping(id, mappingId);
  }
}

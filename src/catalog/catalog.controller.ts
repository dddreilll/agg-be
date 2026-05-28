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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { LinkPlatformDto } from './dto/link-platform.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  CategoryResponseDto,
  PlatformLinkResponseDto,
  ProductResponseDto,
} from './dto/catalog-response.dto';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ── Categories ──────────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List categories' })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Filter by store UUID' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto], description: 'Category list.' })
  listCategories(@Query('storeId') storeId?: string) {
    return this.catalog.listCategories(storeId);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a category' })
  @ApiResponse({ status: 201, type: CategoryResponseDto, description: 'Category created.' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, description: 'Updated category.' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.catalog.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiResponse({ status: 204, description: 'Category deleted.' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteCategory(id);
  }

  // ── Products ─────────────────────────────────────────────────────────────────

  @Get('products')
  @ApiOperation({ summary: 'List products' })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Filter by category UUID' })
  @ApiResponse({ status: 200, type: [ProductResponseDto], description: 'Product list.' })
  listProducts(@Query('categoryId') categoryId?: string) {
    return this.catalog.listProducts(categoryId);
  }

  @Post('products')
  @ApiOperation({
    summary: 'Create a product',
    description: 'Creates a canonical product. Use POST /catalog/products/:id/platforms to link it to a delivery platform.',
  })
  @ApiResponse({ status: 201, type: ProductResponseDto, description: 'Product created.' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, type: ProductResponseDto, description: 'Product detail.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  findProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.findProduct(id);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, type: ProductResponseDto, description: 'Updated product.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 204, description: 'Product deleted.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteProduct(id);
  }

  // ── Platform linking ─────────────────────────────────────────────────────────

  @Post('products/:id/platforms')
  @ApiOperation({
    summary: 'Link a product to a delivery platform',
    description: 'Creates or updates a platform_mapping entry so this product is associated with a platform-specific ID. platformMetadata must include `external_id`.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 201, type: PlatformLinkResponseDto, description: 'Platform link created or updated.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  linkToPlatform(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkPlatformDto,
  ) {
    return this.catalog.linkToPlatform(id, dto);
  }

  @Get('products/:id/platforms')
  @ApiOperation({ summary: 'List platform links for a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, type: [PlatformLinkResponseDto], description: 'Platform links for the product.' })
  getPlatformLinks(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getPlatformLinks(id);
  }

  // ── Availability ─────────────────────────────────────────────────────────────

  @Patch('products/:id/availability')
  @ApiOperation({
    summary: 'Set product availability (86\'ing)',
    description:
      'Sets isAvailable globally on the product, or per-platform if platform is supplied. ' +
      'All affected platform_mappings are marked isSynced=false for the next menu push. ' +
      '"86\'ing" is restaurant-industry shorthand for marking an item out of stock.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, type: ProductResponseDto, description: 'Updated product with new availability.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  setAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.catalog.setAvailability(id, dto);
  }
}

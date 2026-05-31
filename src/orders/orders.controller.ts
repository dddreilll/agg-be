import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrderEvent } from '../database/entities/order-event.entity';
import { OutboundDispatchService } from '../outbound/outbound-dispatch.service';
import { KitchenGateway } from '../realtime/kitchen.gateway';
import { ListOrdersDto } from './dto/list-orders.dto';
import { OrderResponseDto, PaginatedOrdersDto, serializeOrder } from './dto/order-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersQueryService } from './orders-query.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly query: OrdersQueryService,
    private readonly kitchen: KitchenGateway,
    private readonly outbound: OutboundDispatchService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List orders',
    description: 'Paginated list of orders with optional filters for store, platform, status, and date range.',
  })
  @ApiResponse({ status: 200, description: 'Paginated order list.', type: PaginatedOrdersDto })
  async list(@Query() dto: ListOrdersDto): Promise<PaginatedOrdersDto> {
    const result = await this.query.list(dto);
    return {
      data: result.data.map(serializeOrder),
      meta: result.meta,
    } as PaginatedOrdersDto;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order with its items and modifiers.' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
    const order = await this.query.findOne(id);
    return serializeOrder(order) as OrderResponseDto;
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Get audit trail for an order', description: 'Returns the append-only event log for the order (created, status changes, etc.).' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Event list.', type: [OrderEvent] })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async listEvents(@Param('id', ParseUUIDPipe) id: string): Promise<OrderEvent[]> {
    return this.query.findEvents(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status', description: 'Merchant-initiated status transition. Broadcasts order.status_updated over WebSocket.' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const order = await this.query.updateStatus(id, dto.status as any);
    this.kitchen.broadcastStatusUpdate(order.storeId, order.id, order.status);
    void this.outbound.pushStatusUpdate(
      order.platform,
      order.id,
      order.externalOrderId,
      order.storeId,
      dto.status as any,
    );
    return serializeOrder(order) as OrderResponseDto;
  }
}

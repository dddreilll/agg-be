import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { OrderItemModifier } from '../database/entities/order-item-modifier.entity';
import type { CanonicalOrderStatus } from '../translation/canonical.types';
import type { ListOrdersDto } from './dto/list-orders.dto';

export interface PaginatedOrders {
  data: Order[];
  meta: { total: number; page: number; limit: number; hasNextPage: boolean };
}

@Injectable()
export class OrdersQueryService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(OrderItemModifier) private readonly modifiers: Repository<OrderItemModifier>,
  ) {}

  async list(query: ListOrdersDto): Promise<PaginatedOrders> {
    const { storeId, platform, status, from, to, page, limit } = query;
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'item')
      .leftJoinAndSelect('item.modifiers', 'mod')
      .orderBy('o.receivedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (storeId) qb.andWhere('o.storeId = :storeId', { storeId });
    if (platform) qb.andWhere('o.platform = :platform', { platform });
    if (status) qb.andWhere('o.status = :status', { status });
    if (from) qb.andWhere('o.receivedAt >= :from', { from: new Date(from) });
    if (to) qb.andWhere('o.receivedAt <= :to', { to: new Date(to) });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, hasNextPage: page * limit < total } };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id },
      relations: { items: { modifiers: true } },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async updateStatus(id: string, status: CanonicalOrderStatus): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;
    return this.orders.save(order);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEvent } from '../database/entities/order-event.entity';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
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
    @InjectRepository(OrderEvent) private readonly events: Repository<OrderEvent>,
  ) {}

  async list(query: ListOrdersDto): Promise<PaginatedOrders> {
    const { storeId, platform, status, from, to, page, limit } = query;
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'item')
      .where('o.archivedAt IS NULL')
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
      relations: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async updateStatus(id: string, status: CanonicalOrderStatus): Promise<Order> {
    const order = await this.findOne(id);
    const previousStatus = order.status;
    order.status = status;
    const saved = await this.orders.save(order);
    await this.events.save(
      this.events.create({
        orderId: saved.id,
        eventType: 'order.status_changed',
        previousStatus,
        newStatus: status,
        actor: 'merchant',
      }),
    );
    return saved;
  }

  async findEvents(orderId: string): Promise<OrderEvent[]> {
    await this.findOne(orderId); // 404 if order doesn't exist
    return this.events.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }
}

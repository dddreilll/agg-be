import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemModifier } from '../database/entities/order-item-modifier.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Order } from '../database/entities/order.entity';
import { OrderPersistenceService } from './order-persistence.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, OrderItemModifier])],
  providers: [OrderPersistenceService],
  exports: [OrderPersistenceService],
})
export class OrdersModule {}

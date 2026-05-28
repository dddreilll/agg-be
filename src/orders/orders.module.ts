import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemModifier } from '../database/entities/order-item-modifier.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Order } from '../database/entities/order.entity';
import { OutboundModule } from '../outbound/outbound.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrderPersistenceService } from './order-persistence.service';
import { OrdersController } from './orders.controller';
import { OrdersQueryService } from './orders-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, OrderItemModifier]), RealtimeModule, OutboundModule],
  controllers: [OrdersController],
  providers: [OrderPersistenceService, OrdersQueryService],
  exports: [OrderPersistenceService, OrdersQueryService],
})
export class OrdersModule {}

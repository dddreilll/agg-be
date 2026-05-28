import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformMapping } from '../database/entities/platform-mapping.entity';
import { FoodpandaOutboundAdapter } from './foodpanda-outbound.adapter';
import { GrabFoodOutboundAdapter } from './grabfood-outbound.adapter';
import { OutboundDispatchService } from './outbound-dispatch.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformMapping])],
  providers: [GrabFoodOutboundAdapter, FoodpandaOutboundAdapter, OutboundDispatchService],
  exports: [OutboundDispatchService],
})
export class OutboundModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OrderRetentionService } from './order-retention.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [OrderRetentionService],
})
export class MaintenanceModule {}

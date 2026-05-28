import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformMapping } from '../database/entities/platform-mapping.entity';
import { Product } from '../database/entities/product.entity';
import { Store } from '../database/entities/store.entity';
import { PlatformMappingService } from './platform-mapping.service';
import { TranslationService } from './translation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Store, Product, PlatformMapping])],
  providers: [PlatformMappingService, TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}

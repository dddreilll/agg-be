import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../database/entities/product.entity';
import { ParserController } from './parser.controller';
import { ParserService } from './parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ParserController],
  providers: [ParserService],
})
export class ParserModule {}

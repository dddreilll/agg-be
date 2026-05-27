import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source-options';

// Standalone DataSource for the TypeORM CLI and the seed script.
const url = process.env.DATABASE_URL ?? 'postgres://dops:dops@localhost:5432/dops';

export default new DataSource(dataSourceOptions(url));

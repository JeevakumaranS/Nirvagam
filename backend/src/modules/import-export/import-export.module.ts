import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { ImportExportController } from './import-export.controller';
import { ImportExportRegistry } from './import-export.registry';
import { ImportExportService } from './import-export.service';

@Module({
  imports: [ProductsModule],
  controllers: [ImportExportController],
  providers: [ImportExportRegistry, ImportExportService],
  exports: [ImportExportRegistry, ImportExportService],
})
export class ImportExportModule {}

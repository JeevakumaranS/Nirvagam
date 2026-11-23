import { Module } from '@nestjs/common';
import { SchemaCustomizationService } from './schema-customization.service';
import { CustomDataValidatorService } from './custom-data-validator.service';
import { CustomEntityCrudService } from './custom-entity-crud.service';
import { IndustryTemplatesService } from './industry-templates.service';
import { CustomizationController } from './customization.controller';

@Module({
  controllers: [CustomizationController],
  providers: [
    SchemaCustomizationService,
    CustomDataValidatorService,
    CustomEntityCrudService,
    IndustryTemplatesService,
  ],
  exports: [
    SchemaCustomizationService,
    CustomDataValidatorService,
    CustomEntityCrudService,
    IndustryTemplatesService,
  ],
})
export class CustomizationModule {}

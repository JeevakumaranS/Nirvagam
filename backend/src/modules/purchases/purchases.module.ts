import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchaseCoreService } from './services/purchase-core.service';
import { PurchaseProcurementService } from './services/purchase-procurement.service';
import { PurchaseBillingService } from './services/purchase-billing.service';
import { PurchaseAttachmentsService } from './services/purchase-attachments.service';
import { PurchaseFinancialsReportsService } from './services/purchase-financials-reports.service';

@Module({
  controllers: [PurchasesController],
  providers: [
    PurchaseCoreService,
    PurchaseProcurementService,
    PurchaseBillingService,
    PurchaseAttachmentsService,
    PurchaseFinancialsReportsService,
  ],
  exports: [
    PurchaseCoreService,
    PurchaseProcurementService,
    PurchaseBillingService,
    PurchaseAttachmentsService,
    PurchaseFinancialsReportsService,
  ],
})
export class PurchasesModule {}

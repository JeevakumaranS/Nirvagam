import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import * as fs from "fs";
import { AuthUser, PaginationParams } from "@nirvagam/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantResolverGuard } from "../../tenancy/tenant-resolver.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PurchaseCoreService } from "./services/purchase-core.service";
import { PurchaseProcurementService } from "./services/purchase-procurement.service";
import { PurchaseBillingService } from "./services/purchase-billing.service";
import { PurchaseAttachmentsService } from "./services/purchase-attachments.service";
import { PurchaseFinancialsReportsService } from "./services/purchase-financials-reports.service";
import {
  CancelReasonDto,
  CreateInvoicePaymentDto,
  CreateGrnDto,
  CreatePurchaseInvoiceDto,
  CreatePurchaseOrderDto,
  CreatePurchaseRequestDto,
  UpdateGrnDto,
  UpdatePurchaseInvoiceDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseRequestDto,
  UpdatePurchaseSettingsDto,
} from "./dto/purchase.dto";

@ApiTags("Purchase Management (Module 3)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantResolverGuard, PermissionsGuard)
@Controller("purchases")
export class PurchasesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: PurchaseCoreService,
    private readonly procurement: PurchaseProcurementService,
    private readonly billing: PurchaseBillingService,
    private readonly attachments: PurchaseAttachmentsService,
    private readonly financials: PurchaseFinancialsReportsService,
  ) {}

  /* ---------------------------- SETTINGS & SERIES --------------------------- */

  @Get("settings")
  @RequirePermissions("purchase_settings:view")
  @ApiOperation({ summary: "Get Purchase Settings & Account Mappings" })
  getSettings(@CurrentUser() user: AuthUser) {
    return this.core.getSettings(user.businessId);
  }

  @Put("settings")
  @RequirePermissions("purchase_settings:edit")
  @ApiOperation({ summary: "Update Purchase Settings & Account Mappings" })
  async updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePurchaseSettingsDto,
  ) {
    await this.core.getSettings(user.businessId);
    return this.prisma.purchaseSettings.update({
      where: { businessId: user.businessId },
      data: { ...(dto as any), updatedById: user.id },
    });
  }

  @Get("number-series")
  @RequirePermissions("purchase_settings:view")
  listNumberSeries(@CurrentUser() user: AuthUser) {
    return this.prisma.documentNumberSeries.findMany({
      where: {
        businessId: user.businessId,
        ...(user.branchId ? { branchId: user.branchId } : {}),
      },
      orderBy: { documentType: "asc" },
    });
  }

  /* ---------------------------- PURCHASE REQUESTS --------------------------- */

  @Get("requests")
  @RequirePermissions("purchase_request:view")
  listRequests(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationParams & Record<string, any>,
  ) {
    return this.procurement.listRequests(user, query);
  }

  @Get("requests/:id")
  @RequirePermissions("purchase_request:view")
  getRequest(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.procurement.getRequest(user, id);
  }

  @Post("requests")
  @RequirePermissions("purchase_request:create")
  createRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePurchaseRequestDto,
  ) {
    return this.procurement.createRequest(user, dto);
  }

  @Put("requests/:id")
  @RequirePermissions("purchase_request:edit")
  updateRequest(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdatePurchaseRequestDto,
  ) {
    return this.procurement.updateRequest(user, id, dto);
  }

  @Post("requests/:id/submit")
  @RequirePermissions("purchase_request:edit")
  submitRequest(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.procurement.submitRequest(user, id);
  }

  @Post("requests/:id/cancel")
  @RequirePermissions("purchase_request:cancel")
  cancelRequest(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CancelReasonDto,
  ) {
    return this.procurement.cancelRequest(user, id, dto.reason);
  }

  @Post("requests/:id/convert-to-po")
  @RequirePermissions("purchase_order:create")
  convertRequestToPo(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: Partial<CreatePurchaseOrderDto>,
  ) {
    return this.procurement.convertRequestToPo(user, id, dto);
  }

  /* ----------------------------- PURCHASE ORDERS ---------------------------- */

  @Get("orders")
  @RequirePermissions("purchase_order:view")
  listOrders(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationParams & Record<string, any>,
  ) {
    return this.procurement.listOrders(user, query);
  }

  @Get("orders/:id")
  @RequirePermissions("purchase_order:view")
  getOrder(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.procurement.getOrder(user, id);
  }

  @Post("orders")
  @RequirePermissions("purchase_order:create")
  createOrder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.procurement.createOrder(user, dto);
  }

  @Put("orders/:id")
  @RequirePermissions("purchase_order:edit")
  updateOrder(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.procurement.updateOrder(user, id, dto);
  }

  @Post("orders/:id/submit")
  @RequirePermissions("purchase_order:edit")
  submitOrder(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.procurement.submitOrder(user, id);
  }

  @Post("orders/:id/close")
  @RequirePermissions("purchase_order:edit")
  closeOrder(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.procurement.closeOrder(user, id);
  }

  @Post("orders/:id/cancel")
  @RequirePermissions("purchase_order:cancel")
  cancelOrder(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CancelReasonDto,
  ) {
    return this.procurement.cancelOrder(user, id, dto.reason);
  }

  @Post("orders/:id/create-grn")
  @RequirePermissions("grn:create")
  createGrnFromPo(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateGrnDto,
  ) {
    return this.procurement.createGrn(user, { ...dto, purchaseOrderId: id });
  }

  /* ----------------------------------- GRN ---------------------------------- */

  @Get("grns")
  @RequirePermissions("grn:view")
  listGrns(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationParams & Record<string, any>,
  ) {
    return this.procurement.listGrns(user, query);
  }

  @Get("grns/:id")
  @RequirePermissions("grn:view")
  getGrn(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.procurement.getGrn(user, id);
  }

  @Post("grns")
  @RequirePermissions("grn:create")
  createGrn(@CurrentUser() user: AuthUser, @Body() dto: CreateGrnDto) {
    return this.procurement.createGrn(user, dto);
  }

  @Put("grns/:id")
  @RequirePermissions("grn:edit")
  updateGrn(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateGrnDto,
  ) {
    return this.procurement.updateGrn(user, id, dto);
  }

  @Post("grns/:id/post")
  @RequirePermissions("grn:post")
  postGrn(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.procurement.postGrn(user, id);
  }

  @Post("grns/:id/cancel")
  @RequirePermissions("grn:cancel")
  cancelGrn(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CancelReasonDto,
  ) {
    return this.procurement.cancelGrn(user, id, dto.reason);
  }

  @Post("grns/:id/create-invoice")
  @RequirePermissions("purchase_invoice:create")
  createInvoiceFromGrn(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreatePurchaseInvoiceDto,
  ) {
    return this.billing.createInvoice(user, {
      ...dto,
      mode: "AGAINST_PO_GRN",
      grnIds: Array.from(new Set([...(dto.grnIds || []), id])),
    });
  }

  /* ---------------------------- PURCHASE INVOICES --------------------------- */

  @Get("invoices")
  @RequirePermissions("purchase_invoice:view")
  listInvoices(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationParams & Record<string, any>,
  ) {
    return this.billing.listInvoices(user, query);
  }

  @Get("invoices/:id")
  @RequirePermissions("purchase_invoice:view")
  getInvoice(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.billing.getInvoice(user, id);
  }

  @Post("invoices")
  @RequirePermissions("purchase_invoice:create")
  createInvoice(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePurchaseInvoiceDto,
  ) {
    return this.billing.createInvoice(user, dto);
  }

  @Post("invoices/:id/payments")
  @RequirePermissions("purchase_payment:create")
  recordInvoicePayment(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateInvoicePaymentDto,
  ) {
    return this.billing.recordInvoicePayment(user, id, dto);
  }

  @Put("invoices/:id")
  @RequirePermissions("purchase_invoice:edit")
  updateInvoice(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdatePurchaseInvoiceDto,
  ) {
    return this.billing.updateInvoice(user, id, dto);
  }

  @Post("invoices/:id/post")
  @RequirePermissions("purchase_invoice:post")
  postInvoice(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.billing.postInvoice(user, id);
  }

  @Post("invoices/:id/cancel")
  @RequirePermissions("purchase_invoice:cancel")
  cancelInvoice(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CancelReasonDto,
  ) {
    return this.billing.cancelInvoice(user, id, dto.reason);
  }

  /* -------------------------- SUPPLIER SELECTION ---------------------------- */

  @Get("suppliers")
  @RequirePermissions("purchase_invoice:view")
  searchSuppliers(
    @CurrentUser() user: AuthUser,
    @Query() query: { search?: string; variantId?: string },
  ) {
    return this.financials.searchSuppliersWithMetrics(user, query);
  }

  @Get("print/:documentType/:id")
  @RequirePermissions("purchase_invoice:print")
  getPrintData(
    @CurrentUser() user: AuthUser,
    @Param("documentType")
    documentType: "PO" | "GRN" | "INVOICE",
    @Param("id") id: string,
  ) {
    return this.financials.getPrintData(user, documentType, id);
  }

  /* ------------------------------- ATTACHMENTS ------------------------------ */

  @Get("attachments/:documentType/:documentId")
  @RequirePermissions("purchase_attachment:view")
  listAttachments(
    @CurrentUser() user: AuthUser,
    @Param("documentType") documentType: string,
    @Param("documentId") documentId: string,
  ) {
    return this.attachments.list(user, documentType, documentId);
  }

  @Post("attachments/:documentType/:documentId")
  @RequirePermissions("purchase_attachment:create")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  uploadAttachment(
    @CurrentUser() user: AuthUser,
    @Param("documentType") documentType: string,
    @Param("documentId") documentId: string,
    @UploadedFile() file: any,
  ) {
    return this.attachments.uploadFile(user, documentType, documentId, file);
  }

  @Get("attachments/:id/download")
  @RequirePermissions("purchase_attachment:view")
  async downloadAttachment(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const att = await this.attachments.getDownloadInfo(user, id);
    res.setHeader("Content-Type", att.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(att.fileName)}"`,
    );
    fs.createReadStream(att.filePath).pipe(res);
  }

  @Delete("attachments/:id")
  @RequirePermissions("purchase_attachment:delete")
  deleteAttachment(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.attachments.remove(user, id);
  }

  /* --------------------------- ADDITIONAL CHARGES --------------------------- */

  @Get("additional-charges")
  @RequirePermissions("purchase_order:view")
  getAdditionalCharges(
    @CurrentUser() user: AuthUser,
    @Query("activeOnly") activeOnly?: string,
  ) {
    return this.core.getAdditionalCharges(user.businessId, activeOnly === "true");
  }

  @Post("additional-charges")
  @RequirePermissions("purchase_settings:edit")
  createAdditionalCharge(
    @CurrentUser() user: AuthUser,
    @Body() dto: { name: string },
  ) {
    return this.core.createAdditionalCharge(user.businessId, dto);
  }

  @Patch("additional-charges/:id/toggle")
  @RequirePermissions("purchase_settings:edit")
  toggleAdditionalCharge(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: { isActive: boolean },
  ) {
    return this.core.toggleAdditionalCharge(user.businessId, id, Boolean(dto.isActive));
  }

  @Delete("additional-charges/:id")
  @RequirePermissions("purchase_settings:edit")
  deleteAdditionalCharge(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.core.deleteAdditionalCharge(user.businessId, id);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantResolverGuard } from '../../tenancy/tenant-resolver.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, PaginationParams } from '@nirvagam/shared';

@ApiTags('Purchase Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantResolverGuard, PermissionsGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get('requests') @RequirePermissions('purchase_request:view')
  findRequests(@CurrentUser() user: AuthUser, @Query() query: PaginationParams & Record<string, any>) { return this.purchasesService.findAll(user, query, 'requests'); }
  @Get('requests/:id') @RequirePermissions('purchase_request:view')
  getRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.findOne(user, 'requests', id); }
  @Post('requests') @RequirePermissions('purchase_request:create')
  createRequest(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.purchasesService.createRequest(user, dto); }
  @Post('requests/:id/submit') @RequirePermissions('purchase_request:edit')
  submitRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.changeRequestStatus(user, id, 'submit'); }
  @Post('requests/:id/approve') @RequirePermissions('purchase_request:approve')
  approveRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.changeRequestStatus(user, id, 'approve'); }
  @Post('requests/:id/reject') @RequirePermissions('purchase_request:approve')
  rejectRequest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.changeRequestStatus(user, id, 'reject', dto); }
  @Post('requests/:id/cancel') @RequirePermissions('purchase_request:cancel')
  cancelRequest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.cancelGeneric(user, 'request', id, dto); }
  @Post('requests/:id/convert-to-po') @RequirePermissions('purchase_order:create')
  convertRequest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.convertRequestToPo(user, id, dto); }

  @Get('orders') @RequirePermissions('purchase_order:view')
  findOrders(@CurrentUser() user: AuthUser, @Query() query: PaginationParams & Record<string, any>) { return this.purchasesService.findAll(user, query, 'orders'); }
  @Get('orders/:id') @RequirePermissions('purchase_order:view')
  getOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.findOne(user, 'orders', id); }
  @Post('orders') @RequirePermissions('purchase_order:create')
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.purchasesService.createOrder(user, dto); }
  @Post('orders/:id/submit') @RequirePermissions('purchase_order:edit')
  submitOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.changeOrderStatus(user, id, 'submit'); }
  @Post('orders/:id/approve') @RequirePermissions('purchase_order:approve')
  approveOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.changeOrderStatus(user, id, 'approve'); }
  @Post('orders/:id/cancel') @RequirePermissions('purchase_order:cancel')
  cancelOrder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.cancelGeneric(user, 'order', id, dto); }
  @Post('orders/:id/create-grn') @RequirePermissions('grn:create')
  createOrderGrn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.createGrn(user, { ...dto, purchaseOrderId: id }); }

  @Get('grns') @RequirePermissions('grn:view')
  findGrns(@CurrentUser() user: AuthUser, @Query() query: PaginationParams & Record<string, any>) { return this.purchasesService.findAll(user, query, 'grns'); }
  @Get('grns/:id') @RequirePermissions('grn:view')
  getGrn(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.findOne(user, 'grns', id); }
  @Post('grns') @RequirePermissions('grn:create')
  createGrn(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.purchasesService.createGrn(user, dto); }
  @Post('grns/:id/post') @RequirePermissions('grn:post')
  postGrn(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.postGrn(user, id); }
  @Post('grns/:id/cancel') @RequirePermissions('grn:cancel')
  cancelGrn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.cancelGeneric(user, 'grn', id, dto); }
  @Post('grns/:id/create-invoice') @RequirePermissions('purchase_invoice:create')
  createGrnInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.createInvoice(user, { ...dto, mode: 'AGAINST_PO_GRN', grnIds: [...(dto.grnIds || []), id] }); }

  @Get('invoices') @RequirePermissions('purchase_invoice:view')
  findInvoices(@CurrentUser() user: AuthUser, @Query() query: PaginationParams & Record<string, any>) { return this.purchasesService.findAll(user, query, 'invoices'); }
  @Get('invoices/:id') @RequirePermissions('purchase_invoice:view')
  getInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.findOne(user, 'invoices', id); }
  @Post('invoices') @RequirePermissions('purchase_invoice:create')
  createInvoice(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.purchasesService.createInvoice(user, dto); }
  @Post('invoices/:id/post') @RequirePermissions('purchase_invoice:post')
  postInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.postInvoice(user, id); }
  @Post('invoices/:id/cancel') @RequirePermissions('purchase_invoice:cancel')
  cancelInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.cancelInvoice(user, id, dto); }
  @Post('invoices/:id/approve') @RequirePermissions('purchase_invoice:approve')
  approveInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.approveDocument(user, 'invoice', id); }

  @Get('returns') @RequirePermissions('purchase_return:view')
  findReturns(@CurrentUser() user: AuthUser, @Query() query: PaginationParams & Record<string, any>) { return this.purchasesService.findAll(user, query, 'returns'); }
  @Get('returns/:id') @RequirePermissions('purchase_return:view')
  getReturn(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.findOne(user, 'returns', id); }
  @Post('returns') @RequirePermissions('purchase_return:create')
  createReturn(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.purchasesService.createReturn(user, dto); }
  @Post('returns/:id/post') @RequirePermissions('purchase_return:post')
  postReturn(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.postReturn(user, id); }
  @Post('returns/:id/cancel') @RequirePermissions('purchase_return:cancel')
  cancelReturn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) { return this.purchasesService.cancelGeneric(user, 'return', id, dto); }

  @Get('payments') @RequirePermissions('purchase_payment:view')
  findPayments(@CurrentUser() user: AuthUser, @Query() query: PaginationParams & Record<string, any>) { return this.purchasesService.findAll(user, query, 'payments'); }
  @Get('payments/:id') @RequirePermissions('purchase_payment:view')
  getPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.findOne(user, 'payments', id); }
  @Post('payments') @RequirePermissions('purchase_payment:create')
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.purchasesService.createPayment(user, dto); }

  @Get(':documentType/:documentId/attachments') @RequirePermissions('purchase_attachment:view')
  listAttachments(@CurrentUser() user: AuthUser, @Param('documentType') documentType: string, @Param('documentId') documentId: string) { return this.purchasesService.listAttachments(user, documentType, documentId); }
  @Post(':documentType/:documentId/attachments') @RequirePermissions('purchase_attachment:create')
  addAttachment(@CurrentUser() user: AuthUser, @Param('documentType') documentType: string, @Param('documentId') documentId: string, @Body() dto: any) { return this.purchasesService.addAttachment(user, documentType, documentId, dto); }
  @Delete('attachments/:id') @RequirePermissions('purchase_attachment:delete')
  deleteAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.purchasesService.deleteAttachment(user, id); }
}

import { Controller, Get, Param, Post, Body, Query, UploadedFile, UseGuards, UseInterceptors, Res, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantResolverGuard } from '../../tenancy/tenant-resolver.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@nirvagam/shared';
import { ImportExportService } from './import-export.service';

@UseGuards(JwtAuthGuard, TenantResolverGuard, PermissionsGuard)
@Controller('import-export')
export class ImportExportController {
  constructor(private readonly service: ImportExportService) {}

  @Get('adapters')
  @RequirePermissions('product:view')
  adapters() { return this.service.adapters(); }

  @Get('templates/:operation')
  @RequirePermissions('product:view')
  template(@CurrentUser() user: AuthUser, @Param('operation') operation: string, @Query('templateType') templateType = 'mixed', @Res() response: Response) {
    const result = this.service.template(user, operation, templateType);
    return result.then((file) => {
      response.setHeader('Content-Type', file.contentType);
      response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      return response.send(file.body);
    });
  }

  @Post('inventory/catalog/validate')
  @RequirePermissions('product:create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  validateCatalog(@CurrentUser() user: AuthUser, @UploadedFile() file: { originalname: string; size: number; buffer: Buffer }, @Body() body: { templateType?: string }) {
    return this.validateFile(user, 'catalog', file, body.templateType);
  }

  @Post('inventory/movements/validate')
  @RequirePermissions('inventory:edit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  validateMovements(@CurrentUser() user: AuthUser, @UploadedFile() file: { originalname: string; size: number; buffer: Buffer }) {
    return this.validateFile(user, 'movements', file);
  }

  @Post('inventory/transfers/validate')
  @RequirePermissions('inventory:edit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  validateTransfers(@CurrentUser() user: AuthUser, @UploadedFile() file: { originalname: string; size: number; buffer: Buffer }) {
    return this.validateFile(user, 'transfers', file);
  }

  private validateFile(user: AuthUser, operation: string, file: { originalname: string; size: number; buffer: Buffer }, templateType?: string) {
    if (!file) throw new BadRequestException('An Excel (.xlsx) file is required');
    return this.service.validate(user, operation, file, templateType);
  }

  @Post(':id/confirm')
  @RequirePermissions('product:create')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { mode?: string; allowPartial?: boolean }) {
    return this.service.confirm(user, id, body);
  }

  @Post(':id/cancel')
  @RequirePermissions('product:create')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.cancel(user, id); }

  @Post(':id/retry')
  @RequirePermissions('product:create')
  retry(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.retry(user, id); }

  @Get('jobs')
  @RequirePermissions('product:view')
  jobs(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('limit') limit?: string) { return this.service.jobs(user, Number(page) || 1, Number(limit) || 20); }

  @Get('jobs/:id')
  @RequirePermissions('product:view')
  job(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.job(user, id); }

  @Get('jobs/:id/errors')
  @RequirePermissions('product:view')
  errors(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() response: Response) {
    return this.service.errorReport(user, id).then((result) => {
      response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      response.setHeader('Content-Disposition', `attachment; filename="import-errors-${id}.xlsx"`);
      return response.send(result);
    });
  }

}

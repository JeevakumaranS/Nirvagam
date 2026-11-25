import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantResolverGuard } from '../../tenancy/tenant-resolver.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Business Analytics & Statutory Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantResolverGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions('report:view', 'report:access_reports')
  @ApiOperation({ summary: 'Real-time dashboard executive KPIs' })
  async getDashboardKpis(@CurrentUser() user: AuthUser) {
    return this.reportsService.getDashboardKpis(user.businessId, user.branchId);
  }

  @Get('gst')
  @RequirePermissions('gst_report:view', 'gst_report:access_reports')
  @ApiOperation({ summary: 'GSTR-1 and GSTR-3B tax data breakdown' })
  async getGstReport(@CurrentUser() user: AuthUser) {
    return this.reportsService.getGstReport(user.businessId, user.branchId);
  }
}

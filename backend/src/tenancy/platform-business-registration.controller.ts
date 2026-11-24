import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '@nirvagam/shared';
import { SaveBusinessProfileDto } from './dto/save-business-profile.dto';
import { PlatformBusinessRegistrationService } from './platform-business-registration.service';

@ApiTags('Platform Business Registration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard, PlatformPermissionsGuard)
@Controller('platform/business-registration')
export class PlatformBusinessRegistrationController {
  constructor(private readonly registration: PlatformBusinessRegistrationService) {}

  @Get()
  @RequirePlatformPermissions('platform_tenants:view')
  @ApiOperation({ summary: 'List platform tenants, plans, and registered business profiles' })
  getWorkspace() {
    return this.registration.getWorkspace();
  }

  @Post()
  @RequirePlatformPermissions('platform_tenants:manage')
  @ApiOperation({ summary: 'Register a business profile for a platform tenant' })
  create(@Body() dto: SaveBusinessProfileDto, @CurrentUser() user: AuthUser) {
    return this.registration.create(dto, user);
  }

  @Put(':profileId')
  @RequirePlatformPermissions('platform_tenants:manage')
  @ApiOperation({ summary: 'Update a platform business profile and its branches' })
  update(
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: SaveBusinessProfileDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.registration.update(profileId, dto, user);
  }

  @Delete(':profileId')
  @RequirePlatformPermissions('platform_tenants:manage')
  @ApiOperation({ summary: 'Delete a platform business profile' })
  delete(@Param('profileId', ParseUUIDPipe) profileId: string, @CurrentUser() user: AuthUser) {
    return this.registration.delete(profileId, user);
  }
}

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
import { SaveBusinessProfileDto } from './dto/save-business-profile.dto';
import { PlatformBusinessRegistrationService } from './platform-business-registration.service';

@ApiTags('Platform Business Registration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform/business-registration')
export class PlatformBusinessRegistrationController {
  constructor(private readonly registration: PlatformBusinessRegistrationService) {}

  @Get()
  @ApiOperation({ summary: 'List platform tenants, plans, and registered business profiles' })
  getWorkspace() {
    return this.registration.getWorkspace();
  }

  @Post()
  @ApiOperation({ summary: 'Register a business profile for a platform tenant' })
  create(@Body() dto: SaveBusinessProfileDto) {
    return this.registration.create(dto);
  }

  @Put(':profileId')
  @ApiOperation({ summary: 'Update a platform business profile and its branches' })
  update(
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: SaveBusinessProfileDto
  ) {
    return this.registration.update(profileId, dto);
  }

  @Delete(':profileId')
  @ApiOperation({ summary: 'Delete a platform business profile' })
  delete(@Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.registration.delete(profileId);
  }
}

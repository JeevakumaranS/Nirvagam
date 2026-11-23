import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@nirvagam/shared';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new business organization, admin user and initialize workspace' })
  @ApiResponse({ status: 201, description: 'Organization registered successfully with JWT tokens' })
  @ApiResponse({ status: 409, description: 'Slug or Email already registered' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully, returns JWT access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or suspended tenant' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and exchange refresh token for new access and refresh tokens' })
  @ApiResponse({ status: 200, description: 'New token pair generated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile, active business, and assigned branch' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.id, user.platformAdmin);
  }
}

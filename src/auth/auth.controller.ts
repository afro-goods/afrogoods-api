import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterWithCartDto } from './dto/register-with-cart.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { FirebaseRegisterGuard } from './guards/firebase-register.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(FirebaseRegisterGuard)
  async register(
    @Body() registerDto: RegisterDto,
    @CurrentUser('firebaseUid') firebaseUid: string,
  ) {
    return this.authService.register(registerDto, firebaseUid);
  }

  @Post('register-with-cart')
  @UseGuards(FirebaseRegisterGuard)
  async registerWithCart(
    @Body() registerDto: RegisterWithCartDto,
    @CurrentUser('firebaseUid') firebaseUid: string,
  ) {
    return this.authService.registerWithCartTransfer(registerDto, firebaseUid);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /** POST /auth/forgot-password - Request password reset email */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }
}

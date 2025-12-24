import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from 'src/users/schemas/user.schema';
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  getMe(@CurrentUser() user: User) {
    return {
      id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phoneNumber: user.phoneNumber,
      address: user.address,
      createdAt: user.createdAt,
    };
  }
}

import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { UsersService } from '../users/users.service';
import { EmailQueueService } from '../queue/services/email-queue.service';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { UserRole } from 'src/users/interfaces/user.interface';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject('FIREBASE_ADMIN') private firebaseAdmin: typeof admin,
    private usersService: UsersService,
    private emailQueueService: EmailQueueService,
  ) { }

  async register(registerDto: RegisterDto, firebaseUid: string) {
    try {
      const { email, username } = registerDto;

      const existingUser =
        await this.usersService.findByFirebaseUid(firebaseUid);
      if (existingUser) {
        throw new ConflictException('User already registered');
      }

      if (registerDto.username) {
        const trimmedUsername = registerDto.username.trim();
        const usernameExists =
          await this.usersService.findByUsernameOrEmail(trimmedUsername);
        if (usernameExists && usernameExists.username === username) {
          throw new ConflictException('Username already exists');
        }
      }

      const emailExists = await this.usersService.findByUsernameOrEmail(email);
      if (
        emailExists &&
        emailExists.email &&
        emailExists.email.toLowerCase() === email
      ) {
        throw new ConflictException('Email already exists');
      }

      const user = await this.usersService.createUser({
        firebaseUid,
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        username: registerDto.username,
        phoneNumber: registerDto.phoneNumber,
        role: UserRole.USER,
        address: registerDto.address,
      });

      // Send welcome email asynchronously
      await this.emailQueueService.sendWelcomeEmail({
        email: user.email,
        name: user.firstName || user.username || 'User',
      });

      return {
        message: 'User registered successfully',
        user,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Registration failed');
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const { idToken } = loginDto;

      const decodedToken = await this.firebaseAdmin
        .auth()
        .verifyIdToken(idToken);

      const user = await this.usersService.findByFirebaseUid(decodedToken.uid);

      if (!user) {
        throw new UnauthorizedException(
          'User not found. Please complete registration.',
        );
      }

      await this.usersService.updateLastLogin(decodedToken.uid);

      return {
        message: 'Login successful',
        user,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Request password reset: find user by email, generate Firebase reset link, send email.
   * Always returns success to avoid leaking whether the email exists.
   */
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByUsernameOrEmail(dto.email);
    if (!user || !user.email || user.email.toLowerCase() !== dto.email.toLowerCase()) {
      return { message: 'If an account exists with this email, you will receive a password reset link.' };
    }

    try {
      const resetLink = await this.firebaseAdmin.auth().generatePasswordResetLink(dto.email);
      const name = user.firstName || 'there';
      await this.emailQueueService.sendPasswordResetEmail({
        email: user.email,
        token: resetLink,
        name,
      });
    } catch {
      // Don't leak errors; return same message
    }
    return { message: 'If an account exists with this email, you will receive a password reset link.' };
  }
}

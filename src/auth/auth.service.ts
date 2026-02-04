import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterWithCartDto } from './dto/register-with-cart.dto';
import { LoginWithCartDto } from './dto/login-with-cart.dto';
import { UserRole } from 'src/users/interfaces/user.interface';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject('FIREBASE_ADMIN') private firebaseAdmin: typeof admin,
    private usersService: UsersService,
  ) {}

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

  async registerWithCartTransfer(
    registerDto: RegisterWithCartDto,
    firebaseUid: string,
  ) {
    const registrationResult = await this.register(registerDto, firebaseUid);

    // Cart transfer is now handled by frontend sending cart items directly
    // No server-side guest session cart to merge
    return {
      ...registrationResult,
      cartMerged: false,
    };
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

  async loginWithCartMerge(loginDto: LoginWithCartDto) {
    // Perform regular login - cart is now managed client-side
    const loginResult = await this.login(loginDto);

    return {
      ...loginResult,
      cartMerged: false,
    };
  }

  /**
   * Create account during checkout with cart transfer
   */
  async createAccountWithCartTransfer(
    registerDto: RegisterWithCartDto,
    firebaseUid: string,
    guestOrderIds?: string[],
  ) {
    // Register user with cart transfer
    const registrationResult = await this.registerWithCartTransfer(
      registerDto,
      firebaseUid,
    );

    // TODO: If guest order IDs are provided, associate them with the new user
    // This would be implemented when order association is needed
    if (guestOrderIds && guestOrderIds.length > 0) {
      this.logger.log(
        `Guest orders ${guestOrderIds.join(', ')} should be associated with user ${registrationResult.user._id.toString()}`,
      );
      // Future implementation: Associate guest orders with user account
    }

    return {
      ...registrationResult,
      guestOrdersTransferred: guestOrderIds?.length || 0,
    };
  }

  async logout(firebaseUid: string) {
    try {
      await this.firebaseAdmin.auth().revokeRefreshTokens(firebaseUid);
      return { message: 'Logout successful' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Logout failed');
    }
  }
}

import { Controller, Post, Body, Req, UseGuards, Get, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import fetch from 'node-fetch';

@Controller('auth')
export class AuthController {
  constructor(private usersService: UsersService) { }

  // Endpoint to get current user info
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async me(@Req() req) {
    let user = await this.usersService.findByFirebaseUid(req.user.firebaseUid);

    if (!user) {
      user = await this.usersService.create({
        firebaseUid: req.user.firebaseUid,
        email: req.user.email,
        role: req.user.role,
        firstName: req.user.firstName || 'First',
        lastName: req.user.lastName || 'Last',
      });
    }

    return user;
  }

  // Login endpoint using username or email + password
  @Post('login')
  async login(
    @Body('identifier') identifier: string,
    @Body('password') password: string,
  ) {
    if (!identifier || !password) {
      throw new UnauthorizedException('Username/email and password are required');
    }

    // Lookup user in MongoDB
    const user = await this.usersService.findByUsernameOrEmail(identifier);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Use Firebase REST API to verify credentials
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email, // Firebase requires email
          password,
          returnSecureToken: true,
        }),
      },
    );

    const data = await response.json();

    if (data.error) {
      throw new UnauthorizedException(data.error.message);
    }

    // Return Firebase ID token and MongoDB user info
    return {
      token: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      user,
    };
  }

  // 🔹 New register endpoint for first-time users
  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('firstName') firstName: string,
    @Body('lastName') lastName: string,
    @Body('username') username?: string,
    @Body('address') address?: string,
  ) {
    if (!email || !password || !firstName || !lastName) {
      throw new BadRequestException('Email, password, firstName, and lastName are required');
    }

    // Check if user already exists
    const existingUser = await this.usersService.findByUsernameOrEmail(username || email);
    if (existingUser) {
      throw new BadRequestException('User with this email or username already exists');
    }

    // Create user in Firebase Auth
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      },
    );
    const firebaseData = await response.json();
    if (firebaseData.error) {
      throw new BadRequestException(firebaseData.error.message);
    }

    // Save user in MongoDB
    const user = await this.usersService.create({
      firebaseUid: firebaseData.localId,
      email,
      role: 'user',
      firstName,
      lastName,
      username,
      address,
    });

    // Return Firebase ID token and MongoDB user info
    return {
      token: firebaseData.idToken,
      refreshToken: firebaseData.refreshToken,
      expiresIn: firebaseData.expiresIn,
      user,
    };
  }
}

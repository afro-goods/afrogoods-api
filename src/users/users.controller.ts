import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserRole } from './interfaces/user.interface';
import { User } from './schemas/user.schema';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return {
      id: user._id.toString(),
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

  @Patch('me')
  async updateMe(@CurrentUser() user: User, @Body() updateDto: UpdateUserDto) {
    const updated = await this.usersService.updateUser(
      user._id.toString(),
      updateDto,
    );
    return {
      id: updated._id.toString(),
      email: updated.email,
      username: updated.username,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      phoneNumber: updated.phoneNumber,
      address: updated.address,
      createdAt: updated.createdAt,
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: GetUsersQueryDto) {
    return this.usersService.findAll(query, query.role, query.search);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUser(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {
    const updated = await this.usersService.updateUser(id, updateDto);
    return {
      id: updated._id.toString(),
      email: updated.email,
      username: updated.username,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      phoneNumber: updated.phoneNumber,
      address: updated.address,
      createdAt: updated.createdAt,
    };
  }
}

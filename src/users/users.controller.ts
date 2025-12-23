import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserRole } from './interfaces/user.interface';
import { User } from './schemas/user.schema';
import { PaginationDto } from 'src/shared/services/pagination/dto/pagination.dto';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(
    @Query() pagination: PaginationDto,
    @Query('role') role?: UserRole,
    @CurrentUser() currentUser?: User,
  ) {
    console.log(
      `Admin access granted for user: ${currentUser?.email} (Role: ${currentUser?.role})`,
    );

    return this.usersService.findAll(pagination, role);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdvertsService } from './adverts.service';
import { CreateAdvertDto } from './dto/create-advert.dto';
import { UpdateAdvertDto } from './dto/update-advert.dto';
import { ReviewAdvertDto } from './dto/approve-advert.dto';
import { AdvertQueryDto } from './dto/advert-query.dto';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/users/interfaces/user.interface';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/users/schemas/user.schema';

@Controller('adverts')
@UseGuards(FirebaseAuthGuard)
export class AdvertsController {
  constructor(private readonly advertsService: AdvertsService) {}

  /** ---------------- Customer Endpoints ---------------- */

  @Post()
  async create(@Body() dto: CreateAdvertDto, @CurrentUser() user: User) {
    return this.advertsService.create(dto, user._id.toString());
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdvertDto,
    @CurrentUser() user: User,
  ) {
    return this.advertsService.update(id, dto, user._id.toString());
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.advertsService.remove(id, user._id.toString());
  }

  @Get('me')
  async myAdverts(@CurrentUser() user: User) {
    const query = new AdvertQueryDto();
    query.page = 1;
    query.limit = 50;
    query.owner = user._id.toString();
    return this.advertsService.findAll(query);
  }

  /** ---------------- Admin Endpoints ---------------- */

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/review')
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewAdvertDto,
    @CurrentUser() admin: User,
  ) {
    return this.advertsService.review(id, dto, admin._id.toString());
  }

  /** ---------------- Hub / Public Endpoints ---------------- */

  @Get()
  async findAll(@Query() query: AdvertQueryDto) {
    return this.advertsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.advertsService.findOne(id);
  }
}

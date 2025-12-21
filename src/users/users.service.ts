import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { UserRole } from './interfaces/user.interface';
import { CreateUserDto } from './dtos/create-user.dto';
import { PaginationOptions } from 'src/shared/services/pagination/interfaces/pagination.interface';
import { PaginationService } from 'src/shared/services/pagination/services/pagination.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private paginationService: PaginationService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const user = new this.userModel(createUserDto);
      return await user.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('User already exists');
      }
      throw error;
    }
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.userModel.findOne({ firebaseUid }).lean().exec();
  }

  async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    const trimmed = identifier.trim();

    return this.userModel
      .findOne({
        $or: [{ username: trimmed }, { email: trimmed.toLowerCase() }],
      })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAll(pagination: PaginationOptions<User>, role?: UserRole) {
    const filter: Record<string, any> = {};

    if (role) {
      filter.role = role;
    }

    return this.paginationService.paginate<User>(this.userModel, {
      ...pagination,
      filter,
      sort: { createdAt: -1 },
    });
  }

  async updateLastLogin(firebaseUid: string): Promise<void> {
    await this.userModel
      .findOneAndUpdate({ firebaseUid }, { lastLoginAt: new Date() })
      .exec();
  }

  async verifyEmail(firebaseUid: string): Promise<User> {
    const user = await this.userModel
      .findOneAndUpdate({ firebaseUid }, { emailVerified: true }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}

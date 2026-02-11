import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { User } from './schemas/user.schema';
import { UserRole } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationOptions } from 'src/shared/services/pagination/interfaces/pagination.interface';
import { PaginationService } from 'src/shared/services/pagination/services/pagination.service';
import { inTransaction } from 'src/utilities/transaction';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectConnection() private readonly connection: Connection,
    private paginationService: PaginationService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    return await inTransaction(this.connection, async (session) => {
      const user = new this.userModel({
        ...createUserDto,
      });

      await user.save({ session });

      return user;
    });
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

  async findAll(
    pagination: PaginationOptions<User>,
    role?: UserRole,
    search?: string,
  ) {
    const filter: Record<string, any> = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
      ];
    }

    return this.paginationService.paginate<User>(this.userModel, {
      ...pagination,
      filter,
      sort: { createdAt: -1 },
    });
  }

  async updateLastLogin(firebaseUid: string): Promise<void> {
    await this.userModel
      .findOneAndUpdate({ firebaseUid }, { lastLogin: new Date() })
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

  async updateUser(id: string, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: updateDto }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserByFirebaseUid(
    firebaseUid: string,
    updateDto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.userModel
      .findOneAndUpdate({ firebaseUid }, { $set: updateDto }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}

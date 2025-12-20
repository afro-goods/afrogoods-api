import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  findByFirebaseUid(firebaseUid: string) {
    return this.userModel.findOne({ firebaseUid }).exec();
  }

  findByUsernameOrEmail(identifier: string) {
    return this.userModel.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    }).exec();
  }

  create(data: Partial<User>) {
    return this.userModel.create(data);
  }

  findAll() {
    return this.userModel.find().exec();
  }
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, required: true })
  firebaseUid: string;

  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role: 'user' | 'admin';

  // Common fields
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop()
  address?: string;

  // Only for normal users
  @Prop({ unique: true, sparse: true })
  username?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

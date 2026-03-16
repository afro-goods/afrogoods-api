import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '../enum/user.enum';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ type: String, required: true, unique: true })
  firebaseUid: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({ type: String })
  address?: string;

  @Prop({ type: String, unique: true, sparse: true })
  username?: string;

  @Prop({ type: String })
  photoUrl?: string;

  @Prop({ type: String })
  phoneNumber?: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: Boolean, default: false })
  emailVerified: boolean;

  @Prop({ type: Date })
  lastLogin?: Date;

  @Prop({ type: Date })
  adminPreviousLoginAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for efficient lookups
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  username: 'text',
});
UserSchema.index({ createdAt: -1 });

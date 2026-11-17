import { Schema, model, type HydratedDocument } from 'mongoose';

export type Role = 'user' | 'admin';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    interests: {
      type: [String],
      default: [],
      // Keep grouping consistent: trim, lowercase, and remove duplicates.
      set: (values: string[]) => [
        ...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean)),
      ],
    },
  },
  { timestamps: true },
);

// Login lookup (User.findOne({ email })) and unique-email enforcement.
userSchema.index({ email: 1 }, { unique: true });
// Interests aggregation: $match on a specific interest. Multikey because interests is an array.
userSchema.index({ interests: 1 });

// Defense in depth: passwordHash is also select:false.
userSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = model<IUser>('User', userSchema);

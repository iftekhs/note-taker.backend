import { Schema, Types, model, type HydratedDocument } from 'mongoose';

export interface IPost {
  author: Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PostDocument = HydratedDocument<IPost>;

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 50000 },
  },
  { timestamps: true },
);

// $lookup of posts by user, and a user's posts listing, newest first.
postSchema.index({ author: 1, _id: -1 });

postSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

export const Post = model<IPost>('Post', postSchema);

import { Schema, Types, model, type HydratedDocument } from 'mongoose';

export interface INote {
  owner: Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NoteDocument = HydratedDocument<INote>;

const noteSchema = new Schema<INote>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 50000 },
  },
  { timestamps: true },
);

// Own-notes listing, newest first. Also serves the admin ?owner= filter.
noteSchema.index({ owner: 1, _id: -1 });

noteSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

export const Note = model<INote>('Note', noteSchema);

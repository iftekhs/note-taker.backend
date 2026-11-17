import type { RequestHandler } from 'express';
import { Types, type QueryFilter } from 'mongoose';
import { authUser } from '../middleware/authenticate.js';
import { Note, type INote } from '../models/Note.js';
import { ApiError } from '../utils/ApiError.js';
import { paginated, paginationParams } from '../utils/pagination.js';
import type { CreateNoteInput, NoteListQuery, UpdateNoteInput } from '../validators/note.validators.js';

export const listNotes: RequestHandler = async (req, res) => {
  const user = authUser(req);
  const { page, limit, owner } = req.validated.query as NoteListQuery;
  const { skip } = paginationParams({ page, limit });

  const filter: QueryFilter<INote> = {};
  if (user.role === 'admin') {
    if (owner) filter.owner = new Types.ObjectId(owner);
  } else {
    filter.owner = user._id;
  }

  const [notes, total] = await Promise.all([
    Note.find(filter).select('-__v').sort({ _id: -1 }).skip(skip).limit(limit).lean(),
    Note.countDocuments(filter),
  ]);

  res.json(paginated(notes, page, limit, total));
};

export const getNote: RequestHandler = async (req, res) => {
  const user = authUser(req);
  const { id } = req.validated.params as { id: string };

  const note = await Note.findById(id).select('-__v');
  if (!note) throw new ApiError(404, 'Note not found');

  const isOwner = note.owner.equals(user._id);
  if (!isOwner && user.role !== 'admin') throw new ApiError(403, 'Forbidden');

  res.json({ data: note });
};

export const createNote: RequestHandler = async (req, res) => {
  const user = authUser(req);
  const { title, content } = req.validated.body as CreateNoteInput;

  const note = await Note.create({ owner: user._id, title, content });
  res.status(201).json({ data: note });
};

export const updateNote: RequestHandler = async (req, res) => {
  const user = authUser(req);
  const { id } = req.validated.params as { id: string };
  const updates = req.validated.body as UpdateNoteInput;

  const note = await Note.findById(id);
  if (!note) throw new ApiError(404, 'Note not found');
  if (!note.owner.equals(user._id)) throw new ApiError(403, 'Forbidden');

  note.set(updates);
  await note.save();

  res.json({ data: note });
};

export const deleteNote: RequestHandler = async (req, res) => {
  const user = authUser(req);
  const { id } = req.validated.params as { id: string };

  const note = await Note.findById(id);
  if (!note) throw new ApiError(404, 'Note not found');
  if (!note.owner.equals(user._id)) throw new ApiError(403, 'Forbidden');

  await note.deleteOne();
  res.status(204).send();
};

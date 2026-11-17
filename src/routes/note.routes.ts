import { Router } from 'express';
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from '../controllers/note.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validators.js';
import {
  createNoteSchema,
  noteListQuerySchema,
  updateNoteSchema,
} from '../validators/note.validators.js';

export const noteRouter = Router();

noteRouter.use(authenticate);

noteRouter.post('/', validate({ body: createNoteSchema }), createNote);
noteRouter.get('/', validate({ query: noteListQuerySchema }), listNotes);
noteRouter.get('/:id', validate({ params: idParamSchema }), getNote);
noteRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: updateNoteSchema }),
  updateNote,
);
noteRouter.delete('/:id', validate({ params: idParamSchema }), deleteNote);

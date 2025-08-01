import express from 'express';
import { getAll, getById, create, update, remove } from '../controllers/userController';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserSchema } from '../schemas/userSchema';

const router = express.Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', validate(createUserSchema), create);
router.put('/:id', validate(updateUserSchema), update);
router.delete('/:id', remove);

export default router;
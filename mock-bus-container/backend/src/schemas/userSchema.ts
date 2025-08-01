import { z } from 'zod';

const userBodySchema = z.object({
    username: z.string().min(3, 'Имя пользователя должно быть не менее 3 символов'),
    password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
    roles: z.array(z.string()).optional(),
});

// Схема для создания (все поля обязательны)
export const createUserSchema = z.object({
    body: userBodySchema,
});

// Схема для обновления (все поля в body необязательны)
export const updateUserSchema = z.object({
    body: userBodySchema.partial(),
});

import { z } from 'zod';

export const applicationSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Имя приложения обязательно'),
        description: z.string().optional(),
    }),
});

import { z } from 'zod';

export const processSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Имя процесса обязательно'),
        description: z.string().optional(),
        applicationId: z.string().min(1, 'ID приложения обязательно'),
    }),
});

import { z } from 'zod';

export const createChannelSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Имя канала обязательно'),
        processId: z.string().min(1, 'ID процесса обязательно'),
        direction: z.enum(['inbound', 'outbound']),
    }),
});
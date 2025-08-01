import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const formattedErrors = err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: formattedErrors,
      });
    }
    // Для всех остальных ошибок
    return res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
};

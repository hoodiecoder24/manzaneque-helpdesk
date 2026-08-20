import { z } from 'zod';

export const serialParamSchema = z.object({
  serial: z.string().trim().min(1).max(60)
});

export const similarQuerySchema = z.object({
  problemTypeId: z.coerce.number().int().positive()
});

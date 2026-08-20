import { z } from 'zod';

export const problemTypeCreateSchema = z.object({
  typeName: z.string().trim().min(1).max(100),
  parentTypeId: z.coerce.number().int().positive().optional().nullable()
});

export const problemTypeUpdateSchema = problemTypeCreateSchema.partial();

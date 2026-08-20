import { z } from 'zod';

export const dateRangeQuerySchema = z.object({
  dateFrom: z.string().trim().date().optional(),
  dateTo: z.string().trim().date().optional()
});

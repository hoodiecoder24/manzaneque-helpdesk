import { z } from 'zod';

// Mirrors DDL constraints (server/db-layer validation, one of the three
// levels evidenced per ARCHITECTURE.md §4.3): VARCHAR lengths, email
// format, FK ids required as positive integers.
export const employeeCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(120),
  phoneExtension: z.string().trim().max(10).optional().nullable(),
  departmentId: z.coerce.number().int().positive(),
  jobTitleId: z.coerce.number().int().positive(),
  isActive: z.coerce.boolean().default(true)
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

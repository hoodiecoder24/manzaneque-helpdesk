import { z } from 'zod';

// Serial numbers are asset-tag style: letters, digits, hyphens only.
const serialNumber = z.string().trim().min(1).max(60).regex(
  /^[A-Za-z0-9-]+$/,
  'Serial number may only contain letters, digits and hyphens'
);

export const equipmentCreateSchema = z.object({
  serialNumber,
  equipmentTypeId: z.coerce.number().int().positive(),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  purchaseDate: z.string().trim().date().optional().nullable(),
  assignedEmployeeId: z.coerce.number().int().positive().optional().nullable(),
  isRetired: z.coerce.boolean().default(false)
});

export const equipmentUpdateSchema = equipmentCreateSchema.partial();

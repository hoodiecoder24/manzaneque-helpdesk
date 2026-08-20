import { z } from 'zod';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export const problemCreateSchema = z.object({
  callerEmployeeId: z.coerce.number().int().positive(),
  equipmentId: z.coerce.number().int().positive(),
  problemTypeId: z.coerce.number().int().positive(),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  notes: z.string().trim().min(1).max(5000)
});

export const problemListQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  problemTypeId: z.coerce.number().int().positive().optional(),
  callerEmployeeId: z.coerce.number().int().positive().optional(),
  equipmentId: z.coerce.number().int().positive().optional(),
  assignedStaffId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().trim().date().optional(),
  dateTo: z.string().trim().date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const followUpCallSchema = z.object({
  notes: z.string().trim().min(1).max(5000)
});

export const reclassifySchema = z.object({
  problemTypeId: z.coerce.number().int().positive()
});

export const resolveSchema = z.object({
  resolutionNotes: z.string().trim().min(1).max(5000)
});

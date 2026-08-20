import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody, validateParams, idParamsSchema } from '../validators/common.js';
import { employeeCreateSchema, employeeUpdateSchema } from '../validators/employee.validators.js';
import * as employeeController from '../controllers/employee.controller.js';

// Admin screen CRUD (ARCHITECTURE.md §4.2). Reads are also needed by
// OPERATOR/SPECIALIST for the Problem Detail and Log a Call context.
const router = Router();

router.get('/', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), employeeController.listEmployees);
router.get('/:id', requireAuth, requireRole('OPERATOR', 'SPECIALIST', 'ANALYST', 'ADMIN'), validateParams(idParamsSchema), employeeController.getEmployee);
router.post('/', requireAuth, requireRole('ADMIN'), validateBody(employeeCreateSchema), employeeController.createEmployee);
router.put('/:id', requireAuth, requireRole('ADMIN'), validateParams(idParamsSchema), validateBody(employeeUpdateSchema), employeeController.updateEmployee);
router.delete('/:id', requireAuth, requireRole('ADMIN'), validateParams(idParamsSchema), employeeController.deleteEmployee);

export default router;

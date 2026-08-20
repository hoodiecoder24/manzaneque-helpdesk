import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as referenceDataController from '../controllers/referenceData.controller.js';

// All four resources are read-only reference data, open to any
// authenticated role — every screen's dropdowns need at least one of them.
const router = Router();

router.get('/departments', requireAuth, referenceDataController.getDepartments);
router.get('/job-titles', requireAuth, referenceDataController.getJobTitles);
router.get('/equipment-types', requireAuth, referenceDataController.getEquipmentTypes);
router.get('/software', requireAuth, referenceDataController.getSoftware);
router.get('/staff', requireAuth, referenceDataController.getStaff);

export default router;

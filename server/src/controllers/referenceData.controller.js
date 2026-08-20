import { asyncHandler } from '../utils/asyncHandler.js';
import * as referenceDataService from '../services/referenceData.service.js';

export const getDepartments = asyncHandler(async (req, res) => res.json(await referenceDataService.listDepartments()));
export const getJobTitles = asyncHandler(async (req, res) => res.json(await referenceDataService.listJobTitles()));
export const getEquipmentTypes = asyncHandler(async (req, res) => res.json(await referenceDataService.listEquipmentTypes()));
export const getSoftware = asyncHandler(async (req, res) => res.json(await referenceDataService.listSoftware()));
export const getStaff = asyncHandler(async (req, res) => res.json(await referenceDataService.listStaff()));

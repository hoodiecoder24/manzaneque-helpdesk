import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as lookupService from '../services/lookup.service.js';

export const lookupCaller = asyncHandler(async (req, res, next) => {
  const caller = await lookupService.lookupCaller(req.params.employeeId);
  if (!caller) return next(ApiError.notFound('No employee with that ID'));
  res.json(caller);
});

export const lookupEquipment = asyncHandler(async (req, res, next) => {
  const equipment = await lookupService.lookupEquipmentBySerial(req.params.serial);
  if (!equipment) return next(ApiError.notFound('No equipment with that serial number'));
  res.json(equipment);
});

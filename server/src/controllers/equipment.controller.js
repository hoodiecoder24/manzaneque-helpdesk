import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as equipmentService from '../services/equipment.service.js';

export const listEquipment = asyncHandler(async (req, res) => res.json(await equipmentService.listEquipment()));

export const getEquipment = asyncHandler(async (req, res, next) => {
  const equipment = await equipmentService.getEquipment(req.params.id);
  if (!equipment) return next(ApiError.notFound('Equipment not found'));
  res.json(equipment);
});

export const createEquipment = asyncHandler(async (req, res) => {
  const equipment = await equipmentService.createEquipment(req.body);
  res.status(201).json(equipment);
});

export const updateEquipment = asyncHandler(async (req, res, next) => {
  const existing = await equipmentService.getEquipment(req.params.id);
  if (!existing) return next(ApiError.notFound('Equipment not found'));
  res.json(await equipmentService.updateEquipment(req.params.id, req.body));
});

export const deleteEquipment = asyncHandler(async (req, res, next) => {
  const existing = await equipmentService.getEquipment(req.params.id);
  if (!existing) return next(ApiError.notFound('Equipment not found'));
  await equipmentService.deleteEquipment(req.params.id);
  res.status(204).send();
});

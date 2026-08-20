import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as employeeService from '../services/employee.service.js';

export const listEmployees = asyncHandler(async (req, res) => res.json(await employeeService.listEmployees()));

export const getEmployee = asyncHandler(async (req, res, next) => {
  const employee = await employeeService.getEmployee(req.params.id);
  if (!employee) return next(ApiError.notFound('Employee not found'));
  res.json(employee);
});

export const createEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployee(req.body);
  res.status(201).json(employee);
});

export const updateEmployee = asyncHandler(async (req, res, next) => {
  const existing = await employeeService.getEmployee(req.params.id);
  if (!existing) return next(ApiError.notFound('Employee not found'));
  res.json(await employeeService.updateEmployee(req.params.id, req.body));
});

export const deleteEmployee = asyncHandler(async (req, res, next) => {
  const existing = await employeeService.getEmployee(req.params.id);
  if (!existing) return next(ApiError.notFound('Employee not found'));
  await employeeService.deleteEmployee(req.params.id);
  res.status(204).send();
});

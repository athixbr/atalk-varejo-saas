import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";

import CreateService from "../services/ScheduleServices/CreateService";
import ListService from "../services/ScheduleServices/ListService";
import UpdateService from "../services/ScheduleServices/UpdateService";
import ShowService from "../services/ScheduleServices/ShowService";
import DeleteService from "../services/ScheduleServices/DeleteService";

type IndexQuery = {
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  pageNumber?: string | number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, userId, pageNumber, searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { schedules, count, hasMore } = await ListService({
    searchParam,
    contactId,
    userId,
    pageNumber,
    companyId
  });

  return res.json({ schedules, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    body,
    sendAt,
    contactId,
    userId,
    mediaUrl,
    mediaType,
  } = req.body;
  const { companyId } = req.user;

  let schedule = await CreateService({
    body,
    sendAt,
    contactId,
    companyId,
    userId,
    mediaUrl,
    mediaType,
  });

  schedule = await ShowService(schedule.id, companyId)
  
  const io = getIO();
  io.emit(`company${companyId}-schedule`, {
    action: "create",
    schedule
  });

  return res.status(200).json(schedule);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  const schedule = await ShowService(scheduleId, companyId);

  return res.status(200).json(schedule);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { scheduleId } = req.params;
  const scheduleData = req.body;
  const { companyId } = req.user;

  const schedule = await UpdateService({ scheduleData, id: scheduleId, companyId });

  const io = getIO();
  io.emit(`company${companyId}-schedule`, {
    action: "update",
    schedule
  });

  return res.status(200).json(schedule);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  await DeleteService(scheduleId, companyId);

  const io = getIO();
  io.emit(`company${companyId}-schedule`, {
    action: "delete",
    scheduleId
  });

  return res.status(200).json({ message: "Schedule deleted" });
};

export const uploadMedia = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    throw new AppError("ERR_NO_FILE_SENT", 400);
  }

  const file = files[0];
  const mediaType = file.mimetype.split("/")[0]; // image, video, audio, application
  const relativePath = `/public/company${companyId}/schedules/${file.filename}`;

  return res.status(200).json({ mediaUrl: relativePath, mediaType, filename: file.originalname });
};

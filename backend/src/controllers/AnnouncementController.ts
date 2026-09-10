import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { head } from "lodash";
import fs from "fs";
import path from "path";

import ListService from "../services/AnnouncementService/ListService";
import CreateService from "../services/AnnouncementService/CreateService";
import ShowService from "../services/AnnouncementService/ShowService";
import UpdateService from "../services/AnnouncementService/UpdateService";
import DeleteService from "../services/AnnouncementService/DeleteService";
import FindService from "../services/AnnouncementService/FindService";
import FindAdminNotificationsService from "../services/AnnouncementService/FindAdminNotificationsService";
import ListAdminNotificationsService from "../services/AnnouncementService/ListAdminNotificationsService";
import DismissService from "../services/AnnouncementService/DismissService";
import MarkReadService from "../services/AnnouncementService/MarkReadService";

import Announcement from "../models/Announcement";

import AppError from "../errors/AppError";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  companyId: string | number;
};

type StoreData = {
  priority?: string;
  title: string;
  text?: string;
  status?: string;
  companyId: number;
  mediaPath?: string;
  mediaName?: string;
  tipo?: string;
  usuariosIds?: number[];
  departamentosIds?: number[];
  expirationDays?: number;
  expiresAt?: Date;
  scheduledAt?: Date | null;
};

type FindParams = {
  companyId: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const data = req.body as StoreData;

  // parse arrays enviados como JSON string (multipart form)
  if (typeof data.usuariosIds === "string") {
    try { data.usuariosIds = JSON.parse(data.usuariosIds as any); } catch { data.usuariosIds = []; }
  }
  if (typeof data.departamentosIds === "string") {
    try { data.departamentosIds = JSON.parse(data.departamentosIds as any); } catch { data.departamentosIds = []; }
  }

  const schema = Yup.object().shape({
    title: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (data.expirationDays && Number(data.expirationDays) > 0) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(data.expirationDays));
    data.expiresAt = expiresAt;
  }

  // scheduledAt: se vier vazio/null, manter nulo
  if (!data.scheduledAt) {
    data.scheduledAt = null;
  }

  // Arquivo enviado junto ao POST
  const files = req.files as Express.Multer.File[];
  let mediaPath: string | undefined;
  let mediaName: string | undefined;
  if (files && files.length > 0) {
    const file = files[0];
    mediaPath = file.filename.replace("/", "-");
    mediaName = file.originalname.replace("/", "-");
  }

  const record = await CreateService({
    ...data,
    companyId,
    createdByUserId: Number(userId),
    ...(mediaPath ? { mediaPath, mediaName } : {})
  } as any);

  const io = getIO();
  io.emit(`company-announcement`, {
    action: "create",
    record
  });

  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const record = await ShowService(id);

  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body as StoreData;

  // parse arrays enviados como JSON string (multipart form)
  if (typeof data.usuariosIds === "string") {
    try { data.usuariosIds = JSON.parse(data.usuariosIds as any); } catch { data.usuariosIds = []; }
  }
  if (typeof data.departamentosIds === "string") {
    try { data.departamentosIds = JSON.parse(data.departamentosIds as any); } catch { data.departamentosIds = []; }
  }

  const schema = Yup.object().shape({
    title: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (data.expirationDays && Number(data.expirationDays) > 0) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(data.expirationDays));
    data.expiresAt = expiresAt;
  }

  if (!data.scheduledAt) {
    data.scheduledAt = null;
  }

  // Arquivo enviado junto ao PUT
  const files = req.files as Express.Multer.File[];
  let mediaPath: string | undefined;
  let mediaName: string | undefined;
  if (files && files.length > 0) {
    const file = files[0];
    mediaPath = file.filename.replace("/", "-");
    mediaName = file.originalname.replace("/", "-");
  }

  const { id } = req.params;

  const record = await UpdateService({
    ...data,
    id,
    ...(mediaPath ? { mediaPath, mediaName } : {})
  } as any);

  const io = getIO();
  io.emit(`company-announcement`, {
    action: "update",
    record
  });

  return res.status(200).json(record);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  // Remover arquivo de mídia se existir
  try {
    const announcement = await Announcement.findByPk(id);
    if (announcement) {
      const rawPath = (announcement as any).getDataValue("mediaPath");
      if (rawPath) {
        const filePath = path.resolve("public", "announcements", rawPath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch (err) {
    console.error("Erro ao remover mídia da notificação:", err);
  }

  await DeleteService(id);

  const io = getIO();
  io.emit(`company-announcement`, {
    action: "delete",
    id
  });

  return res.status(200).json({ message: "Announcement deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const params = req.query as FindParams;
  const records: Announcement[] = await FindService(params);

  return res.status(200).json(records);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const announcement = await Announcement.findByPk(id);

    await announcement.update({
      mediaPath: file.filename.replace("/", "-"),
      mediaName: file.originalname.replace("/", "-")
    });
    await announcement.reload();

    const io = getIO();
    io.emit(`company-announcement`, {
      action: "update",
      record: announcement
    });

    return res.send({ mensagem: "Arquivo enviado" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const adminNotifications = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: userId, companyId } = req.user;

  const records = await FindAdminNotificationsService({
    userId: Number(userId),
    companyId: Number(companyId)
  });

  return res.status(200).json(records);
};

export const adminList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const { records, count } = await ListAdminNotificationsService({
    companyId: Number(companyId)
  });

  return res.status(200).json({ records, count });
};

export const dismiss = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: userId } = req.user;
  const announcementId = Number(req.params.id);

  const record = await DismissService({ announcementId, userId: Number(userId) });

  return res.status(200).json(record);
};

export const markRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: userId } = req.user;
  const announcementId = Number(req.params.id);

  const record = await MarkReadService({ announcementId, userId: Number(userId) });

  return res.status(200).json(record);
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  try {
    const announcement = await Announcement.findByPk(id);

    const rawPath = (announcement as any).getDataValue("mediaPath");
    if (rawPath) {
      const filePath = path.resolve("public", "announcements", rawPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await announcement.update({
      mediaPath: null,
      mediaName: null
    });
    await announcement.reload();

    const io = getIO();
    io.emit(`company-announcement`, {
      action: "update",
      record: announcement
    });

    return res.send({ mensagem: "Arquivo excluído" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

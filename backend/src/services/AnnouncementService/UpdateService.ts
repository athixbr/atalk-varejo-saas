import AppError from "../../errors/AppError";
import Announcement from "../../models/Announcement";

interface Data {
  id: number | string;
  priority?: string;
  title: string;
  text?: string;
  status?: string;
  companyId?: number;
  tipo?: string;
  usuariosIds?: number[];
  departamentosIds?: number[];
  expiresAt?: Date | null;
  scheduledAt?: Date | null;
  mediaPath?: string;
  mediaName?: string;
}

const UpdateService = async (data: Data): Promise<Announcement> => {
  const { id } = data;

  const record = await Announcement.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_ANNOUNCEMENT_FOUND", 404);
  }

  await record.update(data as any);

  return record;
};

export default UpdateService;

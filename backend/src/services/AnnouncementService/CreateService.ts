import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Announcement from "../../models/Announcement";

interface Data {
  priority?: string;
  title: string;
  text?: string;
  status?: string;
  companyId: number;
  tipo?: string;
  usuariosIds?: number[];
  departamentosIds?: number[];
  expiresAt?: Date;
  scheduledAt?: Date;
  createdByUserId?: number;
  mediaPath?: string;
  mediaName?: string;
}

const CreateService = async (data: Data): Promise<Announcement> => {
  const { title } = data;

  const schema = Yup.object().shape({
    title: Yup.string().required("ERR_ANNOUNCEMENT_REQUIRED")
  });

  try {
    await schema.validate({ title });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await Announcement.create(data as any);

  return record;
};

export default CreateService;

import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { uploadBufferToSpaces, buildSpacesKey } from "../../helpers/uploadToSpaces";
import {
  downloadMedia,
  getBodyMessage
} from "../WbotServices/wbotMessageListener";

interface Request {
  messageId: string | number;
  companyId: number;
}

const RetryMediaDownloadService = async ({
  messageId,
  companyId
}: Request): Promise<{ ticket: Ticket; message: Message }> => {
  const message = await Message.findOne({
    where: { id: messageId, companyId },
    include: [
      "contact",
      { model: Ticket, as: "ticket", include: ["contact", "queue", "whatsapp"] },
      { model: Message, as: "quotedMsg", include: ["contact"] }
    ]
  });

  if (!message) {
    throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  }

  if (!message.dataJson) {
    throw new AppError("ERR_NO_DATA_JSON", 400);
  }

  let msgObj: any;
  try {
    msgObj = JSON.parse(message.dataJson);
  } catch {
    throw new AppError("ERR_INVALID_DATA_JSON", 400);
  }

  if (!msgObj?.message) {
    throw new AppError("ERR_NO_MEDIA_CONTENT", 400);
  }

  // Já tem mídia salva com sucesso — nada a fazer.
  if (message.mediaUrl) {
    return { ticket: message.ticket, message };
  }

  const media = await downloadMedia(msgObj);
  if (!media) {
    throw new AppError("ERR_MEDIA_EXPIRED", 410);
  }

  const filename = media.filename;
  let mediaStoredUrl = `${process.env.BACKEND_URL || ""}/public/company${companyId}/${filename}`;

  try {
    const spacesKey = buildSpacesKey(companyId, filename);
    mediaStoredUrl = await uploadBufferToSpaces(media.data, spacesKey, media.mimetype);
  } catch {
    const publicDir = path.resolve(__dirname, "..", "..", "..", "..", "public");
    const companyDir = path.join(publicDir, `company${companyId}`);
    fs.mkdirSync(companyDir, { recursive: true });
    fs.writeFileSync(path.join(companyDir, filename), media.data);
  }

  const body = getBodyMessage(msgObj) || filename;

  await message.update({
    mediaUrl: mediaStoredUrl,
    mediaType: media.mimetype.split("/")[0],
    body
  });

  const { ticket } = message;
  await ticket.update({ lastMessage: body });

  return { ticket, message };
};

export default RetryMediaDownloadService;

import { WAMessage, delay, isLidUser } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { isNil } from "lodash";
import cacheLayer from "../../libs/cache";
import { resolveLidJid } from "../../libs/lidCache";

import formatBody from "../../helpers/Mustache";

// Limpa todos os caches stale que causam erro 406 (not-acceptable) ao enviar mensagem.
//
// Raiz real do 406: assertSessions() no Baileys precisa do mapeamento LID→PN para
// construir wireJids. Se esse mapeamento está ausente, wireJids=[] e o WA server rejeita
// com 406. O retry anterior falhava porque não limpava o userDevicesCache (NodeCache
// interno do Baileys), então getUSyncDevices usava o cache stale e nunca buscava o LID.
//
// Sequência de limpeza:
//   1. LRU em memória (LIDMappingStore)
//   2. userDevicesCache (NodeCache do Baileys) — chave = número sem @domain
//   3. Redis: session, device-list, lid-mapping, tctoken, devicesCache
//   4. USync fresco (useCache=false) → repopula mapeamento LID e device list
//   5. deleteSession para todos os dispositivos obtidos no USync + fallback no JID base
async function clearStaleSignalCache(wbot: any, whatsappId: number, jid: string): Promise<void> {
  const phoneNumber = jid.split("@")[0];

  // 1. LID mapping: LRU em memória
  try {
    const lidMapping = wbot?.signalRepository?.lidMapping;
    if (lidMapping?.mappingCache) {
      lidMapping.mappingCache.delete(`pn:${phoneNumber}`);
      lidMapping.mappingCache.delete(`lid:${phoneNumber}`);
    }
  } catch (_) {}

  // 2. userDevicesCache interno do Baileys (NodeCache) — impede que getUSyncDevices
  //    use dispositivos stale e não busque o LID atualizado no próximo envio
  try {
    wbot?.userDevicesCache?.del?.(phoneNumber);
  } catch (_) {}

  // 3. Redis: todas as chaves do contato
  await Promise.all([
    cacheLayer.delFromPattern(`sessions:${whatsappId}:session-${phoneNumber}*`),
    cacheLayer.delFromPattern(`sessions:${whatsappId}:device-list-${phoneNumber}*`),
    cacheLayer.delFromPattern(`sessions:${whatsappId}:lid-mapping-${phoneNumber}*`),
    cacheLayer.delFromPattern(`sessions:${whatsappId}:tctoken-${jid}*`),
    cacheLayer.del(`devicesCache:${whatsappId}:${phoneNumber}`),
  ]);

  // 4. USync fresco: repopula device list E mapeamento LID→PN antes do retry
  //    (getUSyncDevices com useCache=false dispara USync real, não usa cache)
  let freshDeviceJids: string[] = [];
  try {
    if (wbot?.getUSyncDevices) {
      const freshDevices: any[] = await wbot.getUSyncDevices([jid], false, false);
      freshDeviceJids = (freshDevices || []).map((d: any) => d.jid).filter(Boolean);
    }
  } catch (_) {}

  // 5. deleteSession para todos os dispositivos (não apenas device 0)
  try {
    if (wbot?.signalRepository?.deleteSession) {
      const jidsToDelete = freshDeviceJids.length ? freshDeviceJids : [jid];
      await wbot.signalRepository.deleteSession(jidsToDelete);
    }
  } catch (_) {}
}

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  msdelay?: number;
  isPrivate?: boolean;
  vCard?: Contact;
  isForwarded?: boolean;
}

export const buildVCardText = (vCard: Contact): string => {
  const numberContact = vCard.number;
  const firstName = vCard.name.split(' ')[0];
  const lastName = String(vCard.name).replace(vCard.name.split(' ')[0], '');

  return `BEGIN:VCARD\n`
    + `VERSION:3.0\n`
    + `N:${lastName};${firstName};;;\n`
    + `FN:${vCard.name}\n`
    + `TEL;type=CELL;waid=${numberContact}:+${numberContact}\n`
    + `END:VCARD`;
};

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  msdelay,
  vCard,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  const t0 = Date.now();
  let options = {};
  const wbot = await GetTicketWbot(ticket);
  console.log(`[SEND_TIMING] GetTicketWbot: ${Date.now() - t0}ms`);
  const contactNumber = await Contact.findByPk(ticket.contactId)
  
  let number: string;

  if (contactNumber.remoteJid && contactNumber.remoteJid !== "" && contactNumber.remoteJid.includes("@")) {
    number = contactNumber.remoteJid;
  } else {
    number = `${contactNumber.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;
  }

  if (quotedMsg) {

    const chatMessages = await Message.findOne({
      where: {
        id: quotedMsg.id
      }
    });

    

    if (chatMessages) {
      const msgFound = JSON.parse(chatMessages.dataJson);


      if (msgFound.message !== undefined) {
        options = {
          quoted: {
            key: msgFound.key,
            message: {
              extendedTextMessage: msgFound.message,
            }
          },
        };
      } else {
        options = {
          quoted: {
            key: msgFound.key,
            message: {
              conversation: msgFound.message.conversation,
            }
          },
        };
      }
    }
  }

    if (!isNil(vCard)) {
    const vcard = buildVCardText(vCard);

      const vcardPayload = {
        contacts: { displayName: `${vCard.name}`, contacts: [{ vcard }] }
      };
      try {
        await delay(msdelay);
        const sentMessage = await wbot.sendMessage(number, vcardPayload);
        await ticket.update({ lastMessage: formatBody(vcard, ticket), imported: null });
        return sentMessage;
      } catch (err) {
        if (err?.data === 406 || err?.message === "not-acceptable") {
          try {
            await clearStaleSignalCache(wbot, ticket.whatsappId, number);
            // Para JIDs LID stale: usa o PN resolvido para o retry (evita 406 no WA server)
            const retryNumber = isLidUser(number)
              ? (await resolveLidJid(number)) || number
              : number;
            const sentMessage = await wbot.sendMessage(retryNumber, vcardPayload);
            await ticket.update({ lastMessage: formatBody(vcard, ticket), imported: null });
            return sentMessage;
          } catch (retryErr) {
            Sentry.captureException(retryErr);
            throw new AppError("ERR_SENDING_WAPP_MSG");
          }
        }
        Sentry.captureException(err);
        console.log(err);
        throw new AppError("ERR_SENDING_WAPP_MSG");
      }
    };
  
  const payload = {
    text: formatBody(body, ticket),
    contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded ? true : false }
  };

  try {
    await delay(msdelay);
    const t1 = Date.now();
    console.log(`[SEND_TIMING] calling wbot.sendMessage to ${number}`);
    const sentMessage = await wbot.sendMessage(number, payload, { ...options });
    console.log(`[SEND_TIMING] wbot.sendMessage done: ${Date.now() - t1}ms (total: ${Date.now() - t0}ms)`);
    await ticket.update({ lastMessage: formatBody(body, ticket), imported: null });
    return sentMessage;
  } catch (err) {
    // 406 not-acceptable: LID mapping ou sessão Signal stale — limpa e retenta uma vez
    if (err?.data === 406 || err?.message === "not-acceptable") {
      try {
        await clearStaleSignalCache(wbot, ticket.whatsappId, number);
        // Para JIDs LID stale: usa o PN resolvido para o retry (evita 406 no WA server)
        const retryNumber = isLidUser(number)
          ? (await resolveLidJid(number)) || number
          : number;
        const sentMessage = await wbot.sendMessage(retryNumber, payload, { ...options });
        await ticket.update({ lastMessage: formatBody(body, ticket), imported: null });
        return sentMessage;
      } catch (retryErr) {
        Sentry.captureException(retryErr);
        console.log("ERR_SENDING_WAPP_MSG retry failed:", retryErr);
        throw new AppError("ERR_SENDING_WAPP_MSG");
      }
    }
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;

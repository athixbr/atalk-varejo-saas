import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  Default,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Contact from "./Contact";
import Ticket from "./Ticket";
import Company from "./Company";
import Queue from "./Queue";
import TicketTraking from "./TicketTraking";
import { extractKeyFromUrl, getSignedMediaUrl } from "../helpers/uploadToSpaces";

@Table
class Message extends Model<Message> {
  @PrimaryKey
  @Column
  id: number;

  @Column(DataType.STRING)
  remoteJid: string;

  @Column(DataType.STRING)
  participant: string;

  @Column(DataType.STRING)
  dataJson: string;

  @Default(0)
  @Column
  ack: number;

  @Default(false)
  @Column
  read: boolean;

  @Default(false)
  @Column
  fromMe: boolean;

  @Column(DataType.TEXT)
  body: string;

  @Column(DataType.STRING)
  get mediaUrl(): string | null {
    const raw = this.getDataValue("mediaUrl");
    if (!raw) return null;
    // Arquivos novos: valor salvo é uma URL canônica do bucket (privado) — a key é
    // extraída dela e uma URL assinada temporária é gerada a cada leitura.
    if (raw.startsWith("https://") || raw.startsWith("http://")) {
      const backendUrl = process.env.BACKEND_URL;
      if (backendUrl && raw.startsWith(backendUrl)) {
        // Upload para o bucket falhou no momento do envio e o arquivo foi salvo
        // localmente como fallback (ver MessageController/wbotMessageListener) —
        // já é servido direto por express.static, não existe no bucket para assinar.
        return raw;
      }
      const key = extractKeyFromUrl(raw);
      return getSignedMediaUrl(key);
    }
    // Arquivos antigos: monta URL do backend local (retrocompatível)
    return `${process.env.BACKEND_URL}${process.env.PROXY_PORT ? `:${process.env.PROXY_PORT}` : ""}/public/company${this.companyId}/${raw}`;
  }

  @Column
  mediaType: string;

  @Default(false)
  @Column
  isDeleted: boolean;

  @Column(DataType.DATE(6))
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt: Date;

  @ForeignKey(() => Message)
  @Column
  quotedMsgId: string;

  @BelongsTo(() => Message, "quotedMsgId")
  quotedMsg: any;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: any;

  @ForeignKey(() => TicketTraking)
  @Column
  ticketTrakingId: number;

  @BelongsTo(() => TicketTraking, "ticketTrakingId")
  ticketTraking: any;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact, "contactId")
  contact: any; // any prevents circular __metadata TDZ

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: any;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: any;
  
  @Column
  wid: string;

  @Default(false)
  @Column
  isPrivate: boolean;

  @Default(false)
  @Column
  isEdited: boolean;

  @Default(false)
  @Column
  isForwarded: boolean;
}

export default Message;

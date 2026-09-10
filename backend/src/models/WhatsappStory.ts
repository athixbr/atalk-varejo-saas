import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType,
  Default,
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";
import { isSpacesUrl, getSignedMediaUrl } from "../helpers/uploadToSpaces";

@Table({ tableName: "WhatsappStories" })
class WhatsappStory extends Model<WhatsappStory> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column
  senderJid: string;

  @AllowNull(true)
  @Column
  senderName: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  senderProfilePic: string;

  @Default("text")
  @Column
  mediaType: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  textContent: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  caption: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  mediaPath: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  get mediaUrl(): string | null {
    const raw = this.getDataValue("mediaUrl");
    if (!raw) return null;
    const path = this.getDataValue("mediaPath");
    // Bucket é privado — se o valor salvo é uma URL de storage (não local),
    // gera uma URL assinada temporária a partir da key (mediaPath) a cada leitura.
    if (path && isSpacesUrl(raw)) {
      return getSignedMediaUrl(path);
    }
    return raw;
  }

  @AllowNull(true)
  @Column
  backgroundColor: string;

  @AllowNull(true)
  @Column
  messageId: string;

  @Column(DataType.DATE)
  expiresAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  seenAt: Date;

  @Default("received")
  @Column
  direction: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WhatsappStory;

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
  DataType
} from "sequelize-typescript";
import Checklist from "./Checklist";
import { isSpacesUrl, getSignedMediaUrl } from "../helpers/uploadToSpaces";

@Table({ tableName: "ChecklistItens" })
class ChecklistItem extends Model<ChecklistItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Checklist)
  @Column
  checklistId: number;

  @BelongsTo(() => Checklist)
  checklist: any;

  @Column
  ordem: number;

  @Column
  titulo: string;

  @Column(DataType.TEXT)
  descricao: string;

  @Column
  obrigatorio: boolean;

  @Column
  tipo: string; // 'texto', 'imagem', 'video', 'arquivo'

  @Column(DataType.TEXT)
  get arquivoUrl(): string | null {
    const raw = this.getDataValue("arquivoUrl");
    if (!raw) return null;
    const path = this.getDataValue("arquivoPath");
    // Bucket é privado — se o valor salvo é uma URL de storage (não local),
    // gera uma URL assinada temporária a partir da key (arquivoPath) a cada leitura.
    if (path && isSpacesUrl(raw)) {
      return getSignedMediaUrl(path);
    }
    return raw;
  }

  @Column
  arquivoNome: string;

  @Column
  arquivoPath: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ChecklistItem;

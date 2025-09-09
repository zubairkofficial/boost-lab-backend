import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  AllowNull,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from './user.model';

@Table({
  tableName: 'stage3_chat',
  timestamps: true,
})
export class Stage3Chat extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => User)
  user!: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare sender: 'user' | 'bot';

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare message: string;
}

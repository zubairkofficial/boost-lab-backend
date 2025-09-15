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
  tableName: 'marketing_strategies',
  timestamps: true,
})
export class MarketingStrategy extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number;


  @BelongsTo(() => User)
  declare user: User;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare strategyText: string;
}

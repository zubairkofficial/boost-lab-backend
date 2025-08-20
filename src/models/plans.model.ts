import { Subscription } from './subscription.model';
import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  AllowNull,
  HasMany,
} from 'sequelize-typescript';

export enum PlanDuration {
  ONE_MONTH = 1,
  THREE_MONTHS = 3,
  TWELVE_MONTHS = 12,
}

@Table({
  tableName: 'plans',
  timestamps: true,
})
export class Plan extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.FLOAT)
  declare price: number;

  @Column({ allowNull: true })
  declare stripePriceId?: string;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  declare oldPrice?: number;

  @AllowNull(true)
  @Column(DataType.ARRAY(DataType.STRING))
  declare description?: string[];

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare duration: PlanDuration;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare validTill: Date;

  @HasMany(() => Subscription)
  declare subscriptions: Subscription[];
}

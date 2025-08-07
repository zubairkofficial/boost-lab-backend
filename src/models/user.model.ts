import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { Plan } from './plans.model';
import { Subscription } from './subscription.model';


@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model {
  @PrimaryKey
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
  })
  declare id: number;

  @Unique
  @AllowNull(true)
  @Column(DataType.STRING)
  declare supabaseId: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare stripeCustomerId: string | null;

  @ForeignKey(() => Plan)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare planId: number | null;

  @BelongsTo(() => Plan)
  declare plan: Plan;

  @HasMany(() => Subscription)
  declare subscriptions: Subscription[];
}

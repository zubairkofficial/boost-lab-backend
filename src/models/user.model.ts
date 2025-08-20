import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  Unique,
  DataType,
  AllowNull,
  HasMany,
} from 'sequelize-typescript';
import { Subscription } from './subscription.model';

@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @AllowNull(true)
  @Column(DataType.STRING)
  email!: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  name!: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  password!: string;

  @AllowNull(true)
  @Column({ field: 'stripe_customer_id', type: DataType.STRING })
  stripeCustomerId!: string | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare createdAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @HasMany(() => Subscription)
  declare subscriptions: Subscription[];
}

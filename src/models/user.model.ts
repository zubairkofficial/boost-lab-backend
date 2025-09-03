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
export class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @AllowNull(true)
  @Column(DataType.STRING)
  declare email: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare name: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare password: string | null;

  @AllowNull(true)
  @Column({ field: 'stripe_customer_id', type: DataType.STRING })
  declare stripeCustomerId: string | null;

  @AllowNull(true)
  @Column(DataType.UUID)
  declare auth_uid: string | null;

  @HasMany(() => Subscription)
  declare subscriptions?: Subscription[];
}

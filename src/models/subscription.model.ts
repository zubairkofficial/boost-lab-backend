import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
} from 'sequelize-typescript';
import { Plan } from './plans.model';
import { User } from './user.model';

@Table({ tableName: 'subscriptions', timestamps: true })
export class Subscription extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare userId: string;

  @ForeignKey(() => Plan)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare planId: number;

  @BelongsTo(() => User)
  declare user: User;

  @BelongsTo(() => Plan)
  declare plan: Plan;
  @Column({
    field: 'stripe_session_id',
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  stripeSessionId: string;

  @Default('active')
  @Column({
    type: DataType.ENUM('active', 'cancelled', 'expired'),
    allowNull: false,
  })
  declare status: 'active' | 'cancelled' | 'expired';

  @AllowNull(false)
  @Column(DataType.DATE)
  declare subscribedAt: Date;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare expiresAt: Date;
}

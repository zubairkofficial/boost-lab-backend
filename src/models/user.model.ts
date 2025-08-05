import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
  Unique,
  AllowNull,
  Default,
  ForeignKey,
} from 'sequelize-typescript';
import { Plan } from './plans.model';

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
@Column({
  type: DataType.STRING,
  allowNull: true,
})
declare supabaseId: string;

  // @Column({ type: DataType.STRING, allowNull: false })
  // declare name: string;

  // @Unique
  // @Column({ type: DataType.STRING, allowNull: false })
  // declare email: string;

  // @Column({ type: DataType.TEXT, allowNull: false })
  // declare password: string;

  // @Column({
  //   type: DataType.ENUM('user', 'admin'),
  //   allowNull: false,
  //   defaultValue: 'user',
  // })
  // declare role: 'user' | 'admin';

  // @Default('pending')
  // @Column({
  //   type: DataType.ENUM('pending', 'active'),
  //   allowNull: false,
  // })
  // declare status: 'pending' | 'active';

  // @AllowNull(true)
  // @Column(DataType.DATE)
  // declare resetTokenExpiry: Date | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare stripeCustomerId: string | null;

  // @Default('Free')
  // @Column({
  //   type: DataType.ENUM('Free', 'Paid', 'AutoSubscriber'),
  //   allowNull: false,
  // })
  // declare SubscriptionStatus: 'Free' | 'Paid' | 'AutoSubscriber';

  @ForeignKey(() => Plan)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare planId: number | null;
}

import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
  Unique,
  AllowNull,
  Default,
} from 'sequelize-typescript';

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

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Unique
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare email: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare password: string;

  @Column({
    type: DataType.ENUM('user', 'admin'),
    allowNull: false,
    defaultValue: 'user',
  })
  declare role: 'user' | 'admin';

  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    defaultValue: null,
  })
  declare otp: string | null;

  @Default('pending')
  @Column({
    type: DataType.ENUM('pending', 'active'),
    allowNull: false,
  })
  declare status: 'pending' | 'active';

  @AllowNull(true)
  @Column({
    type: DataType.DATE,
    defaultValue: null,
  })
  declare otpExpiry: Date | null;
}

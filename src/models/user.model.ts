import {
  AllowNull,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
  Unique,
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

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING)
  declare supabaseId: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare stripeCustomerId: string | null;
}

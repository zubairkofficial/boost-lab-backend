import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  AllowNull,
} from 'sequelize-typescript';

@Table({
  tableName: 'plans',
  timestamps: true,
})
export class Plan extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  declare price: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  declare oldPrice: number;

  @AllowNull(true)
  @Column(DataType.ARRAY(DataType.STRING))
  declare description?: string[];

  @AllowNull(true)
  @Column(DataType.STRING)
  declare stripePriceId?: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare validTill: Date;
}

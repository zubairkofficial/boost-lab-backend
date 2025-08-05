import { AllowNull, BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';

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

  @AllowNull(true)
  @Column(DataType.STRING)
  declare stripeCustomerId: string | null;

 

 
}

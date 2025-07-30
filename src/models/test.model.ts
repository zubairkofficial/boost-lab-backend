import {
  Table,
  Model,
  Column,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  CreatedAt,
} from 'sequelize-typescript';

@Table({
  schema: 'public',
  tableName: 'Messages',
  freezeTableName: true,
  timestamps: true,
  underscored: true,   // generates created_at
  updatedAt: false,
})
export class TestResult extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)        // Sequelize will generate id
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare sender: string | null;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare created_at: Date | null;
}

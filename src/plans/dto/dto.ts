import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
} from 'class-validator';

export enum PlanDuration {
  ONE_MONTH = 1,
  THREE_MONTHS = 3,
  TWELVE_MONTHS = 12,
}

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  price: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  description?: string[];

  @IsEnum(PlanDuration, {
    message: 'Duration must be 1, 3, or 12 months',
  })
  duration: PlanDuration;
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  description?: string[];

  @IsEnum(PlanDuration, {
    message: 'Duration must be 1, 3, or 12 months',
  })
  @IsOptional()
  duration?: PlanDuration;
}

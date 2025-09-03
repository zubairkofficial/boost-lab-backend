import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsEmail,
  IsNotEmpty,
  ValidateNested,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

class AnswerDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  choice: string;
}

export class SubmitDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
export interface HandleBackgroundTasksDto {
  userId: number;
  auth_uid: string;
  name: string;
  email: string;
  answers: AnswerDto[];
}

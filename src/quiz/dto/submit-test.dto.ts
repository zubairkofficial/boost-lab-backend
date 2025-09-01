import {
  IsEmail,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  choice: string;
}

export class SubmitTestDto {
  @IsEmail()
  email: string;

  @IsArray()
  @ArrayMinSize(5, { message: 'Provide exactly 5 answers' })
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

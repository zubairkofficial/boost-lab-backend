import { IsArray, ArrayNotEmpty, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class AgentDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsNotEmpty({ each: true })
  audit_answers?: string[];
}

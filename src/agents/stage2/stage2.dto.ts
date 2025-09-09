import { IsNotEmpty, IsOptional, IsString, IsEmail } from 'class-validator';

export class AgentDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  audit_answers?: string[];
}

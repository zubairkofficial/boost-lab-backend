import { IsEmail, IsArray, IsNotEmpty } from 'class-validator';

export class AgentDto {
  @IsEmail()
  email: string;

  @IsArray()
  @IsNotEmpty({ each: true })
  audit_answers: string[]; 
}

import { IsString, IsInt, MinLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1, { message: 'Message cannot be empty' })
  message: string;
}

export class SaveChatDto {
  @IsInt()
  userId: number;

  @IsString()
  sender: 'user' | 'bot';

  @IsString()
  @MinLength(1)
  message: string;
}

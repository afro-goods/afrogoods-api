import { IsString, IsNumber, IsOptional } from 'class-validator';

export class FileInput {
  @IsString()
  uri: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsString()
  @IsOptional()
  fileName?: string;
}

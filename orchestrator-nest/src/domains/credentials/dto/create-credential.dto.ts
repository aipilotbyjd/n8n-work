import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCredentialDto {
  @ApiProperty({
    description: "Name of the credential",
    example: "My Google API Key",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: "Description of the credential",
    example: "Google API key for Gmail integration",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "UUID of the credential type",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  @IsNotEmpty()
  typeId: string;

  @ApiProperty({
    description: "Credential data (will be encrypted)",
    example: {
      apiKey: "your-api-key-here",
      secret: "your-secret-here",
    },
  })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;
}

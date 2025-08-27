import { IsString, IsNotEmpty, IsOptional, IsUrl } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class OAuthCallbackDto {
  @ApiProperty({
    description: "Authorization code from OAuth provider",
    example: "auth_code_from_provider",
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: "State parameter for CSRF protection",
    example: "random_state_string",
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    description: "Error parameter if OAuth failed",
    required: false,
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({
    description: "Error description if OAuth failed",
    required: false,
  })
  @IsOptional()
  @IsString()
  error_description?: string;
}

export class StartOAuthDto {
  @ApiProperty({
    description: "Credential ID to start OAuth flow for",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  @IsNotEmpty()
  credentialId: string;

  @ApiProperty({
    description: "Redirect URL after OAuth completion",
    example: "https://app.example.com/oauth/callback",
    required: false,
  })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string;
}

export class OAuthUrlResponseDto {
  @ApiProperty({ description: "OAuth authorization URL" })
  authUrl: string;

  @ApiProperty({ description: "State parameter for verification" })
  state: string;
}

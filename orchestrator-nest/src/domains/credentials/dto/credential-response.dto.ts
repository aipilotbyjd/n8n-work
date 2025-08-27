import { ApiProperty } from "@nestjs/swagger";

export class CredentialTypeResponseDto {
  @ApiProperty({ description: "Credential type ID" })
  id: string;

  @ApiProperty({ description: "Credential type name" })
  name: string;

  @ApiProperty({ description: "Display name" })
  displayName: string;

  @ApiProperty({ description: "Icon URL or base64", required: false })
  icon?: string;

  @ApiProperty({ description: "Whether this type supports OAuth" })
  oauth: boolean;
}

export class CredentialResponseDto {
  @ApiProperty({ description: "Credential ID" })
  id: string;

  @ApiProperty({ description: "Credential name" })
  name: string;

  @ApiProperty({ description: "Credential description", required: false })
  description?: string;

  @ApiProperty({ description: "Credential type information" })
  type: CredentialTypeResponseDto;

  @ApiProperty({ description: "Whether credential is active" })
  isActive: boolean;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt: Date;

  @ApiProperty({ description: "ID of user who created the credential" })
  createdBy: string;

  @ApiProperty({ description: "ID of user who last updated the credential" })
  updatedBy: string;

  @ApiProperty({
    description: "Credential data (only included when explicitly requested)",
    required: false,
  })
  data?: Record<string, any>;
}

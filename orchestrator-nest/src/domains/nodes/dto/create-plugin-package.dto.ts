import { IsString, IsOptional, IsUrl, IsObject } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreatePluginPackageDto {
  @ApiProperty({
    description: "Plugin package name",
    example: "n8n-nodes-custom-http",
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Plugin package version",
    example: "1.0.0",
  })
  @IsString()
  version: string;

  @ApiPropertyOptional({
    description: "Plugin package description",
    example: "Custom HTTP nodes with advanced authentication",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Plugin author",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({
    description: "Plugin repository URL",
    example: "https://github.com/user/n8n-nodes-custom-http",
  })
  @IsOptional()
  @IsUrl()
  repository?: string;

  @ApiProperty({
    description: "Plugin package manifest",
    type: "object",
    example: {
      nodes: ["CustomHttpRequest.node.js"],
      credentials: ["CustomHttpAuth.credentials.js"],
    },
  })
  @IsObject()
  manifest: any;

  @ApiPropertyOptional({
    description: "Installation source URL or registry",
    example: "https://registry.npmjs.org",
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: "Plugin configuration options",
    type: "object",
  })
  @IsOptional()
  @IsObject()
  configuration?: any;
}

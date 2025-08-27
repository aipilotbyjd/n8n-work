import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsArray,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { NodeCategory } from "../entities/node-type.entity";

export class CreateNodeDto {
  @ApiProperty({
    description: "Unique name for the node type",
    example: "custom-http-request",
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Display name for the node",
    example: "Custom HTTP Request",
  })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({
    description: "Description of the node functionality",
    example: "Makes HTTP requests with custom headers and authentication",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Node category",
    enum: NodeCategory,
    example: NodeCategory.COMMUNICATION,
  })
  @IsEnum(NodeCategory)
  category: NodeCategory;

  @ApiPropertyOptional({
    description: "Node execution code",
    example: 'function execute(input) { return { output: "Hello World" }; }',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: "Node definition schema",
    type: "object",
    example: {
      inputs: ["main"],
      outputs: ["main"],
      properties: [
        {
          displayName: "URL",
          name: "url",
          type: "string",
          required: true,
        },
      ],
    },
  })
  @IsObject()
  definition: any;

  @ApiPropertyOptional({
    description: "Node icon identifier",
    example: "fa:globe",
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    description: "Node keywords for search",
    type: "array",
    items: { type: "string" },
    example: ["http", "request", "api"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    description: "Node documentation URL",
    example: "https://docs.example.com/nodes/custom-http",
  })
  @IsOptional()
  @IsString()
  documentationUrl?: string;

  @ApiPropertyOptional({
    description: "Whether node requires credentials",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresCredentials?: boolean;

  @ApiPropertyOptional({
    description: "Supported credential types",
    type: "array",
    items: { type: "string" },
    example: ["httpBasicAuth", "httpHeaderAuth"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedCredentials?: string[];
}

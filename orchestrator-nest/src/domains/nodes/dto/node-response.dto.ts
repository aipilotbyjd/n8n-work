import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { NodeCategory } from "../entities/node-type.entity";

export class NodeResponseDto {
  @ApiProperty({
    description: "Unique node type ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @ApiProperty({
    description: "Node type name",
    example: "custom-http-request",
  })
  name: string;

  @ApiProperty({
    description: "Node display name",
    example: "Custom HTTP Request",
  })
  displayName: string;

  @ApiPropertyOptional({
    description: "Node description",
    example: "Makes HTTP requests with custom headers and authentication",
  })
  description?: string;

  @ApiProperty({
    description: "Node category",
    enum: NodeCategory,
    example: NodeCategory.COMMUNICATION,
  })
  category: NodeCategory;

  @ApiProperty({
    description: "Current version",
    example: "1.2.0",
  })
  version: string;

  @ApiProperty({
    description: "Whether this is a built-in node",
    example: false,
  })
  isBuiltIn: boolean;

  @ApiProperty({
    description: "Whether node is active",
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: "Node icon identifier",
    example: "fa:globe",
  })
  icon?: string;

  @ApiPropertyOptional({
    description: "Node keywords for search",
    type: "array",
    items: { type: "string" },
    example: ["http", "request", "api"],
  })
  keywords?: string[];

  @ApiPropertyOptional({
    description: "Documentation URL",
    example: "https://docs.example.com/nodes/custom-http",
  })
  documentationUrl?: string;

  @ApiProperty({
    description: "Whether node requires credentials",
    example: true,
  })
  requiresCredentials: boolean;

  @ApiPropertyOptional({
    description: "Supported credential types",
    type: "array",
    items: { type: "string" },
    example: ["httpBasicAuth", "httpHeaderAuth"],
  })
  supportedCredentials?: string[];

  @ApiProperty({
    description: "Usage count across all workflows",
    example: 45,
  })
  usageCount: number;

  @ApiProperty({
    description: "When node was created",
    example: "2024-01-15T10:30:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "When node was last updated",
    example: "2024-01-15T10:30:00Z",
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "User who created the node",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  createdBy?: string;

  @ApiPropertyOptional({
    description: "Node definition (included when requested)",
    type: "object",
  })
  definition?: any;

  @ApiPropertyOptional({
    description: "Node execution code (included when requested)",
  })
  code?: string;

  @ApiPropertyOptional({
    description: "Plugin package information",
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      version: { type: "string" },
    },
  })
  pluginPackage?: {
    id: string;
    name: string;
    version: string;
  };
}

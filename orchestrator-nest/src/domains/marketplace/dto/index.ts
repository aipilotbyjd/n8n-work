import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  IsObject,
  Min,
  Max,
  IsUrl,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  MarketplaceItemType,
  MarketplaceItemStatus,
} from "../entities/marketplace-item.entity";

// Simple DTO exports for marketplace
export class CreateMarketplaceItemDto {
  @ApiProperty({
    description: "Item name",
    example: "Email Marketing Automation Workflow",
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Item description",
    example:
      "Complete email marketing automation workflow with lead scoring and segmentation",
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: "Category",
    example: "Marketing",
  })
  @IsString()
  category: string;

  @ApiProperty({
    description: "Item type",
    enum: ["workflow_template", "custom_node", "integration", "plugin"],
    example: "workflow_template",
  })
  @IsEnum(["workflow_template", "custom_node", "integration", "plugin"])
  type: MarketplaceItemType;

  @ApiProperty({
    description: "Tags for categorization",
    example: ["email", "marketing", "automation", "crm"],
  })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({
    description: "Author name",
    example: "John Doe",
  })
  @IsString()
  authorName: string;

  @ApiPropertyOptional({
    description: "Version",
    example: "1.0.0",
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description: "Price",
    example: 19.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: "Currency",
    example: "USD",
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: "Screenshot URLs",
    example: [
      "https://example.com/screenshot1.png",
      "https://example.com/screenshot2.png",
    ],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  screenshots?: string[];

  @ApiPropertyOptional({
    description: "Documentation markdown",
    example: "# Getting Started\n\nThis workflow helps you...",
  })
  @IsOptional()
  @IsString()
  documentation?: string;

  @ApiPropertyOptional({
    description: "Workflow definition JSON",
    type: "object",
  })
  @IsOptional()
  @IsObject()
  workflowDefinition?: any;

  @ApiPropertyOptional({
    description: "Code for custom nodes/integrations",
    example: "export class MyCustomNode { ... }",
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: "Configuration schema",
    type: "object",
  })
  @IsOptional()
  @IsObject()
  configuration?: any;

  @ApiPropertyOptional({
    description: "Required dependencies",
    example: ["axios", "lodash"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @ApiPropertyOptional({
    description: "Compatibility requirements",
    type: "object",
    example: { minVersion: "1.0.0", platforms: ["web", "cloud"] },
  })
  @IsOptional()
  @IsObject()
  compatibility?: any;

  @ApiPropertyOptional({
    description: "License type",
    example: "MIT",
  })
  @IsOptional()
  @IsString()
  licenseType?: string;

  @ApiPropertyOptional({
    description: "Support URL",
    example: "https://support.example.com",
  })
  @IsOptional()
  @IsUrl()
  supportUrl?: string;

  @ApiPropertyOptional({
    description: "Homepage URL",
    example: "https://example.com",
  })
  @IsOptional()
  @IsUrl()
  homepageUrl?: string;

  @ApiPropertyOptional({
    description: "Repository URL",
    example: "https://github.com/user/repo",
  })
  @IsOptional()
  @IsUrl()
  repositoryUrl?: string;
}

export class UpdateMarketplaceItemDto {
  @ApiPropertyOptional({
    description: "Item name",
    example: "Updated Email Marketing Workflow",
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "Item description",
    example: "Updated description with new features",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Category",
    example: "Marketing",
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: "Tags for categorization",
    example: ["email", "marketing", "automation"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: "Version",
    example: "1.1.0",
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description: "Price",
    example: 24.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: "Screenshot URLs",
    example: ["https://example.com/screenshot1.png"],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  screenshots?: string[];

  @ApiPropertyOptional({
    description: "Documentation markdown",
    example: "# Updated Documentation",
  })
  @IsOptional()
  @IsString()
  documentation?: string;

  @ApiPropertyOptional({
    description: "Workflow definition JSON",
    type: "object",
  })
  @IsOptional()
  @IsObject()
  workflowDefinition?: any;

  @ApiPropertyOptional({
    description: "Code for custom nodes/integrations",
    example: "export class UpdatedCustomNode { ... }",
  })
  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateReviewDto {
  @ApiProperty({
    description: "Rating (1-5)",
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: "Review comment",
    example: "Excellent workflow template, saved me hours of work!",
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description: "Whether the review should be public",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class MarketplaceSearchFiltersDto {
  @ApiPropertyOptional({
    description: "Search query",
    example: "email automation",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Category filter",
    example: "Marketing",
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: "Type filter",
    enum: ["workflow_template", "custom_node", "integration", "plugin"],
    example: "workflow_template",
  })
  @IsOptional()
  @IsEnum(["workflow_template", "custom_node", "integration", "plugin"])
  type?: MarketplaceItemType;

  @ApiPropertyOptional({
    description: "Tags filter",
    example: ["email", "automation"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: "Minimum rating filter",
    example: 4.0,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    description: "Author ID filter",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: ["name", "rating", "downloads", "created", "updated", "popularity"],
    example: "popularity",
  })
  @IsOptional()
  @IsEnum(["name", "rating", "downloads", "created", "updated", "popularity"])
  sortBy?: string;

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"],
    example: "desc",
  })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortOrder?: string;

  @ApiPropertyOptional({
    description: "Page number",
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: "Items per page",
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MarketplaceItemResponseDto {
  @ApiProperty({
    description: "Item ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @ApiProperty({
    description: "Item name",
    example: "Email Marketing Automation Workflow",
  })
  name: string;

  @ApiProperty({
    description: "Item description",
    example: "Complete email marketing automation workflow",
  })
  description: string;

  @ApiProperty({
    description: "Category",
    example: "Marketing",
  })
  category: string;

  @ApiProperty({
    description: "Item type",
    enum: ["workflow_template", "custom_node", "integration", "plugin"],
    example: "workflow_template",
  })
  type: MarketplaceItemType;

  @ApiProperty({
    description: "Tags",
    example: ["email", "marketing", "automation"],
  })
  tags: string[];

  @ApiProperty({
    description: "Author ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  authorId: string;

  @ApiProperty({
    description: "Author name",
    example: "John Doe",
  })
  authorName: string;

  @ApiProperty({
    description: "Version",
    example: "1.0.0",
  })
  version: string;

  @ApiProperty({
    description: "Average rating",
    example: 4.5,
  })
  rating: number;

  @ApiProperty({
    description: "Number of reviews",
    example: 25,
  })
  reviewCount: number;

  @ApiProperty({
    description: "Download count",
    example: 150,
  })
  downloadCount: number;

  @ApiProperty({
    description: "Price",
    example: 19.99,
  })
  price: number;

  @ApiProperty({
    description: "Currency",
    example: "USD",
  })
  currency: string;

  @ApiProperty({
    description: "Screenshot URLs",
    example: ["https://example.com/screenshot1.png"],
  })
  screenshots?: string[];

  @ApiProperty({
    description: "Documentation",
    example: "# Getting Started...",
  })
  documentation?: string;

  @ApiProperty({
    description: "Whether item is featured",
    example: false,
  })
  featured: boolean;

  @ApiProperty({
    description: "Item status",
    enum: ["draft", "pending_review", "approved", "rejected", "deprecated"],
    example: "approved",
  })
  status: MarketplaceItemStatus;

  @ApiProperty({
    description: "Creation date",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update date",
    example: "2024-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}

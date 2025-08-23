import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import {
  CreateMarketplaceItemDto,
  UpdateMarketplaceItemDto,
  CreateReviewDto,
  MarketplaceItemResponseDto,
  MarketplaceSearchFiltersDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { GetCurrentTenant } from '../auth/decorators/get-current-tenant.decorator';

@ApiTags('marketplace')
@ApiBearerAuth()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post('items')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Create a new marketplace item' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Marketplace item created successfully',
    type: MarketplaceItemResponseDto,
  })
  async createMarketplaceItem(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Body() createMarketplaceItemDto: CreateMarketplaceItemDto,
  ): Promise<MarketplaceItemResponseDto> {
    return this.marketplaceService.createMarketplaceItem(
      tenantId,
      createMarketplaceItemDto,
      userId,
    );
  }

  @Put('items/:itemId')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Update a marketplace item' })
  @ApiParam({
    name: 'itemId',
    description: 'Marketplace item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Marketplace item updated successfully',
    type: MarketplaceItemResponseDto,
  })
  async updateMarketplaceItem(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
    @Body() updateMarketplaceItemDto: UpdateMarketplaceItemDto,
  ): Promise<MarketplaceItemResponseDto> {
    return this.marketplaceService.updateMarketplaceItem(
      tenantId,
      itemId,
      updateMarketplaceItemDto,
      userId,
    );
  }

  @Get('items/:itemId')
  @ApiOperation({ summary: 'Get marketplace item by ID' })
  @ApiParam({
    name: 'itemId',
    description: 'Marketplace item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns marketplace item details',
    type: MarketplaceItemResponseDto,
  })
  async getMarketplaceItem(
    @Param('itemId') itemId: string,
  ): Promise<MarketplaceItemResponseDto> {
    return this.marketplaceService.getMarketplaceItem(itemId);
  }

  @Get('items')
  @ApiOperation({ summary: 'Search marketplace items' })
  @ApiQuery({ name: 'search', required: false, description: 'Search query' })
  @ApiQuery({ name: 'category', required: false, description: 'Category filter' })
  @ApiQuery({ name: 'type', required: false, description: 'Type filter' })
  @ApiQuery({ name: 'tags', required: false, description: 'Tags filter (comma-separated)' })
  @ApiQuery({ name: 'minRating', required: false, description: 'Minimum rating filter' })
  @ApiQuery({ name: 'authorId', required: false, description: 'Author ID filter' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc/desc)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns search results',
  })
  async searchMarketplaceItems(@Query() filters: MarketplaceSearchFiltersDto) {
    // Parse tags if provided as comma-separated string
    if (typeof filters.tags === 'string') {
      filters.tags = (filters.tags as string).split(',').map(tag => tag.trim());
    }

    return this.marketplaceService.searchMarketplaceItems(filters);
  }

  @Post('items/:itemId/download')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Download a marketplace item' })
  @ApiParam({
    name: 'itemId',
    description: 'Marketplace item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item downloaded successfully',
    type: MarketplaceItemResponseDto,
  })
  async downloadMarketplaceItem(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
  ): Promise<MarketplaceItemResponseDto> {
    return this.marketplaceService.downloadMarketplaceItem(itemId, tenantId, userId);
  }

  @Post('items/:itemId/reviews')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: 'Add a review to a marketplace item' })
  @ApiParam({
    name: 'itemId',
    description: 'Marketplace item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Review added successfully',
  })
  async addReview(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<void> {
    return this.marketplaceService.addReview(itemId, tenantId, createReviewDto, userId);
  }

  @Get('items/:itemId/reviews')
  @ApiOperation({ summary: 'Get reviews for a marketplace item' })
  @ApiParam({
    name: 'itemId',
    description: 'Marketplace item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns item reviews',
  })
  async getItemReviews(@Param('itemId') itemId: string) {
    return this.marketplaceService.getItemReviews(itemId);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured marketplace items' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns featured items',
    type: [MarketplaceItemResponseDto],
  })
  async getFeaturedItems(): Promise<MarketplaceItemResponseDto[]> {
    return this.marketplaceService.getFeaturedItems();
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular marketplace items' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns popular items',
    type: [MarketplaceItemResponseDto],
  })
  async getPopularItems(): Promise<MarketplaceItemResponseDto[]> {
    return this.marketplaceService.getPopularItems();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get categories with item counts' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns categories with counts',
  })
  async getCategories() {
    return this.marketplaceService.getCategories();
  }
}
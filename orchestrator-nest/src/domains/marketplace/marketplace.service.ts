import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MarketplaceItem, MarketplaceReview } from "./entities";
import {
  CreateMarketplaceItemDto,
  UpdateMarketplaceItemDto,
  CreateReviewDto,
  MarketplaceItemResponseDto,
  MarketplaceSearchFiltersDto,
} from "./dto/index";
import { AuditLogService } from "../audit/audit-log.service";

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(MarketplaceItem)
    private marketplaceItemRepository: Repository<MarketplaceItem>,
    @InjectRepository(MarketplaceReview)
    private marketplaceReviewRepository: Repository<MarketplaceReview>,
    private eventEmitter: EventEmitter2,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Create a new marketplace item
   */
  async createMarketplaceItem(
    tenantId: string,
    createMarketplaceItemDto: CreateMarketplaceItemDto,
    userId: string,
  ): Promise<MarketplaceItemResponseDto> {
    const marketplaceItem = this.marketplaceItemRepository.create({
      ...createMarketplaceItemDto,
      tenantId,
      authorId: userId,
      status: "pending_review",
      downloadCount: 0,
      rating: 0,
      reviewCount: 0,
    });

    const savedItem =
      await this.marketplaceItemRepository.save(marketplaceItem);

    // Emit marketplace item created event
    this.eventEmitter.emit("marketplace.item.created", {
      tenantId,
      itemId: savedItem.id,
      authorId: userId,
      type: savedItem.type,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: "marketplace.item.created",
      resourceType: "marketplace_item",
      resourceId: savedItem.id,
      ipAddress: "unknown",
      userAgent: "unknown",
      newValues: { name: savedItem.name, type: savedItem.type },
    });

    return this.mapToMarketplaceItemResponse(savedItem);
  }

  /**
   * Update marketplace item
   */
  async updateMarketplaceItem(
    tenantId: string,
    itemId: string,
    updateMarketplaceItemDto: UpdateMarketplaceItemDto,
    userId: string,
  ): Promise<MarketplaceItemResponseDto> {
    const item = await this.marketplaceItemRepository.findOne({
      where: { id: itemId, tenantId },
    });

    if (!item) {
      throw new NotFoundException("Marketplace item not found");
    }

    // Only allow author or admin to update
    if (item.authorId !== userId) {
      throw new BadRequestException("Only the author can update this item");
    }

    Object.assign(item, updateMarketplaceItemDto);

    // Reset status to pending review if content was modified
    if (
      updateMarketplaceItemDto.workflowDefinition ||
      updateMarketplaceItemDto.code
    ) {
      item.status = "pending_review";
    }

    const savedItem = await this.marketplaceItemRepository.save(item);

    // Emit marketplace item updated event
    this.eventEmitter.emit("marketplace.item.updated", {
      tenantId,
      itemId: savedItem.id,
      authorId: userId,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: "marketplace.item.updated",
      resourceType: "marketplace_item",
      resourceId: savedItem.id,
      ipAddress: "unknown",
      userAgent: "unknown",
      newValues: updateMarketplaceItemDto,
    });

    return this.mapToMarketplaceItemResponse(savedItem);
  }

  /**
   * Get marketplace item by ID
   */
  async getMarketplaceItem(
    itemId: string,
  ): Promise<MarketplaceItemResponseDto> {
    const item = await this.marketplaceItemRepository.findOne({
      where: { id: itemId, status: "approved" },
    });

    if (!item) {
      throw new NotFoundException("Marketplace item not found");
    }

    return this.mapToMarketplaceItemResponse(item);
  }

  /**
   * Search marketplace items
   */
  async searchMarketplaceItems(filters: MarketplaceSearchFiltersDto): Promise<{
    items: MarketplaceItemResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      search,
      category,
      type,
      tags,
      minRating,
      authorId,
      sortBy = "popularity",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = filters;

    const query = this.marketplaceItemRepository
      .createQueryBuilder("item")
      .where("item.status = :status", { status: "approved" });

    if (search) {
      query.andWhere(
        "(item.name ILIKE :search OR item.description ILIKE :search OR item.tags && ARRAY[:search])",
        { search: `%${search}%` },
      );
    }

    if (category) {
      query.andWhere("item.category = :category", { category });
    }

    if (type) {
      query.andWhere("item.type = :type", { type });
    }

    if (tags && tags.length > 0) {
      query.andWhere("item.tags && ARRAY[:...tags]", { tags });
    }

    if (minRating) {
      query.andWhere("item.rating >= :minRating", { minRating });
    }

    if (authorId) {
      query.andWhere("item.authorId = :authorId", { authorId });
    }

    // Apply sorting
    switch (sortBy) {
      case "name":
        query.orderBy("item.name", sortOrder.toUpperCase() as "ASC" | "DESC");
        break;
      case "rating":
        query.orderBy("item.rating", sortOrder.toUpperCase() as "ASC" | "DESC");
        break;
      case "downloads":
        query.orderBy(
          "item.downloadCount",
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
        break;
      case "created":
        query.orderBy(
          "item.createdAt",
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
        break;
      case "updated":
        query.orderBy(
          "item.updatedAt",
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
        break;
      case "popularity":
      default:
        query
          .orderBy("item.downloadCount", "DESC")
          .addOrderBy("item.rating", "DESC");
        break;
    }

    const total = await query.getCount();
    const items = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items: items.map((item) => this.mapToMarketplaceItemResponse(item)),
      total,
      page,
      limit,
    };
  }

  /**
   * Download marketplace item
   */
  async downloadMarketplaceItem(
    itemId: string,
    tenantId: string,
    userId: string,
  ): Promise<MarketplaceItemResponseDto> {
    const item = await this.marketplaceItemRepository.findOne({
      where: { id: itemId, status: "approved" },
    });

    if (!item) {
      throw new NotFoundException("Marketplace item not found");
    }

    // Increment download count
    item.downloadCount += 1;
    await this.marketplaceItemRepository.save(item);

    // Emit download event
    this.eventEmitter.emit("marketplace.item.downloaded", {
      tenantId,
      itemId: item.id,
      userId,
      downloadCount: item.downloadCount,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: "marketplace.item.downloaded",
      resourceType: "marketplace_item",
      resourceId: item.id,
      ipAddress: "unknown",
      userAgent: "unknown",
      newValues: { name: item.name, downloadCount: item.downloadCount },
    });

    return this.mapToMarketplaceItemResponse(item);
  }

  /**
   * Add review to marketplace item
   */
  async addReview(
    itemId: string,
    tenantId: string,
    createReviewDto: CreateReviewDto,
    userId: string,
  ): Promise<void> {
    const item = await this.marketplaceItemRepository.findOne({
      where: { id: itemId, status: "approved" },
    });

    if (!item) {
      throw new NotFoundException("Marketplace item not found");
    }

    // Check if user already reviewed this item
    const existingReview = await this.marketplaceReviewRepository.findOne({
      where: { itemId, userId },
    });

    if (existingReview) {
      throw new BadRequestException("User has already reviewed this item");
    }

    const review = this.marketplaceReviewRepository.create({
      itemId,
      userId,
      tenantId,
      ...createReviewDto,
    });

    await this.marketplaceReviewRepository.save(review);

    // Update item rating and review count
    await this.updateItemRating(itemId);

    // Emit review added event
    this.eventEmitter.emit("marketplace.review.added", {
      tenantId,
      itemId,
      reviewId: review.id,
      rating: review.rating,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: "marketplace.review.added",
      resourceType: "marketplace_review",
      resourceId: review.id,
      ipAddress: "unknown",
      userAgent: "unknown",
      newValues: { itemId, rating: review.rating },
    });
  }

  /**
   * Get reviews for marketplace item
   */
  async getItemReviews(itemId: string): Promise<any[]> {
    const reviews = await this.marketplaceReviewRepository.find({
      where: { itemId },
      order: { createdAt: "DESC" },
    });

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      userId: review.userId,
      createdAt: review.createdAt,
    }));
  }

  /**
   * Get featured marketplace items
   */
  async getFeaturedItems(): Promise<MarketplaceItemResponseDto[]> {
    const items = await this.marketplaceItemRepository.find({
      where: { status: "approved", featured: true },
      order: { rating: "DESC", downloadCount: "DESC" },
      take: 10,
    });

    return items.map((item) => this.mapToMarketplaceItemResponse(item));
  }

  /**
   * Get popular marketplace items
   */
  async getPopularItems(): Promise<MarketplaceItemResponseDto[]> {
    const items = await this.marketplaceItemRepository.find({
      where: { status: "approved" },
      order: { downloadCount: "DESC", rating: "DESC" },
      take: 20,
    });

    return items.map((item) => this.mapToMarketplaceItemResponse(item));
  }

  /**
   * Get categories with item counts
   */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    const result = await this.marketplaceItemRepository
      .createQueryBuilder("item")
      .select("item.category, COUNT(*) as count")
      .where("item.status = :status", { status: "approved" })
      .groupBy("item.category")
      .orderBy("count", "DESC")
      .getRawMany();

    return result.map((row) => ({
      category: row.category,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Update item rating based on reviews
   */
  private async updateItemRating(itemId: string): Promise<void> {
    const result = await this.marketplaceReviewRepository
      .createQueryBuilder("review")
      .select("AVG(review.rating) as avgRating, COUNT(*) as reviewCount")
      .where("review.itemId = :itemId", { itemId })
      .getRawOne();

    await this.marketplaceItemRepository.update(itemId, {
      rating: parseFloat(result.avgRating) || 0,
      reviewCount: parseInt(result.reviewCount, 10) || 0,
    });
  }

  /**
   * Map marketplace item entity to response DTO
   */
  private mapToMarketplaceItemResponse(
    item: MarketplaceItem,
  ): MarketplaceItemResponseDto {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      type: item.type,
      tags: item.tags,
      authorId: item.authorId,
      authorName: item.authorName,
      version: item.version,
      rating: item.rating,
      reviewCount: item.reviewCount,
      downloadCount: item.downloadCount,
      price: item.price,
      currency: item.currency,
      screenshots: item.screenshots,
      documentation: item.documentation,
      featured: item.featured,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

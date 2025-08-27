export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  hasPrevious: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface SortOptions {
  field: string;
  order: "ASC" | "DESC";
}

export interface FilterOptions {
  [key: string]: any;
}

export class PaginationHelper {
  static createPaginatedResult<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev: hasPrevious,
      hasPrevious,
    };
  }

  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }
}

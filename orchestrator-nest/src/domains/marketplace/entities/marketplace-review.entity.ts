import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("marketplace_reviews")
export class MarketplaceReview {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  tenantId: string;

  @Column("int", { default: 5 })
  rating: number;

  @Column("text", { nullable: true })
  comment: string;

  @Column()
  userId: string;

  @Column()
  userName: string;

  @ManyToOne(() => MarketplaceItem, (item) => item.reviews)
  item: MarketplaceItem;

  @Column()
  itemId: string;

  @Column({ default: false })
  isVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Import at the end to avoid circular dependencies
import { MarketplaceItem } from "./marketplace-item.entity";

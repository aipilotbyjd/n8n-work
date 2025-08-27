import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";

@Entity("invoice_line_items")
export class InvoiceLineItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  description: string;

  @Column("int")
  quantity: number;

  @Column("decimal", { precision: 10, scale: 2 })
  unitPrice: number;

  @Column("decimal", { precision: 10, scale: 2 })
  amount: number;

  @ManyToOne("Invoice", "lineItems")
  invoice: Invoice;

  @Column()
  invoiceId: string;
}

// Type declaration for circular dependency
interface Invoice {
  id: string;
  lineItems: InvoiceLineItem[];
}

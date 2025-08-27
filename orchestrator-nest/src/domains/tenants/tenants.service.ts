import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Tenant } from "./entities/tenant.entity";

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  async create(createTenantDto: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.tenantRepository.create(createTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async update(id: string, updateTenantDto: Partial<Tenant>): Promise<Tenant> {
    await this.tenantRepository.update(id, updateTenantDto);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const result = await this.tenantRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
  }

  async isActive(tenantId: string): Promise<boolean> {
    const tenant = await this.findById(tenantId);
    return tenant.isActive;
  }

  async validateTenantAccess(tenantId: string, userId: string): Promise<void> {
    const tenant = await this.findById(tenantId);
    if (!tenant.isActive) {
      throw new NotFoundException(`Tenant ${tenantId} is not active`);
    }
    // Additional validation logic can be added here
    // For now, we just check if the tenant exists and is active
  }
}

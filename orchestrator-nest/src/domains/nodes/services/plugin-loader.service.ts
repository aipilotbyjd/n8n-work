import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PluginPackage } from "../entities/plugin-package.entity";

@Injectable()
export class PluginLoaderService {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly loadedPackages = new Map<string, PluginPackage>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async loadPackage(pluginPackage: PluginPackage): Promise<void> {
    this.logger.log(
      `Loading plugin package: ${pluginPackage.name}@${pluginPackage.version}`,
    );

    try {
      // Validate package manifest
      await this.validatePackageManifest(pluginPackage.manifest);

      // Load package dependencies
      await this.loadPackageDependencies(pluginPackage);

      // Register package nodes
      await this.registerPackageNodes(pluginPackage);

      // Mark as loaded
      this.loadedPackages.set(pluginPackage.id, pluginPackage);

      this.eventEmitter.emit("plugin.loaded", {
        packageId: pluginPackage.id,
        packageName: pluginPackage.name,
        nodeCount: pluginPackage.manifest?.nodes?.length || 0,
      });

      this.logger.log(
        `Successfully loaded plugin package: ${pluginPackage.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load plugin package ${pluginPackage.name}:`,
        error,
      );
      throw error;
    }
  }

  async unloadPackage(packageId: string): Promise<void> {
    const pluginPackage = this.loadedPackages.get(packageId);
    if (!pluginPackage) {
      this.logger.warn(
        `Plugin package ${packageId} not found in loaded packages`,
      );
      return;
    }

    this.logger.log(`Unloading plugin package: ${pluginPackage.name}`);

    try {
      // Unregister package nodes
      await this.unregisterPackageNodes(pluginPackage);

      // Clean up dependencies
      await this.cleanupPackageDependencies(pluginPackage);

      // Remove from loaded packages
      this.loadedPackages.delete(packageId);

      this.eventEmitter.emit("plugin.unloaded", {
        packageId: pluginPackage.id,
        packageName: pluginPackage.name,
      });

      this.logger.log(
        `Successfully unloaded plugin package: ${pluginPackage.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to unload plugin package ${pluginPackage.name}:`,
        error,
      );
      throw error;
    }
  }

  isPackageLoaded(packageId: string): boolean {
    return this.loadedPackages.has(packageId);
  }

  getLoadedPackages(): PluginPackage[] {
    return Array.from(this.loadedPackages.values());
  }

  getLoadedPackage(packageId: string): PluginPackage | undefined {
    return this.loadedPackages.get(packageId);
  }

  async reloadPackage(packageId: string): Promise<void> {
    const pluginPackage = this.loadedPackages.get(packageId);
    if (!pluginPackage) {
      throw new Error(`Plugin package ${packageId} not found`);
    }

    this.logger.log(`Reloading plugin package: ${pluginPackage.name}`);

    await this.unloadPackage(packageId);
    await this.loadPackage(pluginPackage);
  }

  async validatePackage(
    manifest: any,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!manifest.name || typeof manifest.name !== "string") {
      errors.push("Package manifest must have a valid name");
    }

    if (!manifest.version || typeof manifest.version !== "string") {
      errors.push("Package manifest must have a valid version");
    }

    if (!manifest.nodes || !Array.isArray(manifest.nodes)) {
      errors.push("Package manifest must have a nodes array");
    }

    if (manifest.dependencies && typeof manifest.dependencies !== "object") {
      errors.push("Package dependencies must be an object");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async validatePackageManifest(manifest: any): Promise<void> {
    const validation = await this.validatePackage(manifest);
    if (!validation.isValid) {
      throw new Error(
        `Invalid package manifest: ${validation.errors.join(", ")}`,
      );
    }
  }

  private async loadPackageDependencies(
    pluginPackage: PluginPackage,
  ): Promise<void> {
    const dependencies = pluginPackage.manifest?.dependencies || {};

    for (const [name, version] of Object.entries(dependencies)) {
      this.logger.debug(`Loading dependency: ${name}@${version}`);
      // In a real implementation, this would resolve and load dependencies
      // For now, we'll just log the dependencies
    }
  }

  private async registerPackageNodes(
    pluginPackage: PluginPackage,
  ): Promise<void> {
    const nodes = pluginPackage.manifest?.nodes || [];

    for (const nodeFile of nodes) {
      this.logger.debug(`Registering node from file: ${nodeFile}`);
      // In a real implementation, this would load and register the node
      // For now, we'll just log the node files
    }
  }

  private async unregisterPackageNodes(
    pluginPackage: PluginPackage,
  ): Promise<void> {
    const nodes = pluginPackage.manifest?.nodes || [];

    for (const nodeFile of nodes) {
      this.logger.debug(`Unregistering node from file: ${nodeFile}`);
      // In a real implementation, this would unregister the node
      // For now, we'll just log the node files
    }
  }

  private async cleanupPackageDependencies(
    pluginPackage: PluginPackage,
  ): Promise<void> {
    const dependencies = pluginPackage.manifest?.dependencies || {};

    for (const [name, version] of Object.entries(dependencies)) {
      this.logger.debug(`Cleaning up dependency: ${name}@${version}`);
      // In a real implementation, this would clean up dependencies
      // For now, we'll just log the dependencies
    }
  }

  getPackageStats(): {
    totalPackages: number;
    loadedPackages: number;
    totalNodes: number;
    packagesByStatus: Record<string, number>;
  } {
    const packages = Array.from(this.loadedPackages.values());
    const totalNodes = packages.reduce(
      (sum, pkg) => sum + (pkg.manifest?.nodes?.length || 0),
      0,
    );

    return {
      totalPackages: packages.length,
      loadedPackages: packages.length,
      totalNodes,
      packagesByStatus: {
        loaded: packages.length,
      },
    };
  }
}

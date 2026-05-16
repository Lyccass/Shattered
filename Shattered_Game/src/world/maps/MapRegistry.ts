import type { MapDefinition, MapRegistration } from './MapTypes';

export class MapRegistry {
  private readonly registrations = new Map<string, MapRegistration>();

  registerMapFactory(registration: MapRegistration): void {
    if (this.registrations.has(registration.id)) {
      throw new Error(`MapRegistry: duplicate map id "${registration.id}"`);
    }

    this.registrations.set(registration.id, registration);
  }

  hasMap(mapId: string): boolean {
    return this.registrations.has(mapId);
  }

  listMapIds(): string[] {
    return Array.from(this.registrations.keys());
  }

  getDisplayName(mapId: string): string {
    return this.getRegistration(mapId).displayName;
  }

  getMapDefinition(mapId: string): MapDefinition {
    const registration = this.getRegistration(mapId);
    const definition = registration.factory();

    if (definition.id !== registration.id) {
      throw new Error(
        `MapRegistry: factory for "${registration.id}" returned mismatched map id "${definition.id}"`,
      );
    }

    if (definition.displayName !== registration.displayName) {
      throw new Error(
        `MapRegistry: factory for "${registration.id}" returned display name "${definition.displayName}", expected "${registration.displayName}"`,
      );
    }

    return definition;
  }

  getRegistrations(): MapRegistration[] {
    return Array.from(this.registrations.values());
  }

  private getRegistration(mapId: string): MapRegistration {
    const registration = this.registrations.get(mapId);

    if (!registration) {
      throw new Error(
        `MapRegistry: unknown map "${mapId}". Registered maps: ${this.listMapIds().join(', ') || 'none'}`,
      );
    }

    return registration;
  }
}

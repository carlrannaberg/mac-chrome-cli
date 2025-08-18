/**
 * Service Container for Dependency Injection
 * Manages service lifetimes, dependencies, and provides type-safe service resolution
 */
/**
 * Service lifetime options
 */
export var ServiceLifetime;
(function (ServiceLifetime) {
    /** Single instance shared across the application */
    ServiceLifetime["Singleton"] = "singleton";
    /** New instance created for each request */
    ServiceLifetime["Transient"] = "transient";
})(ServiceLifetime || (ServiceLifetime = {}));
/**
 * Main service container implementation
 */
export class ServiceContainer {
    constructor() {
        this.services = new Map();
        this.singletonInstances = new Map();
        this.resolutionCount = 0;
        this.circularDependencyChecks = 0;
    }
    /**
     * Register a service with the container
     */
    register(descriptor) {
        if (this.services.has(descriptor.token.name)) {
            throw new Error(`Service '${descriptor.token.name}' is already registered`);
        }
        this.services.set(descriptor.token.name, descriptor);
    }
    /**
     * Register a singleton service
     */
    registerSingleton(token, factory, dependencies = []) {
        this.register({
            token,
            factory,
            lifetime: ServiceLifetime.Singleton,
            dependencies
        });
    }
    /**
     * Register a transient service
     */
    registerTransient(token, factory, dependencies = []) {
        this.register({
            token,
            factory,
            lifetime: ServiceLifetime.Transient,
            dependencies
        });
    }
    /**
     * Resolve a service by token with circular dependency detection
     */
    async resolve(token) {
        this.resolutionCount++;
        const context = {
            resolving: new Set(),
            resolved: new Map()
        };
        try {
            const result = await this.resolveWithContext(token, context);
            return { success: true, data: result };
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return { success: false, error: `Failed to resolve service '${token.name}': ${errorMessage}` };
        }
    }
    /**
     * Internal resolution with context for circular dependency detection
     */
    async resolveWithContext(token, context) {
        const tokenName = token.name;
        // Check for circular dependency
        if (context.resolving.has(tokenName)) {
            this.circularDependencyChecks++;
            const cycle = Array.from(context.resolving).concat(tokenName).join(' -> ');
            throw new Error(`Circular dependency detected: ${cycle}`);
        }
        // Check if already resolved in this context
        if (context.resolved.has(tokenName)) {
            return context.resolved.get(tokenName);
        }
        // Check for singleton instance
        if (this.singletonInstances.has(tokenName)) {
            const instance = this.singletonInstances.get(tokenName);
            context.resolved.set(tokenName, instance);
            return instance;
        }
        const descriptor = this.services.get(tokenName);
        if (!descriptor) {
            throw new Error(`Service '${tokenName}' is not registered`);
        }
        // Mark as resolving
        context.resolving.add(tokenName);
        try {
            // Resolve dependencies first
            if (descriptor.dependencies && descriptor.dependencies.length > 0) {
                for (const depToken of descriptor.dependencies) {
                    await this.resolveWithContext(depToken, context);
                }
            }
            // Create instance
            const instance = await Promise.resolve(descriptor.factory(this));
            // Store singleton instance
            if (descriptor.lifetime === ServiceLifetime.Singleton) {
                this.singletonInstances.set(tokenName, instance);
            }
            // Cache in resolution context
            context.resolved.set(tokenName, instance);
            return instance;
        }
        finally {
            // Remove from resolving set
            context.resolving.delete(tokenName);
        }
    }
    /**
     * Check if a service is registered
     */
    isRegistered(token) {
        return this.services.has(token.name);
    }
    /**
     * Clear all services and reset container
     */
    clear() {
        this.services.clear();
        this.singletonInstances.clear();
        this.resolutionCount = 0;
        this.circularDependencyChecks = 0;
    }
    /**
     * Get container statistics
     */
    getStats() {
        return {
            registeredServices: this.services.size,
            singletonInstances: this.singletonInstances.size,
            resolutionCount: this.resolutionCount,
            circularDependencyChecks: this.circularDependencyChecks
        };
    }
}
/**
 * Helper function to create service tokens with better TypeScript inference
 */
export function createServiceToken(name) {
    return { name };
}
/**
 * Global service container instance
 */
export const serviceContainer = new ServiceContainer();

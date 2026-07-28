/**
 * Browser-main cad-core entrypoint. Exact V19 region discovery and validation
 * are intentionally excluded here because the web product routes them through
 * its cancellable dedicated command worker. All authored document behavior,
 * mutation commands, storage, and other query contracts remain identical.
 */
export * from "./engine";

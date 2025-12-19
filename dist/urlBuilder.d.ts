/**
 * URL Building Utilities
 * Provides consistent URL construction functions used across web and React Native clients
 */
/**
 * Joins a host/domain with a path, handling slash normalization
 * Avoids double slashes at the boundary between host and path
 * @param host The host/domain (may have trailing slash)
 * @param path The path (may have leading slash)
 * @returns Properly joined URL without double slashes
 */
export declare function buildPeerUrl(host: string, path: string): string;
/**
 * Constructs HTTP headers for relay repository requests
 * @param branch Optional branch name to include in headers
 * @param repo Optional repository name to include in headers
 * @returns Headers object for fetch requests
 */
export declare function buildRepoHeaders(branch?: string, repo?: string): Record<string, string>;

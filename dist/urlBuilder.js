/**
 * URL Building Utilities
 * Provides consistent URL construction functions used across web and Android clients
 */
/**
 * Joins a host/domain with a path, handling slash normalization
 * Avoids double slashes at the boundary between host and path
 * @param host The host/domain (may have trailing slash)
 * @param path The path (may have leading slash)
 * @returns Properly joined URL without double slashes
 */
export function buildPeerUrl(host, path) {
    return `${host}${host.endsWith('/') || path.startsWith('/') ? '' : '/'}${path}`;
}
/**
 * Constructs HTTP headers for relay repository requests
 * @param branch Optional branch name to include in headers
 * @param repo Optional repository name to include in headers
 * @returns Headers object for fetch requests
 */
export function buildRepoHeaders(branch, repo) {
    const headers = {};
    if (branch)
        headers['x-relay-branch'] = branch;
    if (repo)
        headers['x-relay-repo'] = repo;
    return headers;
}
//# sourceMappingURL=urlBuilder.js.map
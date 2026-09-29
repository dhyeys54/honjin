/**
 * Environment for the herdr client in the Corral terminal. The terminal uses `strictEnv`, so this is the whole
 * environment: nothing from Corral's own process leaks in, including the HERDR_* variables that make herdr refuse
 * to nest. Don't "clear" those by setting them to '': herdr treats an empty HERDR_SOCKET_PATH as a socket path.
 */
export function herdrClientEnv(home: string): Record<string, string> {
    // Without HOME herdr looks for its socket in $TMPDIR, a different server than the backend's CLI calls reach.
    return { HOME: home };
}

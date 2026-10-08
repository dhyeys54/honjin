import { FALLBACK_DIRS } from './prerequisites';

/**
 * Environment for the herdr client in the Honjin terminal. The terminal uses `strictEnv`, so this is the whole
 * environment: nothing from Honjin's own process leaks in, including the HERDR_* variables that make herdr refuse
 * to nest. Don't "clear" those by setting them to '': herdr treats an empty HERDR_SOCKET_PATH as a socket path.
 */
export function herdrClientEnv(home: string): Record<string, string> {
    // Without HOME herdr looks for its socket in $TMPDIR, a different server than the backend's CLI calls reach.
    // The client starts the server, which inherits PATH: herdr only offers integrations for agents it finds there, and
    // pane login shells keep these folders after path_helper's own (D59).
    const path = ['/usr/bin', '/bin', '/usr/sbin', '/sbin', ...FALLBACK_DIRS.map(d => d.replace(/^~/, home))];
    return { HOME: home, PATH: path.join(':') };
}

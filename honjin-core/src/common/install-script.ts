import { FALLBACK_DIRS } from './prerequisites';

/**
 * Spec 13 S6: the script an Install terminal runs with `zsh -lc`. Detection also searches FALLBACK_DIRS, so a brew
 * or npm it found there must run here too; a fresh account's profile often doesn't add them (D51).
 */
export function installScript(command: string): string {
    const path = FALLBACK_DIRS.map(d => d.replace(/^~/, '$HOME')).join(':');
    return `export PATH="$PATH:${path}"; ${command}; s=$?; echo; if [ $s -eq 0 ]; then echo 'Finished.'; else echo "Failed (exit $s)."; fi; `
        + `echo 'Press Enter to close this tab.'; read _`;
}

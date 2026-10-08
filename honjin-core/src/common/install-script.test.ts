import { installScript } from './install-script';

describe('installScript (spec 13 S6)', () => {
    it('puts the folders detection searches on PATH, so a brew or npm Setup found also runs', () => {
        expect(installScript('brew install gemini-cli')).toMatch(
            /^export PATH="\$PATH:\$HOME\/\.local\/bin:\/opt\/homebrew\/bin:\/usr\/local\/bin"; brew install gemini-cli; s=\$\?;/);
    });

    it('reports the exit status and waits for Enter', () => {
        expect(installScript('false')).toContain(`if [ $s -eq 0 ]; then echo 'Finished.'; else echo "Failed (exit $s)."; fi; `
            + `echo 'Press Enter to close this tab.'; read _`);
    });
});

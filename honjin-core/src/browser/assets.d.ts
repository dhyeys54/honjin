// esbuild inlines these as data URLs (browser-app/gen-esbuild.browser.mjs `loader`).
declare module '*.svg' {
    const url: string;
    export = url;
}

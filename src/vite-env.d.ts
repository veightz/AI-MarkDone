/// <reference types="vite/client" />

declare module '*.md?raw' {
    const content: string;
    export default content;
}


interface Window {
    /**
     * Content-runtime troubleshooting seam (ChatGPT pages only). Returns the
     * read-only discovery diagnostics snapshot; never exposes message content.
     */
    __AIMD_DISCOVERY_DIAGNOSTICS__?: () => unknown;
}

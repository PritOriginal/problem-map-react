/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
interface ImportMetaEnv {
    /** API key for Yandex Maps JS API v3 */
    readonly VITE_YMAPS_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

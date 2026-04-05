/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_DISCORD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.png" {
  const src: string;
  export default src;
}

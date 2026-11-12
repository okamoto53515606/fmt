/// <reference types="vite/client" />

declare module 'heic2any' {
  interface Options {
    toType?: string;
    quality?: number;
    multiple?: boolean;
  }
  export default function heic2any(options: Options & { blob: Blob }): Promise<Blob | Blob[]>;
}

declare const __APP_VERSION__: string;

/// <reference lib="webworker" />
import { analyze } from '../engine.ts';
import { inspectImage } from '../lib/imageinfo.ts';
import type { Analysis, ImageMeta } from '../types.ts';

export interface WorkerImage {
  name: string;
  /** デコードに使う MIME（HEIC は変換後の JPEG など） */
  mime: string;
  /** 元ファイルの MIME */
  originalMime: string;
  bytes: Uint8Array;
}

export interface WorkerRequest {
  id: number;
  kind: 'text' | 'image';
  text?: string;
  name?: string;
  images?: WorkerImage[];
  mask: boolean;
  explain: boolean;
}

export type WorkerResponse =
  | { id: number; ok: true; analysis: Analysis }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    let analysis: Analysis;
    if (req.kind === 'text') {
      analysis = await analyze(
        { kind: 'text', text: req.text ?? '', name: req.name },
        { mask: req.mask, explain: req.explain },
      );
    } else {
      const list = req.images ?? [];
      const images: ImageMeta[] = [];
      for (const img of list) {
        images.push(
          await inspectImage(img.bytes, {
            name: img.name,
            mime: img.mime,
            originalMime: img.originalMime,
            note: img.mime !== img.originalMime ? '形式を変換して表示しています' : undefined,
          }),
        );
      }
      const originBytes = list[0]?.bytes ?? new Uint8Array();
      analysis = await analyze(
        { kind: 'image', images, originBytes, name: req.name },
        { mask: req.mask, explain: req.explain },
      );
    }
    ctx.postMessage({ id: req.id, ok: true, analysis } satisfies WorkerResponse);
  } catch (e) {
    ctx.postMessage({
      id: req.id,
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    } satisfies WorkerResponse);
  }
};

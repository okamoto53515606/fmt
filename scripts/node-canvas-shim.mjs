/**
 * レポート生成用の Node シム。
 * ブラウザの createImageBitmap / OffscreenCanvas を @napi-rs/canvas で代替し、
 * 画像ルール（EXIF・QR 読み取り）を Node でもそのまま動かす。
 * アプリ本体には含めない（scripts からのみ読み込む）。
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';

if (typeof globalThis.createImageBitmap !== 'function') {
  globalThis.createImageBitmap = async (source) => {
    const blob = source instanceof Blob ? source : new Blob([source]);
    return loadImage(Buffer.from(await blob.arrayBuffer()));
  };
}

if (typeof globalThis.OffscreenCanvas !== 'function') {
  class ShimOffscreenCanvas {
    #canvas;
    constructor(width, height) {
      this.#canvas = createCanvas(width, height);
    }
    get width() {
      return this.#canvas.width;
    }
    get height() {
      return this.#canvas.height;
    }
    getContext(type) {
      return this.#canvas.getContext(type);
    }
  }
  globalThis.OffscreenCanvas = ShimOffscreenCanvas;
}

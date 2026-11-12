import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FONT_PATH = join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");
const BOLD_FONT_PATH = join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf");

let fontBytes: Promise<Buffer> | undefined;
let boldFontBytes: Promise<Buffer> | undefined;

export function getPdfFontBytes(): Promise<Buffer> {
  fontBytes ??= readFile(FONT_PATH);
  return fontBytes;
}

export function getPdfBoldFontBytes(): Promise<Buffer> {
  boldFontBytes ??= readFile(BOLD_FONT_PATH);
  return boldFontBytes;
}

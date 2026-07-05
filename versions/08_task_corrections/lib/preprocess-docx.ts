import { preprocessText } from "./preprocess-text";
import type { TextPreprocessingResult } from "./input-preprocessing-types";

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const DOCX_TEXT_PARTS = [
  /^word\/document\.xml$/u,
  /^word\/header\d*\.xml$/u,
  /^word\/footer\d*\.xml$/u,
  /^word\/footnotes\.xml$/u,
  /^word\/endnotes\.xml$/u,
];

function findEndOfCentralDirectory(view: DataView) {
  const minOffset = Math.max(0, view.byteLength - 65_557);

  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("DOCX ZIP directory was not found.");
}

function decodeBytes(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(bytes);
}

function readCentralDirectory(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("DOCX ZIP central directory is malformed.");
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decodeBytes(new Uint8Array(buffer, offset + 46, nameLength));

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function getEntryBytes(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer, entry.localHeaderOffset);

  if (view.getUint32(0, true) !== ZIP_LOCAL_FILE_SIGNATURE) {
    throw new Error(`DOCX ZIP local header is malformed for ${entry.name}.`);
  }

  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const dataOffset = entry.localHeaderOffset + 30 + nameLength + extraLength;

  return new Uint8Array(buffer, dataOffset, entry.compressedSize);
}

async function inflateRaw(bytes: Uint8Array) {
  const streamCtor = globalThis.DecompressionStream;

  if (!streamCtor) {
    throw new Error("This browser cannot decompress DOCX files.");
  }

  const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([payload]).stream().pipeThrough(new streamCtor("deflate-raw"));
  const response = new Response(stream);

  return new Uint8Array(await response.arrayBuffer());
}

async function readZipTextEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const bytes = getEntryBytes(buffer, entry);

  if (entry.compressionMethod === 0) {
    return decodeBytes(bytes);
  }

  if (entry.compressionMethod === 8) {
    return decodeBytes(await inflateRaw(bytes));
  }

  throw new Error(`Unsupported DOCX compression method: ${entry.compressionMethod}.`);
}

function decodeXmlText(text: string) {
  return text
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, "&");
}

function textFromDocxXml(xml: string) {
  const paragraphs = xml.match(/<[\w-]+:p\b[\s\S]*?<\/[\w-]+:p>/gu) ?? [];
  const tokenPattern = /<[\w-]+:t\b[^>]*>([\s\S]*?)<\/[\w-]+:t>|<[\w-]+:tab\b[^>]*\/>|<[\w-]+:(?:br|cr)\b[^>]*\/>/gu;

  return paragraphs
    .map((paragraph) => {
      const parts: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = tokenPattern.exec(paragraph)) !== null) {
        const [token, textNode] = match;

        if (textNode !== undefined) {
          parts.push(decodeXmlText(textNode));
        } else if (token.includes(":tab")) {
          parts.push("\t");
        } else {
          parts.push("\n");
        }
      }

      return parts.join("").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

function isDocxTextPart(name: string) {
  return DOCX_TEXT_PARTS.some((pattern) => pattern.test(name));
}

export async function preprocessDocx(file: File): Promise<TextPreprocessingResult> {
  const buffer = await file.arrayBuffer();
  const entries = readCentralDirectory(buffer).filter((entry) => isDocxTextPart(entry.name));
  const textParts = await Promise.all(entries.map(async (entry) => textFromDocxXml(await readZipTextEntry(buffer, entry))));
  const text = textParts.filter(Boolean).join("\n\n");
  const preprocessing = preprocessText(text, file.name);

  if (preprocessing.stats.charCount === 0) {
    preprocessing.warnings.push({
      code: "docx_text_empty",
      severity: "warning",
      message: `Файл ${file.name} прочитан как DOCX, но текстовые абзацы не найдены.`,
    });
  } else {
    preprocessing.warnings.push({
      code: "docx_text_extracted",
      severity: "info",
      message: `Из файла ${file.name} извлечен текст DOCX для резюме.`,
    });
  }

  return preprocessing;
}

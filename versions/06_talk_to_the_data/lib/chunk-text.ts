import type { TextChunk } from "./input-preprocessing-types";

export const TEXT_CHUNKING_LIMITS = {
  maxCharsPerChunk: 10_000,
  overlapChars: 500,
  preferredSplitOrder: ["paragraph", "line", "sentence", "hard_char_limit"],
} as const;

function findSplitBoundary(text: string, start: number, hardEnd: number) {
  const boundarySearchStart = Math.min(hardEnd, start + 1);
  const candidates = [
    text.lastIndexOf("\n\n", hardEnd),
    text.lastIndexOf("\n", hardEnd),
    text.lastIndexOf(". ", hardEnd),
    text.lastIndexOf("! ", hardEnd),
    text.lastIndexOf("? ", hardEnd),
  ].filter((candidate) => candidate >= boundarySearchStart);

  if (candidates.length === 0) {
    return hardEnd;
  }

  return Math.max(...candidates) + 1;
}

export function chunkText(text: string): TextChunk[] {
  const { maxCharsPerChunk, overlapChars } = TEXT_CHUNKING_LIMITS;

  if (text.length <= maxCharsPerChunk) {
    return [
      {
        id: "chunk-1",
        index: 0,
        startChar: 0,
        endChar: text.length,
        text,
        charCount: text.length,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const hardEnd = Math.min(start + maxCharsPerChunk, text.length);
    const end = hardEnd === text.length ? hardEnd : findSplitBoundary(text, start, hardEnd);
    const chunkTextValue = text.slice(start, end).trim();

    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      index: chunks.length,
      startChar: start,
      endChar: end,
      text: chunkTextValue,
      charCount: chunkTextValue.length,
    });

    if (end >= text.length) {
      break;
    }

    const nextStart = Math.max(0, end - overlapChars);
    start = nextStart <= start ? end : nextStart;
  }

  return chunks;
}

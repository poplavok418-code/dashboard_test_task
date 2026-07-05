import { expect, test } from "../../versions/02_input_preprocessing/node_modules/@playwright/test";
import { chunkText, TEXT_CHUNKING_LIMITS } from "../../versions/02_input_preprocessing/lib/chunk-text";
import { preprocessText } from "../../versions/02_input_preprocessing/lib/preprocess-text";

test.describe("02 preprocessing utilities", () => {
  test("keeps short text as one chunk", () => {
    const result = preprocessText("Первый абзац.\n\nВторой абзац.", "fixture.txt");

    expect(result.kind).toBe("text");
    expect(result.chunks).toHaveLength(1);
    expect(result.stats.paragraphCount).toBe(2);
    expect(result.warnings).toEqual([]);
  });

  test("chunks long text with overlap and chunk size limits", () => {
    const text = Array.from(
      { length: 180 },
      (_, index) => `Раздел ${index + 1}. Продажи, спрос и риски требуют внимания команды.`,
    ).join("\n\n");

    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(TEXT_CHUNKING_LIMITS.maxCharsPerChunk);
    }

    for (let index = 1; index < chunks.length; index += 1) {
      expect(chunks[index].startChar).toBeLessThan(chunks[index - 1].endChar);
    }
  });

  test("hard-splits text when no clean boundary exists", () => {
    const chunks = chunkText("x".repeat(25_000));

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.charCount <= TEXT_CHUNKING_LIMITS.maxCharsPerChunk)).toBe(
      true,
    );
  });
});

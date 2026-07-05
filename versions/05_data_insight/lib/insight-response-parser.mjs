function extractJsonText(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response is not valid JSON.");
  }

  return trimmed.slice(start, end + 1);
}

export function extractInsightResponse(text) {
  let parsed;

  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (error) {
    throw new Error(`Could not parse LLM JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Insight response must be an object.");
  }

  if (typeof parsed.reasoning !== "string") {
    throw new Error("Insight response reasoning must be a string.");
  }

  if (typeof parsed.insight !== "string" || parsed.insight.trim().length === 0) {
    throw new Error("Insight response insight must be a non-empty string.");
  }

  return {
    reasoning: parsed.reasoning.trim(),
    insight: parsed.insight.trim(),
  };
}

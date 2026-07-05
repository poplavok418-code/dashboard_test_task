function extractJsonText(text) {
  const trimmed = String(text ?? "").trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Talk-to-data response is not valid JSON.");
  }

  return trimmed.slice(start, end + 1);
}

function normalizeConfidence(value) {
  return ["high", "medium", "low"].includes(value) ? value : "low";
}

export function extractTalkToDataResponse(text) {
  const parsed = JSON.parse(extractJsonText(text));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Talk-to-data response must be an object.");
  }

  if (typeof parsed.answer !== "string" || parsed.answer.trim().length === 0) {
    throw new Error("Talk-to-data response answer must be a non-empty string.");
  }

  return {
    answer: parsed.answer.trim(),
    confidence: normalizeConfidence(parsed.confidence),
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 5)
      : [],
    unavailableReason: typeof parsed.unavailableReason === "string" && parsed.unavailableReason.trim().length > 0
      ? parsed.unavailableReason.trim()
      : undefined,
  };
}

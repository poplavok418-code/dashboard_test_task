import http from "node:http";
import https from "node:https";

function numberFromEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function endpointUrl() {
  if (process.env.NEURALDEEP_CHAT_COMPLETIONS_URL) {
    return process.env.NEURALDEEP_CHAT_COMPLETIONS_URL;
  }

  const baseUrl = process.env.NEURALDEEP_BASE_URL || "https://api.neuraldeep.ru/v1";
  return `${baseUrl.replace(/\/$/u, "")}/chat/completions`;
}

function postJson(url, payload, headers) {
  const body = JSON.stringify(payload);
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      parsedUrl,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body),
          Connection: "close",
        },
      },
      (response) => {
        let responseBody = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            body: responseBody,
          });
        });
      },
    );

    request.setTimeout(30_000, () => {
      request.destroy(new Error("LLM request timed out."));
    });
    request.on("error", reject);
    request.end(body);
  });
}

export async function callVisualizationAgent({ prompt, datasetContext, locale }) {
  const apiKey = process.env.NEURALDEEP_API_KEY;

  if (!apiKey) {
    throw new Error("NEURALDEEP_API_KEY is not set. Put your key into .env or the process environment.");
  }

  const response = await postJson(
    endpointUrl(),
    {
      model: process.env.LLM_MODEL || "gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: JSON.stringify({
            locale,
            instruction: "Choose the best visualization. Return the full required JSON object.",
            datasetContext,
          }),
        },
      ],
      max_tokens: numberFromEnv("LLM_MAX_TOKENS", 1200),
      temperature: numberFromEnv("LLM_TEMPERATURE", 0.2),
    },
    {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  );

  if (!response.ok) {
    throw new Error(`LLM request failed with ${response.status}: ${response.body.slice(0, 300)}`);
  }

  const json = JSON.parse(response.body);
  const content = json?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("LLM response did not contain message content.");
  }

  return content;
}

export async function callInsightAgent({ prompt, insightContext, locale }) {
  const apiKey = process.env.NEURALDEEP_API_KEY;

  if (!apiKey) {
    throw new Error("NEURALDEEP_API_KEY is not set. Put your key into .env or the process environment.");
  }

  const response = await postJson(
    endpointUrl(),
    {
      model: process.env.LLM_MODEL || "gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: JSON.stringify({
            locale,
            instruction: "Write a five-sentence insight. Return the full required JSON object.",
            insightContext,
          }),
        },
      ],
      max_tokens: numberFromEnv("LLM_MAX_TOKENS", 1200),
      temperature: numberFromEnv("LLM_TEMPERATURE", 0.2),
    },
    {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  );

  if (!response.ok) {
    throw new Error(`LLM request failed with ${response.status}: ${response.body.slice(0, 300)}`);
  }

  const json = JSON.parse(response.body);
  const content = json?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("LLM response did not contain message content.");
  }

  return content;
}

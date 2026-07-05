#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";
import { parseSheetFile } from "./lib/sheet-parser.mjs";
import { buildDatasetContext } from "./lib/dataset-context.mjs";
import { callVisualizationAgent } from "./lib/llm-client.mjs";
import { extractSuggestedVisualization } from "./lib/response-parser.mjs";

const versionDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(versionDir, "../..");

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--file") {
      args.file = argv[index + 1];
      index += 1;
    } else if (token === "--prompt") {
      args.prompt = argv[index + 1];
      index += 1;
    } else if (token === "--help" || token === "-h") {
      args.help = true;
    }
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  node versions/04_sheet_visualizations/index.mjs --file <sheet-file>",
    "",
    "Environment:",
    "  NEURALDEEP_API_KEY, NEURALDEEP_BASE_URL, LLM_MODEL, LLM_MAX_TOKENS, LLM_TEMPERATURE",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (!args.file) {
    throw new Error("Missing required --file argument.");
  }

  loadEnv(path.join(repoRoot, ".env"));

  const inputPath = path.resolve(process.cwd(), args.file);
  const promptPath = args.prompt
    ? path.resolve(process.cwd(), args.prompt)
    : path.join(repoRoot, "prompts", "visualization_agent_prompt.md");
  const prompt = await readFile(promptPath, "utf8");
  const parsedSheet = await parseSheetFile(inputPath);
  const datasetContext = buildDatasetContext(parsedSheet);
  const agentResponse = await callVisualizationAgent({
    prompt,
    datasetContext,
    locale: "ru",
  });
  const suggestedVisualization = extractSuggestedVisualization(agentResponse);

  process.stdout.write(`${JSON.stringify(suggestedVisualization, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Visualization choice failed: ${error.message}\n`);
  process.exitCode = 1;
});

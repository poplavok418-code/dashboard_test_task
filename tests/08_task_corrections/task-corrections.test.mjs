import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const repoRoot = process.cwd();

async function text(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("insight prompt asks for a 2-3 sentence hero insight", async () => {
  const prompt = await text("prompts/insight_agent_prompt.md");

  assert.match(prompt, /2-3 Russian sentences|2-3 предложения|2-3 рус/iu);
  assert.doesNotMatch(prompt, /exactly five Russian sentences/i);
});

test("chat prompt contains the explicit missing-information guardrail", async () => {
  const prompt = await text("prompts/talk_to_data_agent_prompt.md");

  assert.match(prompt, /В этом отчете нет такой информации\./u);
});

test("08 README is version-current", async () => {
  const readme = await text("versions/08_task_corrections/README.md");

  assert.match(readme, /08_task_corrections/u);
  assert.doesNotMatch(readme, /04 Sheet Visualizations/u);
});

test("dashboard corrections are wired into the 08 result panel", async () => {
  const panel = await text("versions/08_task_corrections/components/LoaderResultPanel.tsx");

  assert.match(panel, /NarrativeHero/u);
  assert.match(panel, /buildDashboardVisualizations/u);
  assert.match(panel, /dashboard-chart-grid/u);
});

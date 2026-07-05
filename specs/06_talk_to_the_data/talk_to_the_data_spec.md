# 06 Talk To The Data Spec

Status: draft
Version: `06_talk_to_the_data`

## Goal

Add the first "talk to the data" service below the existing analytics, insight, and visualization output. After a supported sheet dataset is accepted and the initial insight/plot area is shown, the user can type a question in Russian, submit it, and receive a concise LLM-agent answer grounded in the same compact data description and bounded data sample used by the insight stage.

## Scope

- Inherit all `05_data_insight` loader, preprocessing, insight, `/api/analyze`, visualization, fallback, and error behavior.
- Add a visible chat box below the graph panel for accepted sheet data.
- Add `prompts/talk_to_data_agent_prompt.md`.
- Add `POST /api/chat` for sheet questions.
- Build the chat request from:
  - user question,
  - the current insight context,
  - the current visualization context,
  - current analysis insight text when available.
- Keep the prompt simple for this release: answer the user question, use only the supplied data description and sample, and be honest when the sample/profile does not contain enough evidence.
- Add deterministic local fallback answer text so the UI remains usable while the LLM API key is broken.
- Add mocked API/unit tests for prompt payload and validation behavior.

## Out Of Scope

- Production-grade conversational memory.
- Retrieval, vector search, SQL generation, or running calculations over full raw files in the backend.
- Text-document chat.
- Persisted chat sessions.
- Fixing the broken live LLM API key.
- Starting or recovering the local dev server. The user will set up `http://localhost:3000` manually for final manual testing.

## Baseline Behavior

Inherited from `05_data_insight`:

- Russian browser-first data loader.
- Local validation/preprocessing for supported files and pasted text.
- Sheet visualization selection and rendering.
- `data-testid="data-insight"` insight text above the graph.
- `/api/analyze` using compact `insightContext` and `visualizationContext`.
- Local deterministic insight/visualization fallback when LLM output is unavailable.
- Friendly Russian errors for unsupported files.

## New Behavior

- Accepted sheet data renders an ask panel below the initial analytics/plot block.
- The panel uses `data-testid="ask-data-panel"`.
- The question textarea/input uses `data-testid="ask-data-question"`.
- The submit button uses `data-testid="ask-data-submit"`.
- Answers render in the panel with `data-testid="ask-data-answer"`.
- Error/fallback status renders with `data-testid="ask-data-status"`.
- Empty questions are rejected client-side with a short Russian message.
- Questions longer than 600 characters are rejected client-side and server-side.
- While the API is unavailable or returns no valid answer, the panel shows a deterministic local fallback answer rather than a raw stack trace.
- The chat endpoint receives compact contexts only; raw uploaded bytes and unbounded full-row arrays are never sent.

## UI Text Requirements

- Browser-facing text is Russian.
- Panel heading: `Спроси что-нибудь про эти данные`.
- Placeholder: `Например: какой отдел лидирует по выручке?`.
- Submit label: `Спросить`.
- Loading text: `Готовим ответ по профилю данных...`.
- Empty question error: `Напишите вопрос по данным.`
- Long question error: `Сократите вопрос до 600 символов.`
- API fallback copy must explain that local answer is shown because the LLM is temporarily unavailable.

## Data Contract

Chat request:

```ts
type TalkToDataRequest = {
  locale: "ru";
  question: string;
  insightContext: InsightContext;
  visualizationContext: AnalyzeRequestPayload["visualizationContext"];
  analysis?: {
    insight?: string | null;
    visualizationType?: string | null;
  };
};
```

Chat response:

```ts
type TalkToDataResponse = {
  ok: true;
  message: {
    answer: string;
    confidence: "high" | "medium" | "low";
    evidence: string[];
    unavailableReason?: string;
  };
} | {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
```

## Validation Rules

- `question` must be a non-empty string after trimming.
- `question` maximum length is 600 characters.
- `locale` must be `ru`.
- `insightContext.sourceType` must be `sheet`.
- `insightContext.sample.rows` must be capped to the existing 30-row sample.
- The backend prompt payload must include data description/profile fields and sample rows, not raw full-file row arrays.
- The normalized answer must be a non-empty string.
- `confidence` defaults to `low` if the LLM omits or misstates it.

## Component And Module Plan

- `prompts/talk_to_data_agent_prompt.md`: simple grounded-answer prompt.
- `lib/talk-to-data.ts`: shared request types, question validation, local fallback answer, and chat payload builder.
- `lib/talk-response-parser.mjs`: normalize LLM JSON into `answer`, `confidence`, `evidence`, and optional unavailable reason.
- `lib/llm-client.mjs`: add `callTalkToDataAgent`.
- `app/api/chat/route.ts`: validate request, load prompt, call LLM, return normalized response or friendly JSON error.
- `components/AskDataChat.tsx`: Russian question box below analytics.
- `components/LoaderResultPanel.tsx`: build chat context from the same dataset and selected visualization context used by `/api/analyze`, then render `AskDataChat`.

## Acceptance Criteria

- `06_talk_to_the_data` is self-contained under `versions/06_talk_to_the_data`.
- Uploading a supported sheet fixture still renders inherited insight and visualization.
- The ask panel appears below the graph for accepted sheet data.
- Submitting a valid question calls `/api/chat` with the question plus compact insight/visualization contexts.
- Mocked `/api/chat` answer appears in the UI.
- Empty and overlong questions are rejected with Russian UI messages.
- API failure shows a deterministic local fallback answer and a clear fallback status.
- Unit tests confirm the chat prompt call contains compact context/sample and excludes raw rows.
- Typecheck/build pass for `versions/06_talk_to_the_data`.

## Automated Test Matrix

- Unit/API:
  - talk response parser accepts the required JSON shape.
  - parser defaults invalid confidence to `low`.
  - `/api/chat` rejects empty questions.
  - `/api/chat` rejects questions over 600 characters.
  - mocked chat agent receives `prompts/talk_to_data_agent_prompt.md`, the question, data description/profile, and bounded sample rows only.
- Browser:
  - accepted sheet renders insight, chart, and ask panel.
  - submitting a valid question with mocked `/api/chat` displays the mocked answer.
  - empty question shows the Russian validation message and does not call `/api/chat`.
  - mocked API failure displays local fallback answer and fallback status.
  - unsupported PDF keeps inherited friendly error and does not render the ask panel.

## Manual Test Cases

- User starts the app manually from `versions/06_talk_to_the_data` on `http://localhost:3000`.
- Upload `tests/06_talk_to_the_data/test_cases/bar_chart_semicolon.csv`.
- Confirm the insight and chart render first.
- Ask `Какой отдел лидирует по выручке?`.
- With a working API key, confirm the answer is grounded in the visible data profile/sample.
- With the currently broken API key, confirm a local fallback answer appears without a raw error.
- Upload unsupported PDF and confirm no chat panel appears.

## Known Limits

- Live LLM quality is not manually verified in this release because the current API key is broken.
- The fallback answer is deterministic and only summarizes the compact profile; it is not a real language-model answer.
- The endpoint does not calculate over raw full files and can only answer from the supplied compact profile/sample.
- The user will handle localhost setup manually before manual testing.

"use client";

import { Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { buildLocalTalkToDataAnswer, TALK_TO_DATA_LIMITS, validateTalkToDataQuestion, type TalkToDataMessage, type TalkToDataRequest } from "@/lib/talk-to-data";

type AskDataChatProps = {
  requestBase: Omit<TalkToDataRequest, "question">;
};

type ChatState = {
  status: "idle" | "loading" | "answered" | "fallback" | "error";
  message: TalkToDataMessage | null;
  notice: string | null;
};

export function AskDataChat({ requestBase }: AskDataChatProps) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<ChatState>({ status: "idle", message: null, notice: null });
  const remaining = TALK_TO_DATA_LIMITS.maxQuestionLength - question.length;
  const localBase = useMemo(
    () => ({
      question,
      insightContext: requestBase.insightContext,
      analysis: requestBase.analysis,
    }),
    [question, requestBase.analysis, requestBase.insightContext],
  );

  const submitQuestion = async () => {
    const validation = validateTalkToDataQuestion(question);

    if (!validation.ok) {
      setState({ status: "error", message: null, notice: validation.message });
      return;
    }

    setState({ status: "loading", message: null, notice: "Готовим ответ по профилю данных..." });

    const request: TalkToDataRequest = {
      ...requestBase,
      question: validation.question,
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
      const payload = await response.json() as {
        ok: boolean;
        message?: TalkToDataMessage;
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.message?.answer) {
        setState({
          status: "fallback",
          message: buildLocalTalkToDataAnswer(request),
          notice: "Показан локальный ответ: LLM временно недоступен.",
        });
        return;
      }

      setState({ status: "answered", message: payload.message, notice: null });
    } catch {
      setState({
        status: "fallback",
        message: buildLocalTalkToDataAnswer(request),
        notice: "Показан локальный ответ: LLM временно недоступен.",
      });
    }
  };

  return (
    <section data-testid="ask-data-panel" className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-saffron">Диалог с данными</p>
          <h3 className="mt-1 text-lg font-semibold text-sky">Спроси что-нибудь про эти данные</h3>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md bg-pine/10 px-3 py-2 text-sm font-semibold text-pine">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Контекст профиля
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <textarea
          data-testid="ask-data-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Например: какой отдел лидирует по выручке?"
            className="min-h-24 resize-none rounded-md border border-ink/12 bg-[#f8faff] p-3 text-sm leading-6 text-ink outline-none transition placeholder:text-graphite/60 focus:border-saffron focus:ring-2 focus:ring-saffron/30"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={remaining < 0 ? "text-sm font-semibold text-red-700" : "text-sm text-graphite"}>
            {remaining.toLocaleString("ru-RU")} символов
          </span>
          <button
            data-testid="ask-data-submit"
            type="button"
            onClick={() => void submitQuestion()}
            disabled={state.status === "loading"}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-sky px-4 text-sm font-semibold text-white transition hover:bg-[#1129d9] focus:outline-none focus:ring-2 focus:ring-sky/35 disabled:cursor-wait disabled:opacity-70"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
            {state.status === "loading" ? "Отвечаем..." : "Спросить"}
          </button>
        </div>
      </div>

      {state.notice ? (
        <p
          data-testid="ask-data-status"
          role={state.status === "error" ? "alert" : "status"}
          className={[
            "mt-4 rounded-md border px-3 py-2 text-sm leading-6",
            state.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-sky/25 bg-[#f2f5ff] text-ink",
          ].join(" ")}
        >
          {state.notice}
        </p>
      ) : null}

      {state.message ? (
        <div data-testid="ask-data-answer" className="mt-4 rounded-md border border-ink/10 bg-[#f8faff] p-4 text-sm leading-6 text-ink">
          <p>{state.message.answer}</p>
          {state.message.evidence.length > 0 ? (
            <ul className="mt-3 grid gap-1 text-graphite">
              {state.message.evidence.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

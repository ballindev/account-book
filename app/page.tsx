"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import BudgetPanel from "../components/BudgetPanel";
import ExpenseCharts from "../components/ExpenseCharts";
import { EXPENSE_CATEGORIES, ExpenseCategory } from "../lib/categories";
import { ExpenseRow, fetchExpenses, supabase } from "../lib/supabase";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type PanelTab = "list" | "chart";
type CategoryFilter = "전체" | ExpenseCategory;

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike> & {
    readonly length: number;
  };
};

type SpeechRecognitionErrorEventLike = {
  readonly error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    speechWindow.SpeechRecognition ||
    speechWindow.webkitSpeechRecognition ||
    null
  );
}

export default function Home() {
  const inputId = useId();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("list");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("전체");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "안녕하세요! 지출 기록도, 통계 질문도 말씀해 주세요.\n예: 오늘 점심 12,000원\n예: 이번 달 총 지출이 얼마야?\n마이크 버튼으로도 말할 수 있어요.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sendingRef = useRef(false);

  const loadExpenses = useCallback(async () => {
    const result = await fetchExpenses();
    if (result.error) {
      setExpenses([]);
      setLoadError(result.error);
      return;
    }

    setLoadError(null);
    setExpenses(result.data);
  }, []);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sendingRef.current) return;

      sendingRef.current = true;
      setSending(true);
      setSpeechHint(null);
      setInput("");

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          text,
        },
      ]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const data = (await response.json()) as {
          reply?: string;
          error?: string;
          saved?: boolean;
        };

        const replyText =
          data.reply ||
          data.error ||
          "답변을 받지 못했어요. 다시 시도해 주세요.";

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: replyText,
          },
        ]);

        if (data.saved) {
          await loadExpenses();
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
          },
        ]);
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [loadExpenses],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoadingExpenses(true);
      await loadExpenses();
      if (!cancelled) setLoadingExpenses(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadExpenses]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, listening]);

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    setSpeechSupported(Boolean(SpeechRecognitionCtor));
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;

        if (result.isFinal) {
          finalText += `${transcript} `;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInput(interim);
        setSpeechHint("듣는 중…");
      }

      const completed = finalText.trim();
      if (completed) {
        setInput(completed);
        setSpeechHint(null);
        void sendMessage(completed);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSpeechHint("마이크 권한이 필요해요. 브라우저 설정을 확인해 주세요.");
        return;
      }
      if (event.error === "no-speech") {
        setSpeechHint("음성이 감지되지 않았어요. 다시 눌러 말해 주세요.");
        return;
      }
      if (event.error === "aborted") {
        return;
      }

      setSpeechHint("음성 인식에 실패했어요. 다시 시도해 주세요.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [sendMessage]);

  async function handleDelete(id: number) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) {
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  const filteredExpenses =
    categoryFilter === "전체"
      ? expenses
      : expenses.filter((item) => item.category === categoryFilter);

  function toggleListening() {
    if (sending) return;

    const recognition = recognitionRef.current;
    if (!recognition || !speechSupported) {
      setSpeechHint(
        "이 브라우저에서는 음성 인식을 지원하지 않아요. Chrome(Android/PC)에서 사용해 주세요.",
      );
      return;
    }

    if (listening) {
      recognition.stop();
      setListening(false);
      setSpeechHint(null);
      return;
    }

    try {
      setSpeechHint("말씀해 주세요…");
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setSpeechHint("음성 인식을 시작할 수 없어요. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col overflow-x-hidden bg-background">
      <header className="shrink-0 border-b border-black/5 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="text-center text-[1.125rem] font-semibold tracking-tight text-foreground">
          AI 가계부 챗봇
        </h1>
      </header>

      <section className="shrink-0 border-b border-black/5 px-4 py-3">
        <BudgetPanel expenses={expenses} />

        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-surface p-1">
            <button
              type="button"
              onClick={() => setPanelTab("list")}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                panelTab === "list" ? "bg-accent text-white" : "text-muted"
              }`}
            >
              목록
            </button>
            <button
              type="button"
              onClick={() => setPanelTab("chart")}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                panelTab === "chart" ? "bg-accent text-white" : "text-muted"
              }`}
            >
              차트
            </button>
          </div>
          <p className="font-mono text-[12px] tabular-nums text-muted">
            {filteredExpenses.length}
            {categoryFilter !== "전체" ? `/${expenses.length}` : ""}건
          </p>
        </div>

        {panelTab === "list" ? (
          <div className="mb-2.5 flex gap-1.5 overflow-x-auto overscroll-contain pb-0.5">
            {(["전체", ...EXPENSE_CATEGORIES] as CategoryFilter[]).map(
              (category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    categoryFilter === category
                      ? "bg-accent text-white"
                      : "bg-surface text-muted"
                  }`}
                >
                  {category}
                </button>
              ),
            )}
          </div>
        ) : null}

        <div className="max-h-[28vh] overflow-y-auto overscroll-contain">
          {loadingExpenses ? (
            <p className="py-3 text-center text-[13px] text-muted">불러오는 중...</p>
          ) : loadError ? (
            <p className="rounded-2xl bg-surface px-3 py-3.5 text-center text-[13px] text-[#ff3b30]">
              지출 목록을 불러오지 못했어요: {loadError}
            </p>
          ) : panelTab === "chart" ? (
            <ExpenseCharts expenses={expenses} />
          ) : expenses.length === 0 ? (
            <p className="rounded-2xl bg-surface px-3 py-3.5 text-center text-[13px] text-muted">
              아직 저장된 지출이 없습니다
            </p>
          ) : filteredExpenses.length === 0 ? (
            <p className="rounded-2xl bg-surface px-3 py-3.5 text-center text-[13px] text-muted">
              {categoryFilter} 카테고리 지출이 없습니다
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredExpenses.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-surface px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-[15px] font-medium text-foreground">
                        {item.description}
                      </p>
                      <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted">
                        {item.category}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted">{item.date}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <p className="font-mono text-[15px] font-medium tabular-nums text-foreground">
                      {formatAmount(item.amount)}
                      <span className="ml-0.5 font-sans text-[11px] font-normal text-muted">
                        원
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[12px] text-muted transition-colors hover:text-foreground"
                      aria-label={`${item.description} 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <div className="flex flex-col gap-2.5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                  message.role === "user"
                    ? "rounded-br-md bg-bubble-user text-foreground"
                    : "rounded-bl-md bg-bubble-ai text-foreground ring-1 ring-black/[0.04]"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          {sending ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-bubble-ai px-3.5 py-2.5 text-[14px] text-muted">
                입력 중…
              </div>
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-black/5 bg-background px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {speechHint ? (
          <p className="mb-2 px-1 text-[12px] leading-snug text-muted" aria-live="polite">
            {speechHint}
          </p>
        ) : null}

        <div className="flex w-full min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              메시지 입력
            </label>
            <input
              id={inputId}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                listening ? "듣고 있어요…" : "지출 입력 또는 질문"
              }
              disabled={sending || listening}
              autoComplete="off"
              enterKeyHint="send"
              className="box-border h-12 w-full min-w-0 rounded-2xl bg-surface py-3 pr-12 pl-3.5 text-[16px] text-foreground outline-none transition placeholder:text-muted/70 focus:ring-2 focus:ring-foreground/10 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={toggleListening}
              disabled={sending}
              aria-pressed={listening}
              aria-label={listening ? "음성 인식 중지" : "음성으로 입력"}
              className={`absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
                listening
                  ? "animate-mic-pulse bg-[#ff3b30] text-white"
                  : "bg-transparent text-foreground"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-[22px] w-[22px]"
                fill="currentColor"
              >
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
              </svg>
            </button>
          </div>

          <button
            type="submit"
            disabled={sending || listening || !input.trim()}
            className="inline-flex h-12 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-[14px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            전송
          </button>
        </div>
      </form>
    </div>
  );
}

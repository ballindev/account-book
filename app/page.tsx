"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ExpenseRow, supabase } from "../lib/supabase";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export default function Home() {
  const inputId = useId();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "안녕하세요! 지출 기록도, 통계 질문도 말씀해 주세요.\n예: 오늘 점심 12,000원\n예: 이번 달 총 지출이 얼마야?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const loadExpenses = useCallback(async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, created_at, date, amount, description")
      .order("created_at", { ascending: false });

    if (error) {
      setExpenses([]);
      return;
    }

    setExpenses(data ?? []);
  }, []);

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
  }, [messages, sending]);

  async function handleDelete(id: number) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) {
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

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
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-lg flex-col bg-background">
      <header className="shrink-0 border-b border-black/5 px-4 py-3.5 sm:px-5">
        <h1 className="text-center text-[1.15rem] font-semibold tracking-tight text-foreground sm:text-xl">
          AI 가계부 챗봇
        </h1>
      </header>

      <section className="shrink-0 border-b border-black/5 px-4 py-3 sm:px-5">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-medium text-muted">저장된 지출</h2>
          <p className="font-mono text-[12px] tabular-nums text-muted">
            {expenses.length}건
          </p>
        </div>

        {loadingExpenses ? (
          <p className="py-4 text-center text-[13px] text-muted">불러오는 중...</p>
        ) : expenses.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-4 text-center text-[13px] text-muted">
            아직 저장된 지출이 없습니다
          </p>
        ) : (
          <ul className="flex max-h-[28vh] flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5">
            {expenses.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-foreground">
                    {item.description}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">{item.date}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="font-mono text-[15px] font-medium tabular-nums text-foreground">
                    {formatAmount(item.amount)}
                    <span className="ml-0.5 font-sans text-[11px] font-normal text-muted">
                      원
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center text-[12px] text-muted transition-colors hover:text-foreground"
                    aria-label={`${item.description} 삭제`}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        ref={chatContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
      >
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed sm:text-[14px] ${
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
        className="shrink-0 border-t border-black/5 bg-background px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      >
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            메시지 입력
          </label>
          <input
            id={inputId}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="지출 입력 또는 질문해 보세요"
            disabled={sending}
            autoComplete="off"
            className="min-h-[48px] flex-1 rounded-2xl bg-surface px-4 py-3 text-[16px] text-foreground outline-none transition placeholder:text-muted/70 focus:ring-2 focus:ring-foreground/10 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex h-12 min-w-[56px] items-center justify-center rounded-2xl bg-accent px-4 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            전송
          </button>
        </div>
      </form>
    </div>
  );
}

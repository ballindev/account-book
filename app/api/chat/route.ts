import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import {
  ExpenseCategory,
  normalizeCategory,
} from "../../../lib/categories";
import { ExpenseRow, fetchExpenses, insertExpense } from "../../../lib/supabase";

type ChatRequestBody = {
  message?: string;
};

type ExpenseData = {
  date: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
};

type GeminiExpensePayload = {
  reply: string;
  expense: {
    date: string;
    amount: number;
    description: string;
    category?: string;
  } | null;
  incomplete?: boolean;
};

type Intent = "question" | "expense";

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
];

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function formatKoreanDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return `${year}년 ${month}월 ${day}일`;
}

function buildConfirmationReply(expense: ExpenseData) {
  return `${formatKoreanDate(expense.date)} ${expense.description} ${formatAmount(expense.amount)}원을 ${expense.category} 카테고리로 저장했어요!`;
}

function hasAmount(message: string) {
  return (
    /\d[\d,]*\s*원/.test(message) ||
    /\d+\s*만\s*원?/.test(message) ||
    /\d+\s*천\s*원?/.test(message) ||
    /만\s*\d*\s*천?\s*원/.test(message)
  );
}

function hasQuestionCue(message: string) {
  return (
    /[?？]/.test(message) ||
    /(얼마|얼마나|뭐|어떤|어떻게|왜|언제|어디|누가|총액|총\s*지출|합계|통계|알려줘|보여줘|정리해|분석|가장\s*많이|제일\s*많이|뭐야|뭐였|샀더라|쓰고\s*있)/.test(
      message,
    )
  );
}

function classifyIntent(message: string): Intent {
  const question = hasQuestionCue(message);
  const amount = hasAmount(message);

  if (
    question &&
    /(얼마|얼마나|뭐|어떻게|가장|제일|총|합계|통계|샀더라|알려줘|보여줘)/.test(
      message,
    )
  ) {
    return "question";
  }

  if (amount) return "expense";
  if (question) return "question";
  return "question";
}

function buildExpenseSystemPrompt(today: string) {
  return `당신은 친근한 AI 가계부 챗봇입니다.
사용자가 한국어로 지출을 말하면 날짜·금액·내용·카테고리를 추출합니다.
오늘은 ${today} 입니다.

날짜 규칙:
- "오늘", "어제", "그제" 같은 상대 날짜는 실제 YYYY-MM-DD로 변환
- 날짜 언급이 없으면 오늘(${today}) 사용

금액 규칙:
- "2만 원", "1만5천원", "15000원" 모두 정수 원 단위로 변환 (예: 20000)
- 금액이 없으면 expense는 null, incomplete는 true

내용 규칙:
- description은 짧고 명확하게 (예: 택시, 점심, 커피)

카테고리 규칙:
- category는 반드시 다음 중 하나만 사용: 식비, 교통, 쇼핑, 문화, 기타
- 식비: 식사, 커피, 배달, 간식 등
- 교통: 택시, 버스, 지하철, 주유 등
- 쇼핑: 마트, 옷, 온라인 구매 등
- 문화: 영화, 공연, 구독, 취미, 도서 등
- 애매하면 기타

반드시 아래 JSON만 출력하세요.
{
  "reply": "사용자에게 보여줄 한국어 답변",
  "expense": null 또는 {
    "date": "YYYY-MM-DD",
    "amount": 정수,
    "description": "내용",
    "category": "식비|교통|쇼핑|문화|기타"
  },
  "incomplete": true 또는 false
}

규칙:
- 날짜·금액·내용이 모두 파악되면 expense에 넣고 incomplete는 false.
- 금액이나 내용이 불명확하면 expense는 null, incomplete는 true로 두고 다시 물어보세요.`;
}

function buildStatsSystemPrompt(today: string) {
  return `당신은 친근한 AI 가계부 비서입니다.
오늘은 ${today} 입니다.
아래에 제공된 지출 데이터만 근거로 사용자 질문에 답하세요.
데이터에 없는 내용은 추측하지 말고, 없다고 자연스럽게 말해 주세요.

답변 톤:
- 자연스럽고 친근한 한국어
- 핵심 숫자(합계, 건수, 항목, 카테고리)를 분명히
- 필요하면 짧게 근거를 덧붙이기
- JSON이나 코드 블록 없이 일반 문장으로만 답변

기간 해석:
- 이번 달 / 지난주 / 어제 / 오늘 등은 오늘(${today}) 기준으로 계산`;
}

function parseGeminiJson(text: string): GeminiExpensePayload & {
  expense: ExpenseData | null;
} {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const parsed = JSON.parse(cleaned) as GeminiExpensePayload;

  if (!parsed || typeof parsed.reply !== "string") {
    throw new Error("Invalid Gemini response shape");
  }

  if (parsed.expense == null) {
    return {
      reply: parsed.reply,
      expense: null,
      incomplete: Boolean(parsed.incomplete),
    };
  }

  const amount = Number(parsed.expense.amount);
  const date = String(parsed.expense.date || "").trim();
  const description = String(parsed.expense.description || "").trim();
  const category = normalizeCategory(parsed.expense.category);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date);

  if (!dateValid || !description || !Number.isFinite(amount) || amount <= 0) {
    return {
      reply:
        parsed.reply ||
        "날짜나 금액을 정확히 파악하지 못했어요. 예: 어제 택시 20000원",
      expense: null,
      incomplete: true,
    };
  }

  return {
    reply: parsed.reply,
    incomplete: false,
    expense: {
      date,
      amount: Math.round(amount),
      description,
      category,
    },
  };
}

function userFacingApiError(error: unknown) {
  const raw =
    error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

  if (/GEMINI_API_KEY/i.test(raw)) {
    return "Gemini API 키가 설정되지 않았어요. .env.local을 확인해 주세요.";
  }
  if (/503|high demand|unavailable/i.test(raw)) {
    return "AI 서버가 잠시 바쁘네요. 잠시 후 다시 시도해 주세요.";
  }
  if (/429|quota|rate.?limit|Too Many Requests/i.test(raw)) {
    return "AI 요청 한도를 잠시 넘었어요. 잠시 후 다시 시도해 주세요.";
  }
  if (/401|403|API key|permission/i.test(raw)) {
    return "Gemini API 인증에 실패했어요. API 키를 확인해 주세요.";
  }
  if (/404|not found|no longer available/i.test(raw)) {
    return "AI 모델을 찾을 수 없어요. 잠시 후 다시 시도해 주세요.";
  }

  return "죄송해요. AI 응답 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

async function generateWithGemini(options: {
  apiKey: string;
  prompt: string;
  userText: string;
  json?: boolean;
  temperature?: number;
}) {
  const genAI = new GoogleGenerativeAI(options.apiKey);
  let lastError: unknown;

  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          ...(options.json ? { responseMimeType: "application/json" } : {}),
          temperature: options.temperature ?? 0.3,
        },
      });

      const result = await model.generateContent([
        { text: options.prompt },
        { text: options.userText },
      ]);

      return result.response.text().trim();
    } catch (error) {
      lastError = error;
      const raw = error instanceof Error ? error.message : "";
      if (
        !/503|high demand|unavailable|404|no longer available|429|quota|rate.?limit|Too Many Requests/i.test(
          raw,
        )
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini API 호출에 실패했습니다.");
}

async function fetchAllExpenses() {
  const result = await fetchExpenses();
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data as ExpenseRow[];
}

async function handleExpenseMessage(
  apiKey: string,
  message: string,
  today: string,
) {
  const rawText = await generateWithGemini({
    apiKey,
    prompt: buildExpenseSystemPrompt(today),
    userText: `사용자 메시지: ${message}`,
    json: true,
    temperature: 0.2,
  });

  const parsed = parseGeminiJson(rawText);

  if (!parsed.expense) {
    return NextResponse.json({
      reply:
        parsed.reply ||
        "날짜나 금액을 파악하지 못했어요. 예: 오늘 점심 15000원",
      saved: false,
      incomplete: Boolean(parsed.incomplete),
      intent: "expense",
    });
  }

  const insertResult = await insertExpense({
    date: parsed.expense.date,
    amount: parsed.expense.amount,
    description: parsed.expense.description,
    category: parsed.expense.category,
  });

  if (insertResult.error) {
    return NextResponse.json({
      reply: "지출은 이해했지만 저장에 실패했어요. 잠시 후 다시 시도해 주세요.",
      saved: false,
      error: insertResult.error,
      intent: "expense",
    });
  }

  const reply = insertResult.categorySupported
    ? buildConfirmationReply(parsed.expense)
    : `${buildConfirmationReply(parsed.expense)} (참고: category 컬럼이 없어 기타로 보일 수 있어요. Supabase에 category 컬럼을 추가해 주세요.)`;

  return NextResponse.json({
    reply,
    saved: true,
    expense: parsed.expense,
    intent: "expense",
  });
}

async function handleQuestionMessage(
  apiKey: string,
  message: string,
  today: string,
) {
  const expenses = await fetchAllExpenses();

  if (expenses.length === 0) {
    return NextResponse.json({
      reply:
        "아직 저장된 지출이 없어요. 먼저 “오늘 점심 12000원”처럼 지출을 알려주시면 바로 분석해 드릴게요!",
      saved: false,
      intent: "question",
    });
  }

  const expenseLines = expenses
    .map(
      (item) =>
        `- date: ${item.date}, amount: ${item.amount}, description: ${item.description}, category: ${item.category}`,
    )
    .join("\n");

  const reply = await generateWithGemini({
    apiKey,
    prompt: buildStatsSystemPrompt(today),
    userText: `지출 데이터 (${expenses.length}건):\n${expenseLines}\n\n사용자 질문: ${message}`,
    json: false,
    temperature: 0.4,
  });

  return NextResponse.json({
    reply:
      reply ||
      "데이터를 살펴봤는데 답변을 만들지 못했어요. 질문을 조금만 다르게 물어봐 주시겠어요?",
    saved: false,
    intent: "question",
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY가 설정되지 않았습니다.",
          reply: "Gemini API 키가 설정되지 않았어요. .env.local을 확인해 주세요.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        {
          error: "메시지를 입력해 주세요.",
          reply: "메시지를 입력해 주세요.",
        },
        { status: 400 },
      );
    }

    const today = todayString();
    const intent = classifyIntent(message);

    if (intent === "question") {
      return await handleQuestionMessage(apiKey, message, today);
    }

    return await handleExpenseMessage(apiKey, message, today);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        reply: userFacingApiError(error),
      },
      { status: 500 },
    );
  }
}

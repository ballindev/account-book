"use client";

export type AppTab = "chat" | "calendar" | "chart" | "settings";

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: "chat", label: "채팅" },
  { id: "calendar", label: "달력" },
  { id: "chart", label: "차트" },
  { id: "settings", label: "설정" },
];

type BottomNavProps = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

function TabIcon({ id, active }: { id: AppTab; active: boolean }) {
  const stroke = active ? "currentColor" : "currentColor";

  if (id === "chat") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M5 6.5h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H10l-4.5 3v-3H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" />
      </svg>
    );
  }

  if (id === "calendar") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8">
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
      </svg>
    );
  }

  if (id === "chart") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M4 19h16M7 16V10M12 16V6M17 16v-7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.2 6.2l1.6 1.6M16.2 16.2l1.6 1.6M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6" />
    </svg>
  );
}

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="shrink-0 border-t border-black/5 bg-background px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <ul className="grid grid-cols-4 gap-1">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] transition-colors ${
                  isActive ? "bg-surface text-foreground" : "text-muted"
                }`}
              >
                <TabIcon id={tab.id} active={isActive} />
                <span className={isActive ? "font-medium" : ""}>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

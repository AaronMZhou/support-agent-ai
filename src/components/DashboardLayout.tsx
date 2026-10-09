import { useState } from "react";
import { Phone, BookOpen, Code, Zap, Ticket, LogOut } from "lucide-react";
import CallAssistantPage from "@/pages/CallAssistantPage";
import KnowledgeBasePage from "@/pages/KnowledgeBasePage";
import DebugPage from "@/pages/DebugPage";
import TicketsPage from "@/pages/TicketsPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Tab = "call" | "tickets" | "kb" | "debug";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "call", label: "Call Assistant", icon: <Phone className="h-4 w-4" /> },
  { id: "tickets", label: "Tickets", icon: <Ticket className="h-4 w-4" /> },
  { id: "kb", label: "Knowledge Base", icon: <BookOpen className="h-4 w-4" /> },
  { id: "debug", label: "API Debug", icon: <Code className="h-4 w-4" /> },
];

export default function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<Tab>("call");
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                <Zap className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="hidden md:block">
                <h1 className="text-sm font-bold leading-tight">ASCTech AI Call Assistant</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">Internal IT Support Tool</p>
              </div>
            </div>
            <span className="env-badge">TEST</span>
          </div>

          <nav className="flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.icon}
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
            <span className="hidden xl:inline text-xs text-muted-foreground ml-3 max-w-[180px] truncate">{user?.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              title="Sign out"
              className="ml-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* Keep the call page mounted so an in-progress call survives tab switches */}
        <div className={activeTab === "call" ? "" : "hidden"}><CallAssistantPage /></div>
        {activeTab === "tickets" && <TicketsPage />}
        {activeTab === "kb" && <KnowledgeBasePage />}
        {activeTab === "debug" && <DebugPage />}
      </main>
    </div>
  );
}

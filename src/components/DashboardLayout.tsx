import { useState } from "react";
import { Phone, BookOpen, Code, Zap } from "lucide-react";
import CallAssistantPage from "@/pages/CallAssistantPage";
import KnowledgeBasePage from "@/pages/KnowledgeBasePage";
import DebugPage from "@/pages/DebugPage";

type Tab = "call" | "kb" | "debug";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "call", label: "Call Assistant", icon: <Phone className="h-4 w-4" /> },
  { id: "kb", label: "Knowledge Base", icon: <BookOpen className="h-4 w-4" /> },
  { id: "debug", label: "API Debug", icon: <Code className="h-4 w-4" /> },
];

export default function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<Tab>("call");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                <Zap className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight">ASCTech AI Call Assistant</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">Internal IT Support Tool</p>
              </div>
            </div>
            <span className="env-badge ml-2">TEST</span>
          </div>

          {/* Tabs */}
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
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main>
        {activeTab === "call" && <CallAssistantPage />}
        {activeTab === "kb" && <KnowledgeBasePage />}
        {activeTab === "debug" && <DebugPage />}
      </main>
    </div>
  );
}

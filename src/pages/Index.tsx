import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import AuthPage from "@/pages/AuthPage";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return session ? <DashboardLayout /> : <AuthPage />;
};

export default Index;

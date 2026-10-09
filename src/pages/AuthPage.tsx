import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setInfo("");
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
      });
      if (error) setError(error.message);
      else if (!data.session) setInfo("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  };

  const google = async () => {
    setError("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setError(result.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="dashboard-card w-full max-w-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <Zap className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">ASCTech AI Call Assistant</h1>
              <p className="text-[10px] text-muted-foreground">Technician sign-in</p>
            </div>
          </div>
          <CardTitle className="text-base">{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required className="h-9" />
              </div>
            )}
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-9" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && <p className="text-xs text-success">{info}</p>}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}
          >
            {mode === "signin" ? "New technician? Create an account" : "Already have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

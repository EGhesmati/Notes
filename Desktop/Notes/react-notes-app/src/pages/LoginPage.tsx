import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StickyNote, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "show-passcode">("login");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleLogin = async () => {
    setError("");
    try {
      await signIn(name, passcode);
    } catch {
      setError("Invalid name or passcode");
    }
  };

  const handleRegister = async () => {
    setError("");
    try {
      const code = await signUp(name);
      setGeneratedCode(code);
      setMode("show-passcode");
    } catch {
      setError("Name already taken");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
  };

  if (mode === "show-passcode") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
        <StickyNote className="h-10 w-10 text-primary" />
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg text-center">
          <h2 className="text-lg font-semibold text-foreground">Your passcode</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Copy it now — you won't see it again.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-4 py-2 text-lg font-mono font-bold text-foreground tracking-widest">
              {generatedCode}
            </code>
            <Button variant="outline" size="icon" onClick={copyCode} className="h-10 w-10">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => signIn(name, generatedCode)}
          >
            Sign in with this passcode
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex flex-col items-center gap-2">
        <StickyNote className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notes App</h1>
        <p className="text-sm text-muted-foreground">write it down, keep it safe</p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-0.5">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
              mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
              mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Register
          </button>
        </div>

        <div className="space-y-3">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") mode === "login" ? handleLogin() : handleRegister();
            }}
          />
          {mode === "login" && (
            <Input
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          )}
          {error && (
            <p className="text-xs text-rose-500">{error}</p>
          )}
          <Button
            className="w-full"
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={!name.trim() || (mode === "login" && !passcode.trim())}
          >
            {mode === "login" ? "Sign in" : "Register"}
          </Button>

          <button
            onClick={() => {
              const offlineUser = { id: 0, name: "offline" };
              localStorage.setItem("token", "offline");
              localStorage.setItem("user", JSON.stringify(offlineUser));
              window.location.reload();
            }}
            className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue offline (localStorage)
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { AppIcon } from "@/components/AppIcon";

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [regName, setRegName] = useState("");
  const [regPasscode, setRegPasscode] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [error, setError] = useState("");

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setError("");
  };

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
    if (regPasscode.length < 4) {
      setError("Passcode must be at least 4 characters");
      return;
    }
    if (regPasscode !== regConfirm) {
      setError("Passcodes do not match");
      return;
    }
    try {
      await signUp(regName, regPasscode);
    } catch {
      setError("Name already taken");
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex flex-col items-center gap-2">
        <AppIcon className="h-10 w-10" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notes App</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "login" ? "write it down, keep it safe" : "Create your account"}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-md">
        <div className="mb-5 flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => switchMode("login")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all duration-150 ${
              mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => switchMode("register")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all duration-150 ${
              mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Register
          </button>
        </div>

        <div className="space-y-3">
          <Input
            placeholder="Name"
            value={mode === "login" ? name : regName}
            onChange={(e) => (mode === "login" ? setName(e.target.value) : setRegName(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
          />
          {mode === "login" ? (
            <Input
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          ) : (
            <>
              <Input
                type="password"
                placeholder="Choose a passcode (4+ chars)"
                value={regPasscode}
                onChange={(e) => setRegPasscode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
              <Input
                type="password"
                placeholder="Confirm passcode"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
            </>
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <Button
            className="w-full"
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={
              mode === "login"
                ? !name.trim() || !passcode.trim()
                : !regName.trim() || !regPasscode.trim() || !regConfirm.trim()
            }
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>

          {mode === "login" && (
            <button
              onClick={() => {
                const offlineUser = { id: 0, name: "offline" };
                localStorage.setItem("token", "offline");
                localStorage.setItem("user", JSON.stringify(offlineUser));
                window.location.reload();
              }}
              className="mt-3 w-full text-center text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors duration-150"
            >
              Continue offline (localStorage)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import {useTranslation} from "react-i18next";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";

export function LoginPage() {
  const {t}=useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setIsLoading(true);
      await login(email, password);
      toast("Welcome back!", "success");
      navigate("/dashboard");
    } catch (err: any) {
      toast(err.message || "Invalid email or password", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-7">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight text-foreground">
            <img src="/kanbrix.svg" alt="" width="32" height="32" />
            <span className="text-lg">
              Kanbrix
            </span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("Sign in to your account")}</h1>
          <p className="text-xs text-muted-foreground">Enter your credentials below to access your workspaces</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label={t("Email")}
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="password"
              label={t("Password")}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              {t("Sign In")}
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

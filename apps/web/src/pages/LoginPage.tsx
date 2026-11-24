import {useTranslation} from "react-i18next";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export function LoginPage() {
  useDocumentMeta({
    title: "Sign in | Kanbrix",
    description: "Sign in to your Kanbrix workspace to manage issues, Kanban boards, and sprints.",
  });
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
    <div className="min-h-screen bg-gradient-to-b from-primary/[0.05] via-background to-background flex flex-col items-center justify-center p-4">
      <div className="auth-layout rounded-2xl border border-border/75 bg-card p-6 sm:p-8 shadow-[var(--shadow-lg)]">
        <div className="space-y-3">
          <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight text-foreground">
            <img src="/kanbrix.svg" alt="" width="32" height="32" />
            <span className="text-lg">
              Kanbrix
            </span>
          </Link>
          <h1 className="page-heading">{t("Sign in to your account")}</h1>
          <p className="text-xs text-muted-foreground">Enter your credentials below to access your workspaces</p>
        </div>

        <div className="border-t border-border pt-6 space-y-4 md:border-t-0 md:border-l md:pl-10 md:pt-0">
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

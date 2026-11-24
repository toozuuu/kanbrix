import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export function RegisterPage() {
  useDocumentMeta({
    title: "Create an account | Kanbrix",
    description: "Create a Kanbrix account to start tracking issues, Kanban boards, and sprints.",
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    if (password.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }

    try {
      setIsLoading(true);
      await register(name, email, password);
      toast("Account created successfully! Default workspace initialized.", "success");
      navigate("/dashboard");
    } catch (err: any) {
      toast(err.message || "Registration failed", "error");
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
          <h1 className="page-heading">Create your account</h1>
          <p className="text-xs text-muted-foreground">Start tracking projects with blazing fast Rust performance</p>
        </div>

        <div className="border-t border-border pt-6 space-y-4 md:border-t-0 md:border-l md:pl-10 md:pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Full Name"
              placeholder="Alex Mercer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              type="email"
              label="Email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="password"
              label="Password (min. 8 characters)"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

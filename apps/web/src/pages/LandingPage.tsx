import { Link } from "react-router-dom";
import { Zap, ShieldCheck, Kanban, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Navigation */}
      <nav className="h-16 border-b border-border/60 bg-card/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight">
            Rust<span className="text-primary">Track</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm" className="gap-1.5 shadow-sm">
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 max-w-5xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold tracking-wide animate-in fade-in-0 slide-in-from-top-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Self-Hosted • Blazing Fast Rust Monolith • AGPL-3.0</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl">
          The Developer-First Issue Tracker Engineered for{" "}
          <span className="bg-gradient-to-r from-primary via-indigo-500 to-sky-400 bg-clip-text text-transparent">
            Extreme Velocity.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Take full control of your engineering workflows with a modern Jira alternative.
          Powered by Rust and React, featuring instant Kanban interactions, strict multi-tenant
          isolation, and sprint planning.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link to="/register">
            <Button size="lg" className="gap-2 shadow-lg">
              <span>Start Free & Self-Host</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="lg">
              Demo Sign In
            </Button>
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 text-left w-full">
          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-3 hover:border-primary/50 transition-all shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Rust Microsecond Core</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Axum and Tokio handle hundreds of thousands of concurrent requests with near-zero memory footprint.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-3 hover:border-primary/50 transition-all shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Kanban className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Intuitive Drag-and-Drop</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fluid Kanban boards with optimistic ordering, instant status transitions, and keyboard shortcuts.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-3 hover:border-primary/50 transition-all shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Air-Tight Multi-Tenancy</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Argon2id password hashing, HttpOnly session cookies, and workspace-level query isolation.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <p>© 2026 RustTrack Open Source Project. Licensed under AGPL-3.0.</p>
      </footer>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DemoBoard, initial, stages, tasks, type BoardProps } from "./DemoBoard";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, Check, ChevronDown, Columns3, GitBranch, List, RotateCcw, Share2 } from "lucide-react";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import "./landing.css";

const FEATURES = [
  {
    title: "Custom Kanban workflows",
    body: "Define workflow columns, transition rules, and reusable organization templates tailored to each team.",
  },
  {
    title: "Sprint planning & backlog",
    body: "Prioritize your backlog, plan sprints, and track team velocity and burndown without configuration bloat.",
  },
  {
    title: "Issue forms & custom fields",
    body: "Enforce required fields, issue types, and priorities across your workspace while allowing project overrides.",
  },
  {
    title: "Self-hosted Rust & PostgreSQL",
    body: "Run a fast, single-binary Rust API backed by PostgreSQL with real-time board updates and full data ownership.",
  },
];

const FAQS = [
  {
    question: "Is Kanbrix a free, open-source Jira alternative?",
    answer:
      "Yes. Kanbrix is open-source issue tracking and project management software you can self-host for free on your own servers or Docker.",
  },
  {
    question: "How do teams self-host Kanbrix?",
    answer:
      "Deploy Kanbrix with Docker Compose or run the Rust API binary with PostgreSQL and the React frontend behind your reverse proxy.",
  },
  {
    question: "Does Kanbrix support Kanban boards, sprints, and custom workflows?",
    answer:
      "Yes. Every project can use organization templates or custom columns, workflow transitions, sprint planning, and custom issue fields.",
  },
];

const useBoardLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function LandingPage() {
  useDocumentMeta({
    title: "Kanbrix | Open-Source Jira Alternative",
    description:
      "Kanbrix is an open-source, self-hosted Jira alternative. Track issues, manage Kanban boards, and plan sprints with a Rust and React app.",
  });
  const [positions, setPositions] = useState(initial);
  const [list, setList] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    const saved = new URLSearchParams(window.location.search).get("demo");
    if (saved && /^[012]{3}$/.test(saved)) setPositions([...saved].map(Number));
  }, []);
  const demo = useRef<HTMLElement>(null);
  const previousCardPositions = useRef(new Map<string, DOMRect>());
  const focusedCard = useRef<string>();
  const [Board, setBoard] = useState<ComponentType<BoardProps>>(() => DemoBoard);
  useEffect(() => {
    let active = true;
    const load = () => { void import("./DraggableDemo").then(module => {
      if (active) setBoard(() => module.default);
    }).catch(() => {}); };
    if (!demo.current || !window.IntersectionObserver) { load(); return () => { active = false; }; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: "150px" });
    observer.observe(demo.current);
    return () => { active = false; observer.disconnect(); };
  }, []);
  function captureBoard() {
    const cards = demo.current?.querySelectorAll<HTMLElement>("[data-demo-card]");
    const active = document.activeElement;
    focusedCard.current = active?.matches("[data-demo-action]")
      ? active.closest<HTMLElement>("[data-demo-card]")?.dataset.demoCard
      : undefined;
    previousCardPositions.current.clear();
    if (!window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches) return;
    cards?.forEach(card => {
      const ticket = card.firstElementChild;
      if (card.dataset.demoCard && ticket) {
        previousCardPositions.current.set(card.dataset.demoCard, ticket.getBoundingClientRect());
      }
    });
  }

  useBoardLayoutEffect(() => {
    demo.current?.querySelectorAll<HTMLElement>("[data-demo-card]").forEach(card => {
      const key = card.dataset.demoCard;
      if (!key) return;
      if (focusedCard.current === key) {
        card.querySelector<HTMLElement>("[data-demo-action]")?.focus({ preventScroll: true });
      }
      const previous = previousCardPositions.current.get(key);
      if (!previous || typeof card.animate !== "function") return;
      card.getAnimations().forEach(animation => animation.cancel());
      const next = card.getBoundingClientRect();
      const x = previous.left - next.left;
      const y = previous.top - next.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
      card.animate(
        [{ translate: `${x}px ${y}px` }, { translate: "0 0" }],
        { duration: 360, easing: "cubic-bezier(.2,.75,.25,1)" },
      );
    });
    previousCardPositions.current.clear();
    focusedCard.current = undefined;
  }, [positions, list]);

  function move(index: number, next = (positions[index] + 1) % stages.length) {
    if (positions[index] === next) return;
    captureBoard();
    setPositions(previous => previous.map((value, i) => i === index ? next : value));
    setNotice(tasks[index].title + " moved to " + stages[next]);
    setShareUrl("");
  }
  function changeView(next: boolean) {
    if (list === next) return;
    captureBoard();
    setList(next);
  }
  async function share() {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("demo", positions.join(""));
    url.hash = "demo";
    try {
      await navigator.clipboard.writeText(url.href);
      setNotice("Board link copied.");
    } catch {
      setShareUrl(url.href);
      setNotice("Select and copy your board link.");
    }
  }
  const done = positions.filter(stage => stage === 2).length;
  return <div className="launch">
    <header className="launch-nav"><Link to="/" className="launch-brand"><img src="/kanbrix.svg" width="36" height="36" alt="Kanbrix logo"/>Kanbrix</Link>
      <nav aria-label="Site"><a href="#features">Features</a><a href="#demo">Live board</a><a href="#faq">FAQ</a><Link to="/login">Sign in <ArrowRight size={15}/></Link></nav>
    </header>
    <main>
      <section className="launch-hero">
        <div className="launch-copy">
          <h1>Your board.<br/><em>Your rules.</em></h1>
          <p>Plan sprints and track issues on a board your team controls. Kanbrix is open source and runs on your own infrastructure.</p>
          <div className="launch-actions"><Link to="/register">Create an account <ArrowRight size={17}/></Link><a href="#demo">Explore the board <ArrowDown size={15}/></a></div>
        </div>
        <div className="release-preview">
          <div className="release-heading"><span><GitBranch size={16}/> Release workflow</span><span className="release-key">{tasks[0].key}</span></div>
          <div className="release-track" role="group" aria-label="Release workflow stages">
            <div className="release-track-line"><i style={{width: positions[0] * 50 + "%"}}/></div>
            {stages.map((stage, i) => (
              <button type="button" key={stage} className="release-stop" data-reached={i <= positions[0]}
                aria-pressed={i === positions[0]} onClick={() => move(0, i)}>
                <span aria-hidden="true">{i < positions[0] || (i === 2 && positions[0] === 2) ? <Check size={13}/> : <i/>}</span>
                {stage}
              </button>
            ))}
          </div>
          <div className="release-ticket">
            <div className="release-ticket-body" key={positions[0]}>
              <span className="release-state">{stages[positions[0]]}</span>
              <h2>{tasks[0].title}</h2>
            </div>
            <button onClick={() => move(0)} aria-label={tasks[0].title + ": " + ["start work","complete work","reopen issue"][positions[0]]}>
              {["Start work","Mark done","Reopen issue"][positions[0]]}
              {positions[0] === 2 ? <RotateCcw size={15}/> : <ArrowRight size={15}/>}
            </button>
          </div>
        </div>
      </section>
      <section ref={demo} id="demo" className="launch-demo" aria-label="Interactive sample board">
        <div className="demo-title"><div><p>Interactive demo</p><h2>Release board</h2></div>
          <div className="demo-tools">
            <button aria-pressed={!list} onClick={() => changeView(false)}><Columns3 size={15}/>Board</button>
            <button aria-pressed={list} onClick={() => changeView(true)}><List size={15}/>List</button>
            <button onClick={share}><Share2 size={15}/>Share</button>
          </div>
        </div>
        <div className="demo-progress">
          <Check size={14} aria-hidden="true"/>{done} of {tasks.length} issues done
          <progress className="sr-only" aria-label="Demo completion" value={done} max={tasks.length}/>
          <span className="demo-meter" aria-hidden="true"><span style={{ transform: `scaleX(${done / tasks.length})` }}/></span>
        </div>
        <p className="demo-help">Drag an issue by its title, or use its action button to change status.</p>
        <Board positions={positions} list={list} move={move}/>
        <p className="demo-notice" role="status">{notice}</p>
        {shareUrl && <input aria-label="Shareable demo link" value={shareUrl} readOnly onFocus={e => e.target.select()}/>}
      </section>
      <section id="features" className="launch-section" aria-labelledby="features-heading">
        <div className="launch-section-head">
          <p>Why Kanbrix</p>
          <h2 id="features-heading">Open-source issue tracking built for engineering teams</h2>
        </div>
        <div className="launch-features">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="launch-feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="faq" className="launch-section" aria-labelledby="faq-heading">
        <div className="launch-section-head">
          <p>FAQ</p>
          <h2 id="faq-heading">Frequently asked questions</h2>
        </div>
        <div className="launch-faq">
          {FAQS.map((item) => (
            <details key={item.question} className="launch-faq-item">
              <summary>{item.question}<ChevronDown size={18} aria-hidden="true"/></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
    <footer className="launch-footer mx-auto max-w-6xl px-6 py-8 text-sm">
      <a className="underline underline-offset-4" href="https://github.com/toozuuu/kanbrix" target="_blank" rel="noopener noreferrer">Kanbrix source code on GitHub</a>
    </footer>
  </div>;
}

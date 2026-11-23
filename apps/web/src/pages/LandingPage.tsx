import { useEffect, useRef, useState } from "react";
import { DemoBoard, initial, stages, tasks, type BoardProps } from "./DemoBoard";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Columns3, List, Share2 } from "lucide-react";
import "./landing.css";

export function LandingPage() {
  const [positions, setPositions] = useState(initial);
  const [list, setList] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    const saved = new URLSearchParams(window.location.search).get("demo");
    if (saved && /^[012]{3}$/.test(saved)) setPositions([...saved].map(Number));
  }, []);
  const demo = useRef<HTMLElement>(null);
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
  function move(index: number, next = (positions[index] + 1) % stages.length) {
    if (positions[index] === next) return;
    setPositions(previous => previous.map((value, i) => i === index ? next : value));
    setNotice(tasks[index].title + " moved to " + stages[next]);
    setShareUrl("");
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
    <header className="launch-nav"><Link to="/" className="launch-brand"><img src="/kanbrix.svg" width="36" height="36" alt=""/>Kanbrix</Link>
      <nav aria-label="Site"><a href="#demo">Live board</a><Link to="/login">Sign in <ArrowRight size={15}/></Link></nav>
    </header>
    <main>
      <section className="launch-hero">
        <div className="launch-copy">
          <h1>From backlog<br/>to <em>shipped.</em></h1>
          <p>Kanbrix is an open-source Jira alternative for teams that want to self-host their issue tracker. Plan sprints, assign work, and see what’s ready to ship.</p>
          <div className="launch-actions"><Link to="/register">Create an account <ArrowRight size={17}/></Link><a href="#demo">Try the board ↓</a></div>
        </div>
        <div className="launch-print" aria-hidden="true"><div className="print-grid"/><div className="print-stack"><img src="/kanbrix.svg" alt=""/></div></div>
      </section>
      <section ref={demo} id="demo" className="launch-demo" aria-label="Interactive sample board">
        <div className="demo-title"><div><p>Interactive demo</p><h2>Release board</h2></div>
          <div className="demo-tools">
            <button aria-pressed={!list} onClick={() => setList(false)}><Columns3 size={15}/>Board</button>
            <button aria-pressed={list} onClick={() => setList(true)}><List size={15}/>List</button>
            <button onClick={share}><Share2 size={15}/>Share</button>
          </div>
        </div>
        <div className="demo-progress"><Check size={14}/>{done} of {tasks.length} issues done <progress value={done} max={tasks.length}/></div>
        <p className="demo-help">Drag an issue by its title, or use its action button to change status.</p>
        <Board positions={positions} list={list} move={move}/>
        <p className="demo-notice" role="status">{notice}</p>
        {shareUrl && <input aria-label="Shareable demo link" value={shareUrl} readOnly onFocus={e => e.target.select()}/>}
      </section>
    </main>
  </div>;
}

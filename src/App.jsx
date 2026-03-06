import { useState, useEffect, useRef } from "react";

// ── Pantone-inspired palette ─────────────────────────────────────────────────
const P = {
  bg:       "#F4F1ED",
  surface:  "#FFFFFF",
  ink:      "#2C2825",
  inkSub:   "#8C837A",
  inkFaint: "#C7BEB8",
  accent:   "#E8604C", // Pantone 18-1660 Fiesta
  accentBg: "#FAE8E5",
  teal:     "#00827F", // Pantone 17-5126 Viridian
  tealBg:   "#DCF0EF",
  gold:     "#C89520", // Pantone 15-0953 Saffron
  goldBg:   "#F7EDCC",
  lavender: "#7B6EA6", // Pantone 18-3633 Deep Lavender
  lavBg:    "#ECEAF7",
  sage:     "#6B8E6E", // Pantone 17-0230 Foliage
  sageBg:   "#E3EDE4",
  border:   "rgba(44,40,37,0.08)",
};

const CATEGORIES = [
  { id: "design",  label: "デザイン",    emoji: "✦",  color: P.accent,   bg: P.accentBg },
  { id: "coding",  label: "コーディング", emoji: "⟨⟩", color: P.teal,     bg: P.tealBg   },
  { id: "meeting", label: "打ち合わせ",   emoji: "◈",  color: P.lavender, bg: P.lavBg    },
  { id: "sales",   label: "セール",       emoji: "◆",  color: P.gold,     bg: P.goldBg   },
  { id: "other",   label: "その他",       emoji: "◇",  color: P.sage,     bg: P.sageBg   },
];

const PRIORITY_LIST = [
  { id: "high", label: "急ぎ", dot: P.accent   },
  { id: "mid",  label: "普通", dot: P.teal     },
  { id: "low",  label: "余裕", dot: P.inkFaint },
];

const ENCOURAGEMENTS = [
  "よく頑張った ✦", "着実に進んでるよ ◈", "すごい！完了！ ✿",
  "一歩前進 ◇", "あなたは最高です ✦", "いいリズムだよ ◆",
];

const INITIAL_TASKS = [
  { id: 1, text: "バナーデザイン修正",       category: "design",  done: false, priority: "high", deadline: "25/06/10", url: "", memo: "" },
  { id: 2, text: "クライアントMTG資料準備",   category: "meeting", done: false, priority: "high", deadline: "25/06/07", url: "", memo: "3Fの会議室" },
  { id: 3, text: "LP配色確認",               category: "design",  done: true,  priority: "mid",  deadline: "",         url: "", memo: "" },
  { id: 4, text: "カート実装",               category: "coding",  done: false, priority: "mid",  deadline: "25/06/20", url: "https://github.com", memo: "" },
];

// yymmdd or yy/mm/dd → Date (null if invalid)
function parseDeadline(str) {
  if (!str) return null;
  const clean = str.replace(/\//g, "");
  if (clean.length !== 6) return null;
  const yy = parseInt(clean.slice(0,2), 10);
  const mm = parseInt(clean.slice(2,4), 10) - 1;
  const dd = parseInt(clean.slice(4,6), 10);
  const d  = new Date(2000 + yy, mm, dd);
  if (isNaN(d.getTime())) return null;
  return d;
}

// auto-format raw digits → yy/mm/dd
function fmtDl(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

function deadlineInfo(str) {
  const d = parseDeadline(str);
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.floor((d - today) / 86400000);
  if (diff < 0)   return { text: `${str} 期限切れ`,    urgent: true,  past: true  };
  if (diff === 0) return { text: `${str} 今日が〆切！`, urgent: true,  past: false };
  if (diff <= 3)  return { text: `${str} あと${diff}日`, urgent: true,  past: false };
  return               { text: str,                   urgent: false, past: false };
}

// ── Floating bg particles ───────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  size:  6 + Math.random() * 16,
  top:   Math.random() * 100,
  left:  Math.random() * 100,
  dur:   7 + Math.random() * 8,
  delay: Math.random() * 6,
  color: [P.accent, P.teal, P.lavender, P.gold, P.sage][i % 5],
}));

// ── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onDelete, onUpdate }) {
  const [open,     setOpen]     = useState(false);
  const [editUrl,  setEditUrl]  = useState(task.url);
  const [editMemo, setEditMemo] = useState(task.memo);
  const [dirty,    setDirty]    = useState(false);

  const cat = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[0];
  const pri = PRIORITY_LIST.find(p => p.id === task.priority);
  const dl  = deadlineInfo(task.deadline);

  return (
    <div style={{
      background: task.done ? "#FAFAF8" : P.surface,
      borderRadius: 18, border: `1px solid ${P.border}`,
      boxShadow: "0 2px 12px rgba(44,40,37,.05)",
      overflow: "hidden", opacity: task.done ? 0.46 : 1,
      animation: "taskIn .28s ease",
      transition: "box-shadow .15s, transform .15s",
    }}>
      {/* main row */}
      <div style={{ display:"flex", alignItems:"center", gap:11, padding:"13px 14px" }}>
        {/* check */}
        <button onClick={() => onToggle(task.id)} style={{
          width:27, height:27, borderRadius:"50%", flexShrink:0,
          border: `2px solid ${task.done ? P.teal : P.inkFaint}`,
          background: task.done ? P.teal : "none",
          color:"white", cursor:"pointer", fontSize:13,
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all .2s",
        }}>{task.done ? "✓" : ""}</button>

        {/* text + meta */}
        <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => setOpen(o => !o)}>
          <div style={{
            fontSize:14, color: task.done ? P.inkFaint : P.ink,
            textDecoration: task.done ? "line-through" : "none",
            lineHeight:1.45,
          }}>{task.text}</div>
          <div style={{ display:"flex", gap:5, marginTop:5, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:cat.bg, color:cat.color }}>
              {cat.emoji} {cat.label}
            </span>
            <span style={{ fontSize:10, color: pri.dot }}>● {pri.label}</span>
            {dl && (
              <span style={{
                fontSize:10, padding:"2px 8px", borderRadius:8,
                background: dl.past ? P.accentBg : dl.urgent ? P.goldBg : P.bg,
                color:      dl.past ? P.accent   : dl.urgent ? P.gold   : P.inkSub,
                border: `1px solid ${dl.past ? P.accent : dl.urgent ? P.gold : P.border}`,
              }}>🗓 {dl.text}</span>
            )}
            {(task.url || task.memo) && (
              <span style={{ fontSize:11, color: P.inkFaint }}>
                {task.url ? "🔗" : ""}{task.memo ? " 📝" : ""}
              </span>
            )}
          </div>
        </div>

        {/* actions */}
        <div style={{ display:"flex", gap:2, flexShrink:0 }}>
          <button onClick={() => setOpen(o => !o)} style={{
            background:"none", border:"none", color: P.inkFaint,
            cursor:"pointer", fontSize:10, padding:"5px 6px", borderRadius:8,
            transition:"color .15s",
          }}>{open ? "▲" : "▼"}</button>
          <button onClick={() => onDelete(task.id)} style={{
            background:"none", border:"none", color: P.inkFaint,
            cursor:"pointer", fontSize:17, padding:"4px 6px", borderRadius:8,
            transition:"color .15s", lineHeight:1,
          }}>×</button>
        </div>
      </div>

      {/* detail panel */}
      {open && (
        <div style={{
          borderTop: `1px solid ${P.border}`,
          padding: "12px 14px 14px",
          background: "#FDFCFB",
          animation: "slideDown .2s ease",
        }}>
          {/* URL */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
            <span style={{ fontSize:11, color:P.inkSub, minWidth:48, whiteSpace:"nowrap", paddingTop:2 }}>🔗 URL</span>
            <input value={editUrl} placeholder="https://..."
              onChange={e => { setEditUrl(e.target.value); setDirty(true); }}
              style={{
                flex:1, border:`1px solid ${P.border}`, borderRadius:10,
                padding:"6px 10px", fontSize:13, fontFamily:"inherit",
                color:P.ink, background:P.surface, outline:"none",
              }}
            />
            {editUrl && (
              <a href={editUrl} target="_blank" rel="noreferrer" style={{
                fontSize:11, color:P.teal, textDecoration:"none",
                padding:"5px 10px", border:`1px solid ${P.teal}`, borderRadius:8,
                whiteSpace:"nowrap",
              }}>開く</a>
            )}
          </div>
          {/* Memo */}
          <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:11, color:P.inkSub, minWidth:48, whiteSpace:"nowrap", paddingTop:7 }}>📝 メモ</span>
            <textarea value={editMemo} placeholder="メモを入力..." rows={2}
              onChange={e => { setEditMemo(e.target.value); setDirty(true); }}
              style={{
                flex:1, border:`1px solid ${P.border}`, borderRadius:10,
                padding:"6px 10px", fontSize:13, fontFamily:"inherit",
                color:P.ink, background:P.surface, outline:"none", resize:"vertical",
              }}
            />
          </div>
          {dirty && (
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={() => { onUpdate(task.id, { url: editUrl, memo: editMemo }); setDirty(false); }}
                style={{
                  background: P.ink, color: P.bg, border:"none",
                  padding:"6px 18px", borderRadius:12, fontSize:12,
                  cursor:"pointer", letterSpacing:".04em",
                }}>保存</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TaskApp() {
  const [tasks,        setTasks]        = useState(INITIAL_TASKS);
  const [input,        setInput]        = useState("");
  const [selCat,       setSelCat]       = useState("design");
  const [selPri,       setSelPri]       = useState("mid");
  const [dlInput,      setDlInput]      = useState("");
  const [isAdding,     setIsAdding]     = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [encText,      setEncText]      = useState("");
  const [showEnc,      setShowEnc]      = useState(false);
  const inputRef = useRef(null);

  const addTask = () => {
    if (!input.trim()) return;
    setTasks(prev => [{
      id: Date.now(), text: input.trim(),
      category: selCat, done: false, priority: selPri,
      deadline: dlInput, url: "", memo: "",
    }, ...prev]);
    setInput(""); setDlInput(""); setIsAdding(false);
  };

  const toggleTask = id => setTasks(prev => prev.map(t => {
    if (t.id !== id) return t;
    if (!t.done) {
      const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
      setEncText(msg); setShowEnc(true);
      setTimeout(() => setShowEnc(false), 2100);
    }
    return { ...t, done: !t.done };
  }));

  const deleteTask = id => setTasks(prev => prev.filter(t => t.id !== id));
  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  const done  = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const undone = total - done;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  const FILTERS = [
    { id: "all",      label: "未完了"    },
    { id: "done",     label: "完了済み ✓" },
    { id: "deadline", label: "🗓 〆切あり" },
    ...CATEGORIES.map(c => ({ id: c.id, label: `${c.emoji} ${c.label}` })),
  ];

  const priOrder = { high: 0, mid: 1, low: 2 };
  const filteredTasks = (() => {
    if (activeFilter === "done")
      return tasks.filter(t => t.done);
    if (activeFilter === "deadline") {
      return tasks
        .filter(t => !t.done && !!parseDeadline(t.deadline))
        .sort((a,b) => parseDeadline(a.deadline) - parseDeadline(b.deadline));
    }
    const base = activeFilter === "all"
      ? tasks.filter(t => !t.done)
      : tasks.filter(t => t.category === activeFilter && !t.done);
    return [...base].sort((a,b) => priOrder[a.priority] - priOrder[b.priority]);
  })();

  const moodMsg = pct === 100 && total > 0 ? "✦ 全部完了！最高！"
    : pct >= 50 ? "◈ いい調子！"
    : pct > 0   ? "◇ じわじわ進んでる"
    : total > 0 ? "✦ さあ、はじめよう"
    :              "◈ タスクを追加してみよう";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Noto+Sans+JP:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:${P.bg}; font-family:'Noto Sans JP',sans-serif; color:${P.ink}; }

        @keyframes ptFloat {
          0%,100% { transform:translateY(0) rotate(0deg); }
          40%      { transform:translateY(-16px) rotate(4deg); }
          70%      { transform:translateY(-8px)  rotate(-2deg); }
        }
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes taskIn {
          from { opacity:0; transform:translateX(-8px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes popIn {
          0%   { transform:translate(-50%,-50%) scale(0.6); opacity:0; }
          65%  { transform:translate(-50%,-50%) scale(1.08); opacity:1; }
          100% { transform:translate(-50%,-50%) scale(1); opacity:1; }
        }
        @keyframes fadeUp {
          0%  { opacity:1; transform:translate(-50%,-50%); }
          80% { opacity:1; }
          100%{ opacity:0; transform:translate(-50%,-62%); }
        }
        @keyframes shimBar {
          0%  { background-position:-200% center; }
          100%{ background-position: 200% center; }
        }
        .bar-fill {
          height:100%; border-radius:8px;
          background:linear-gradient(90deg,${P.accent},${P.gold},${P.teal});
          background-size:200% auto;
          animation:shimBar 4s linear infinite;
          transition:width .9s cubic-bezier(.4,0,.2,1);
        }
        .add-icon-wrap { transition:transform .2s; }
        .add-trigger:hover .add-icon-wrap { transform:rotate(90deg); }
        button:focus { outline:none; }
      `}</style>

      {/* bg particles */}
      {PARTICLES.map(p => (
        <div key={p.id} style={{
          position:"fixed", borderRadius:"50%", pointerEvents:"none", zIndex:0,
          width:p.size, height:p.size, background:p.color, opacity:.07,
          top:`${p.top}%`, left:`${p.left}%`,
          animation:`ptFloat ${p.dur}s ease-in-out infinite`,
          animationDelay:`${p.delay}s`,
        }} />
      ))}

      {/* bg blobs */}
      {[
        { w:420, h:420, c:P.accentBg, t:-100, r:-100  },
        { w:320, h:320, c:P.tealBg,   b:40,   l:-80   },
        { w:200, h:200, c:P.lavBg,    t:"40%",l:"55%" },
      ].map((b,i) => (
        <div key={i} style={{
          position:"fixed", borderRadius:"50%", filter:"blur(80px)",
          pointerEvents:"none", zIndex:0,
          width:b.w, height:b.h,
          background:`radial-gradient(circle,${b.c} 0%,transparent 70%)`,
          top:b.t, right:b.r, bottom:b.b, left:b.l,
        }} />
      ))}

      {/* encouragement toast */}
      {showEnc && (
        <div style={{
          position:"fixed", top:"50%", left:"50%",
          background:P.ink, color:P.bg,
          padding:"16px 34px", borderRadius:28,
          fontSize:15, letterSpacing:".08em",
          zIndex:999, pointerEvents:"none", whiteSpace:"nowrap",
          boxShadow:"0 20px 50px rgba(44,40,37,.38)",
          animation:"popIn .38s cubic-bezier(.34,1.56,.64,1) forwards, fadeUp .5s ease 1.6s forwards",
        }}>{encText}</div>
      )}

      {/* main */}
      <div style={{
        minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center",
        padding:"36px 16px 80px", position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:500 }}>

          {/* ── header ── */}
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{
              display:"inline-block", background:P.ink, color:P.bg,
              fontSize:11, padding:"3px 14px", borderRadius:20,
              letterSpacing:".1em", marginBottom:9, fontWeight:300,
            }}>
              {new Date().toLocaleDateString("ja-JP",{ year:"numeric",month:"long",day:"numeric",weekday:"short" })}
            </div>
            <h1 style={{
              fontFamily:"'Cormorant Garamond',serif", fontSize:38,
              fontWeight:300, letterSpacing:".04em", lineHeight:1.1, color:P.ink,
            }}>
              今日の<em style={{ fontStyle:"italic", color:P.accent }}>やること</em>
            </h1>
            <p style={{ fontSize:12, color:P.inkFaint, letterSpacing:".1em", marginTop:5 }}>
              あなたのペースで、ひとつずつ。
            </p>
          </div>

          {/* ── stats ── */}
          <div style={{
            background:P.surface, borderRadius:24, padding:"22px 24px",
            marginBottom:18, border:`1px solid ${P.border}`,
            boxShadow:"0 4px 28px rgba(44,40,37,.06)",
            animation:"slideDown .5s ease",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, color:P.inkFaint, letterSpacing:".08em", marginBottom:2 }}>累計達成数</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:52, fontWeight:300, color:P.ink, lineHeight:1 }}>
                  {done}<span style={{ fontSize:16, color:P.inkFaint, fontFamily:"inherit" }}> 件</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:11, color:P.inkFaint, letterSpacing:".08em", marginBottom:2 }}>残タスク / 全体</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:300, color:P.ink }}>
                  {undone}<span style={{ fontSize:15, color:P.inkFaint }}> / {total}</span>
                </div>
              </div>
            </div>
            <div style={{ height:7, background:"#EDE8E3", borderRadius:8, overflow:"hidden" }}>
              <div className="bar-fill" style={{ width:`${pct}%` }} />
            </div>
            <div style={{ marginTop:12 }}>
              <span style={{
                fontSize:11, padding:"3px 12px", borderRadius:12,
                background:P.accentBg, color:P.accent, letterSpacing:".05em",
              }}>{moodMsg}</span>
            </div>
          </div>

          {/* ── filters ── */}
          <div style={{ display:"flex", gap:7, marginBottom:15, overflowX:"auto", paddingBottom:4, scrollbarWidth:"none" }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
                flexShrink:0, fontFamily:"'Noto Sans JP',sans-serif",
                fontSize:12, padding:"5px 14px", borderRadius:20, cursor:"pointer",
                border: `1.5px solid ${activeFilter === f.id ? P.ink : P.border}`,
                background: activeFilter === f.id ? P.ink : P.surface,
                color: activeFilter === f.id ? P.bg : P.inkSub,
                whiteSpace:"nowrap", transition:"all .18s", letterSpacing:".04em",
              }}>{f.label}</button>
            ))}
          </div>

          {/* ── task list ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:18 }}>
            {filteredTasks.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", color:P.inkFaint, fontSize:13, lineHeight:2.2 }}>
                <div style={{ fontSize:30, marginBottom:10, opacity:.55 }}>✦</div>
                {activeFilter === "done"     ? "まだ完了したタスクはありません" :
                 activeFilter === "deadline" ? "〆切のあるタスクはありません"   :
                 "タスクなし。余裕の一日！"}
              </div>
            ) : filteredTasks.map(t => (
              <TaskCard key={t.id} task={t}
                onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} />
            ))}
          </div>

          {/* ── add task ── */}
          <div style={{
            background:P.surface, borderRadius:24, overflow:"hidden",
            boxShadow:"0 4px 24px rgba(44,40,37,.07)",
            border:`1px solid ${P.border}`,
          }}>
            {!isAdding ? (
              <div className="add-trigger" onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 40); }}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"17px 20px", cursor:"pointer" }}>
                <div className="add-icon-wrap" style={{
                  width:32, height:32, borderRadius:"50%",
                  background:P.accent, color:"white",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:19, flexShrink:0,
                }}>+</div>
                <span style={{ fontSize:14, color:P.inkFaint }}>タスクをさっと追加…</span>
              </div>
            ) : (
              <div style={{ padding:20, borderTop:`1px solid ${P.border}`, animation:"slideDown .25s ease" }}>
                <input ref={inputRef} value={input} placeholder="何をする？"
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  style={{
                    width:"100%", border:"none", borderBottom:`1.5px solid ${P.inkFaint}`,
                    outline:"none", fontFamily:"inherit", fontSize:16,
                    color:P.ink, background:"transparent",
                    padding:"4px 0 10px", marginBottom:16,
                  }}
                />

                {/* category */}
                <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".12em", textTransform:"uppercase", marginBottom:8 }}>カテゴリ</div>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
                  {CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setSelCat(c.id)} style={{
                      fontFamily:"inherit", fontSize:12, padding:"5px 13px", borderRadius:14, cursor:"pointer",
                      border:`1.5px solid ${selCat === c.id ? c.color : "transparent"}`,
                      background: selCat === c.id ? c.bg : P.bg,
                      color: selCat === c.id ? c.color : P.inkSub,
                      transition:"all .18s",
                    }}>{c.emoji} {c.label}</button>
                  ))}
                </div>

                {/* priority */}
                <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".12em", textTransform:"uppercase", marginBottom:8 }}>優先度</div>
                <div style={{ display:"flex", gap:7, marginBottom:16 }}>
                  {PRIORITY_LIST.map(p => (
                    <button key={p.id} onClick={() => setSelPri(p.id)} style={{
                      fontFamily:"inherit", fontSize:12, padding:"5px 13px", borderRadius:14, cursor:"pointer",
                      border:`1.5px solid ${selPri === p.id ? p.dot : "transparent"}`,
                      background: selPri === p.id ? `${p.dot}18` : P.bg,
                      color: selPri === p.id ? p.dot : P.inkSub,
                      transition:"all .18s",
                    }}>● {p.label}</button>
                  ))}
                </div>

                {/* deadline */}
                <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".12em", textTransform:"uppercase", marginBottom:8 }}>〆切日（任意）</div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                  <input value={dlInput} placeholder="yymmdd" maxLength={8}
                    onChange={e => setDlInput(fmtDl(e.target.value))}
                    style={{
                      border:`1.5px solid ${P.border}`, borderRadius:12,
                      padding:"7px 12px", fontFamily:"inherit", fontSize:13,
                      color:P.ink, outline:"none", width:120, background:P.surface,
                    }}
                  />
                  {parseDeadline(dlInput) && (
                    <span style={{ fontSize:12, color:P.inkSub }}>
                      🗓 {dlInput} — {parseDeadline(dlInput).toLocaleDateString("ja-JP",{ month:"long",day:"numeric",weekday:"short" })}
                    </span>
                  )}
                </div>

                <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
                  <button onClick={() => { setIsAdding(false); setDlInput(""); }} style={{
                    background:"none", border:"none", color:P.inkSub,
                    fontFamily:"inherit", fontSize:13, padding:"9px 16px",
                    borderRadius:14, cursor:"pointer",
                  }}>キャンセル</button>
                  <button onClick={addTask} disabled={!input.trim()} style={{
                    background: input.trim() ? P.accent : P.inkFaint,
                    color:"white", border:"none",
                    padding:"9px 26px", borderRadius:14,
                    fontFamily:"inherit", fontSize:13, cursor: input.trim() ? "pointer" : "not-allowed",
                    letterSpacing:".05em", fontWeight:500,
                    transition:"transform .15s, box-shadow .15s",
                  }}>追加する</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

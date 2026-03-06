import { useState, useRef, useMemo, useEffect } from "react";

// ── Pantone palette (no green) ───────────────────────────────────────────────
const P = {
  bg:        "#F4F1ED",
  surface:   "#FFFFFF",
  ink:       "#2C2825",
  inkSub:    "#8C837A",
  inkFaint:  "#C7BEB8",
  border:    "rgba(44,40,37,0.09)",
  // Pantone accents
  fiesta:    "#E8604C", // 18-1660 Fiesta  → primary / design
  fiestaBg:  "#FAE8E5",
  saffron:   "#C89520", // 15-0953 Saffron → sales / deadline warn
  saffronBg: "#F7EDCC",
  lavender:  "#7B6EA6", // 18-3633 Deep Lavender → meeting
  lavBg:     "#ECEAF7",
  dusty:     "#B5666A", // 18-1630 Dusty Cedar → coding / mid priority
  dustyBg:   "#F5E5E6",
  sage:      "#7A8C6E", // 17-0230 Foliage muted → other
  sageBg:    "#E8EDE4",
};

const CATEGORIES = [
  { id:"design",  label:"デザイン",    emoji:"✦",  color:P.fiesta,   bg:P.fiestaBg  },
  { id:"coding",  label:"コーディング", emoji:"⟨⟩", color:P.dusty,    bg:P.dustyBg   },
  { id:"meeting", label:"MTG",   emoji:"◈",  color:P.lavender, bg:P.lavBg     },
  { id:"sales",   label:"セール",       emoji:"◆",  color:P.saffron,  bg:P.saffronBg },
  { id:"sales",   label:"値上げ",       emoji:"◆",  color:P.saffron,  bg:P.saffronBg },
  { id:"other",   label:"その他",       emoji:"◇",  color:P.sage,     bg:P.sageBg    },
];

const PRIORITIES = [
  { id:"high", label:"急ぎ",  color:P.fiesta   },
  { id:"mid",  label:"普通",  color:P.dusty    },
  { id:"low",  label:"余裕",  color:P.inkFaint },
];

const ENCOURAGEMENTS = [
  "よく頑張った ✦", "着実に進んでるよ ◈", "すごい！完了！ ✿",
  "一歩前進 ◇", "あなたは最高です ✦", "いいリズムだよ ◆",
];

const INITIAL_TASKS = [
  { id:1, text:"バナーデザイン修正",      category:"design",  done:false, priority:"high", deadline:"25/06/10", url:"",                    memo:""         },
  { id:2, text:"クライアントMTG資料準備",  category:"meeting", done:false, priority:"high", deadline:"25/06/07", url:"",                    memo:"3Fの会議室" },
  { id:3, text:"LP配色確認",              category:"design",  done:true,  priority:"mid",  deadline:"",         url:"",                    memo:""         },
  { id:4, text:"カート実装",              category:"coding",  done:false, priority:"mid",  deadline:"25/06/20", url:"https://github.com",  memo:""         },
];

// ── Date helpers ─────────────────────────────────────────────────────────────
// Parse "yy/mm/dd" or "yymmdd" → Date at local midnight (no timezone shift)
function parseDeadline(str) {
  if (!str) return null;
  const clean = str.replace(/\//g, "");
  if (clean.length !== 6) return null;
  const yy = parseInt(clean.slice(0,2), 10);
  const mm = parseInt(clean.slice(2,4), 10);
  const dd = parseInt(clean.slice(4,6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  // Use explicit constructor to avoid UTC offset — stays at local midnight
  const d = new Date(2000 + yy, mm - 1, dd, 0, 0, 0, 0);
  // Validate: JS will roll over invalid dates (e.g. Feb 31)
  if (d.getFullYear() !== 2000 + yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

// Auto-insert slashes: "250610" → "25/06/10"
function fmtDlInput(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

function localToday() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
}

function deadlineChip(str) {
  const d = parseDeadline(str);
  if (!d) return null;
  const today = localToday();
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0)   return { label:`${str} 期限切れ`,     c:P.fiesta,   bg:P.fiestaBg  };
  if (diff === 0) return { label:`${str} 今日〆切！`,    c:P.fiesta,   bg:P.fiestaBg  };
  if (diff <= 3)  return { label:`${str} あと${diff}日`, c:P.saffron,  bg:P.saffronBg };
  return               { label: str,                   c:P.inkSub,   bg:P.bg        };
}

// ── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCalendar({ tasks }) {
  const today = localToday();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based

  const firstDay   = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // deadlines that fall in this month → Set of day numbers
  const deadlineDays = useMemo(() => {
    const s = new Set();
    tasks.forEach(t => {
      if (t.done) return;
      const d = parseDeadline(t.deadline);
      if (d && d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        s.add(d.getDate());
      }
    });
    return s;
  }, [tasks, viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); }
    else setViewMonth(m => m-1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); }
    else setViewMonth(m => m+1);
  };

  const isToday = (day) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ background:P.surface, borderRadius:20, padding:"18px 16px", border:`1px solid ${P.border}` }}>
      {/* month nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button onClick={prevMonth} style={{ background:"none", border:"none", cursor:"pointer", color:P.inkSub, fontSize:16, padding:"2px 6px" }}>‹</button>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:400, color:P.ink, letterSpacing:".06em" }}>
          {viewYear}年 {viewMonth+1}月
        </span>
        <button onClick={nextMonth} style={{ background:"none", border:"none", cursor:"pointer", color:P.inkSub, fontSize:16, padding:"2px 6px" }}>›</button>
      </div>

      {/* weekday headers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
        {["日","月","火","水","木","金","土"].map((d,i) => (
          <div key={d} style={{
            textAlign:"center", fontSize:10, fontWeight:500, letterSpacing:".06em",
            color: i===0 ? P.fiesta : i===6 ? P.lavender : P.inkFaint,
            padding:"2px 0",
          }}>{d}</div>
        ))}
      </div>

      {/* day cells */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const col = i % 7;
          const textColor = col===0 ? P.fiesta : col===6 ? P.lavender : P.ink;
          const hasDl = deadlineDays.has(day);
          return (
            <div key={day} style={{
              textAlign:"center", fontSize:12,
              padding:"5px 2px", borderRadius:8, position:"relative",
              background: isToday(day) ? P.ink : "transparent",
              color: isToday(day) ? P.bg : textColor,
              fontWeight: isToday(day) ? 500 : 400,
            }}>
              {day}
              {hasDl && (
                <div style={{
                  position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)",
                  width:4, height:4, borderRadius:"50%",
                  background: isToday(day) ? P.bg : P.saffron,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* legend */}
      <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:6 }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:P.saffron }} />
        <span style={{ fontSize:10, color:P.inkFaint }}>〆切あり</span>
      </div>
    </div>
  );
}

// ── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onDelete, onUpdate }) {
  const [open,     setOpen]     = useState(false);
  const [editUrl,  setEditUrl]  = useState(task.url);
  const [editMemo, setEditMemo] = useState(task.memo);
  const [dirty,    setDirty]    = useState(false);

  const cat  = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[4];
  const pri  = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1];
  const chip = deadlineChip(task.deadline);

  return (
    <div style={{
      background: task.done ? "#FAFAF8" : P.surface,
      borderRadius:16, border:`1px solid ${P.border}`,
      overflow:"hidden", opacity: task.done ? .45 : 1,
      transition:"box-shadow .15s, transform .15s",
      boxShadow:"0 2px 10px rgba(44,40,37,.05)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px" }}>
        {/* check */}
        <button onClick={() => onToggle(task.id)} style={{
          width:26, height:26, borderRadius:"50%", flexShrink:0,
          border:`2px solid ${task.done ? P.dusty : P.inkFaint}`,
          background: task.done ? P.dusty : "none",
          color:"white", cursor:"pointer", fontSize:12,
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all .2s",
        }}>{task.done ? "✓" : ""}</button>

        {/* content */}
        <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => setOpen(o=>!o)}>
          <div style={{
            fontSize:13, lineHeight:1.45,
            color: task.done ? P.inkFaint : P.ink,
            textDecoration: task.done ? "line-through" : "none",
          }}>{task.text}</div>
          <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:10, padding:"2px 7px", borderRadius:7, background:cat.bg, color:cat.color }}>
              {cat.emoji} {cat.label}
            </span>
            <span style={{ fontSize:10, color:pri.color }}>● {pri.label}</span>
            {chip && (
              <span style={{
                fontSize:10, padding:"2px 7px", borderRadius:7,
                background:chip.bg, color:chip.c,
                border:`1px solid ${chip.c}40`,
              }}>🗓 {chip.label}</span>
            )}
            {(task.url || task.memo) && (
              <span style={{ fontSize:10, color:P.inkFaint }}>
                {task.url ? "🔗" : ""}{task.memo ? " 📝" : ""}
              </span>
            )}
          </div>
        </div>

        {/* actions */}
        <div style={{ display:"flex", gap:1, flexShrink:0 }}>
          <button onClick={() => setOpen(o=>!o)} style={{
            background:"none", border:"none", cursor:"pointer",
            color:P.inkFaint, fontSize:10, padding:"4px 5px", borderRadius:6,
          }}>{open ? "▲" : "▼"}</button>
          <button onClick={() => onDelete(task.id)} style={{
            background:"none", border:"none", cursor:"pointer",
            color:P.inkFaint, fontSize:16, padding:"3px 5px", borderRadius:6, lineHeight:1,
          }}>×</button>
        </div>
      </div>

      {/* detail */}
      {open && (
        <div style={{
          borderTop:`1px solid ${P.border}`, padding:"12px 14px 14px",
          background:"#FDFCFB", animation:"slideDown .18s ease",
        }}>
          {/* URL */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:11, color:P.inkSub, minWidth:44, whiteSpace:"nowrap" }}>🔗 URL</span>
            <input value={editUrl} placeholder="https://..."
              onChange={e => { setEditUrl(e.target.value); setDirty(true); }}
              style={{
                flex:1, border:`1px solid ${P.border}`, borderRadius:9,
                padding:"5px 9px", fontSize:12, fontFamily:"inherit",
                color:P.ink, background:P.surface, outline:"none",
              }}
            />
            {editUrl && (
              <a href={editUrl} target="_blank" rel="noreferrer" style={{
                fontSize:11, color:P.lavender, textDecoration:"none",
                padding:"4px 9px", border:`1px solid ${P.lavender}`, borderRadius:7,
                whiteSpace:"nowrap",
              }}>開く</a>
            )}
          </div>
          {/* Memo */}
          <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:11, color:P.inkSub, minWidth:44, whiteSpace:"nowrap", paddingTop:6 }}>📝 メモ</span>
            <textarea value={editMemo} placeholder="メモを入力..." rows={2}
              onChange={e => { setEditMemo(e.target.value); setDirty(true); }}
              style={{
                flex:1, border:`1px solid ${P.border}`, borderRadius:9,
                padding:"5px 9px", fontSize:12, fontFamily:"inherit",
                color:P.ink, background:P.surface, outline:"none", resize:"vertical",
              }}
            />
          </div>
          {dirty && (
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={() => { onUpdate(task.id,{url:editUrl,memo:editMemo}); setDirty(false); }}
                style={{
                  background:P.ink, color:P.bg, border:"none",
                  padding:"5px 16px", borderRadius:10, fontSize:11,
                  cursor:"pointer", letterSpacing:".04em",
                }}>保存</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Task Form ─────────────────────────────────────────────────────────────
function AddTaskForm({ onAdd }) {
  const [text,   setText]   = useState("");
  const [cat,    setCat]    = useState("design");
  const [pri,    setPri]    = useState("mid");
  const [dl,     setDl]     = useState("");
  const inputRef = useRef(null);

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd({ text:text.trim(), category:cat, priority:pri, deadline:dl });
    setText(""); setDl("");
  };

  const dlDate = parseDeadline(dl);

  return (
    <div style={{ background:P.surface, borderRadius:20, border:`1px solid ${P.border}`, padding:"18px 16px" }}>
      <div style={{ fontSize:11, color:P.inkFaint, letterSpacing:".12em", textTransform:"uppercase", marginBottom:10 }}>
        タスクを追加
      </div>

      {/* text input */}
      <input ref={inputRef} value={text} placeholder="何をする？"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleAdd()}
        style={{
          width:"100%", border:"none", borderBottom:`1.5px solid ${P.inkFaint}`,
          outline:"none", fontFamily:"inherit", fontSize:15,
          color:P.ink, background:"transparent",
          padding:"4px 0 10px", marginBottom:14,
        }}
      />

      {/* category */}
      <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".1em", textTransform:"uppercase", marginBottom:7 }}>カテゴリ</div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{
            fontFamily:"inherit", fontSize:11, padding:"4px 11px", borderRadius:12, cursor:"pointer",
            border:`1.5px solid ${cat===c.id ? c.color : "transparent"}`,
            background: cat===c.id ? c.bg : P.bg,
            color: cat===c.id ? c.color : P.inkSub,
            transition:"all .15s",
          }}>{c.emoji} {c.label}</button>
        ))}
      </div>

      {/* priority */}
      <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".1em", textTransform:"uppercase", marginBottom:7 }}>優先度</div>
      <div style={{ display:"flex", gap:5, marginBottom:12 }}>
        {PRIORITIES.map(p => (
          <button key={p.id} onClick={() => setPri(p.id)} style={{
            fontFamily:"inherit", fontSize:11, padding:"4px 11px", borderRadius:12, cursor:"pointer",
            border:`1.5px solid ${pri===p.id ? p.color : "transparent"}`,
            background: pri===p.id ? `${p.color}18` : P.bg,
            color: pri===p.id ? p.color : P.inkSub,
            transition:"all .15s",
          }}>● {p.label}</button>
        ))}
      </div>

      {/* deadline */}
      <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".1em", textTransform:"uppercase", marginBottom:7 }}>〆切日（任意）</div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
        <input value={dl} placeholder="yymmdd"
          maxLength={8}
          onChange={e => setDl(fmtDlInput(e.target.value))}
          style={{
            width:110, border:`1.5px solid ${P.border}`, borderRadius:10,
            padding:"6px 10px", fontFamily:"inherit", fontSize:12,
            color:P.ink, outline:"none", background:P.surface,
          }}
        />
        {dlDate && (
          <span style={{ fontSize:11, color:P.inkSub }}>
            🗓 {dlDate.toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"})}
          </span>
        )}
      </div>

      <button onClick={handleAdd} disabled={!text.trim()} style={{
        width:"100%", background: text.trim() ? P.fiesta : P.inkFaint,
        color:"white", border:"none", padding:"11px", borderRadius:14,
        fontFamily:"inherit", fontSize:13, cursor: text.trim() ? "pointer" : "not-allowed",
        letterSpacing:".06em", fontWeight:500,
        transition:"opacity .15s, transform .1s",
      }}>追加する ＋</button>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
const FILTERS = [
  { id:"all",      label:"未完了"     },
  { id:"done",     label:"完了済み ✓"  },
  { id:"deadline", label:"🗓 〆切あり" },
  ...CATEGORIES.map(c => ({ id:c.id, label:`${c.emoji} ${c.label}` })),
];

const priOrder = { high:0, mid:1, low:2 };

export default function App() {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("taskapp-tasks");
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });
  const [activeFilter, setActiveFilter] = useState("all");
  const [encText,      setEncText]      = useState("");
  const [showEnc,      setShowEnc]      = useState(false);

  // tasksが変わるたびにlocalStorageへ自動保存
  useEffect(() => {
    try {
      localStorage.setItem("taskapp-tasks", JSON.stringify(tasks));
    } catch {
      // ストレージ容量超過などは無視
    }
  }, [tasks]);

  const addTask = ({ text, category, priority, deadline }) => {
    setTasks(prev => [{ id:Date.now(), text, category, priority, deadline, done:false, url:"", memo:"" }, ...prev]);
  };
  const toggleTask = id => setTasks(prev => prev.map(t => {
    if (t.id !== id) return t;
    if (!t.done) {
      const msg = ENCOURAGEMENTS[Math.floor(Math.random()*ENCOURAGEMENTS.length)];
      setEncText(msg); setShowEnc(true);
      setTimeout(() => setShowEnc(false), 2200);
    }
    return { ...t, done:!t.done };
  }));
  const deleteTask = id => setTasks(prev => prev.filter(t => t.id !== id));
  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id===id ? {...t,...patch} : t));

  const done  = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const undone = total - done;
  const pct   = total === 0 ? 0 : Math.round((done/total)*100);

  const filteredTasks = useMemo(() => {
    if (activeFilter === "done")
      return tasks.filter(t => t.done);
    if (activeFilter === "deadline")
      return tasks
        .filter(t => !t.done && !!parseDeadline(t.deadline))
        .sort((a,b) => parseDeadline(a.deadline) - parseDeadline(b.deadline));
    const base = activeFilter === "all"
      ? tasks.filter(t => !t.done)
      : tasks.filter(t => t.category === activeFilter && !t.done);
    return [...base].sort((a,b) => priOrder[a.priority] - priOrder[b.priority]);
  }, [tasks, activeFilter]);

  const moodMsg = pct===100 && total>0 ? "✦ 全部完了！最高！"
    : pct>=50 ? "◈ いい調子！"
    : pct>0   ? "◇ じわじわ進んでる"
    : total>0 ? "✦ さあ、はじめよう"
    :            "◈ タスクを追加してみよう";

  const today = localToday();
  const todayLabel = today.toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"long"});

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Noto+Sans+JP:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { height:100%; }
        body {
          background:${P.bg};
          font-family:'Noto Sans JP',sans-serif;
          color:${P.ink};
          min-height:100vh;
        }

        @keyframes slideDown {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes popIn {
          0%  { transform:translate(-50%,-50%) scale(.6); opacity:0; }
          65% { transform:translate(-50%,-50%) scale(1.07); opacity:1; }
          100%{ transform:translate(-50%,-50%) scale(1); opacity:1; }
        }
        @keyframes fadeUp {
          0%  { opacity:1; }
          75% { opacity:1; }
          100%{ opacity:0; transform:translate(-50%,-64%); }
        }
        @keyframes shimBar {
          0%  { background-position:-200% center; }
          100%{ background-position: 200% center; }
        }

        .bar-fill {
          height:100%; border-radius:8px;
          background:linear-gradient(90deg,${P.fiesta},${P.saffron},${P.lavender});
          background-size:200% auto;
          animation:shimBar 4s linear infinite;
          transition:width .9s cubic-bezier(.4,0,.2,1);
        }

        /* scrollbar */
        .task-scroll::-webkit-scrollbar { width:4px; }
        .task-scroll::-webkit-scrollbar-track { background:transparent; }
        .task-scroll::-webkit-scrollbar-thumb { background:${P.inkFaint}; border-radius:4px; }

        /* left panel scrollbar */
        .left-scroll::-webkit-scrollbar { width:3px; }
        .left-scroll::-webkit-scrollbar-track { background:transparent; }
        .left-scroll::-webkit-scrollbar-thumb { background:${P.inkFaint}; border-radius:3px; }

        button:focus { outline:none; }
        input:focus  { outline:none; }
        textarea:focus { outline:none; }

        /* PC 3-column layout */
        .layout {
          display:flex;
          height:100vh;
          overflow:hidden;
        }
        .col-left {
          width:340px;
          flex-shrink:0;
          display:flex;
          flex-direction:column;
          padding:24px 16px;
          gap:14px;
          overflow-y:auto;
          border-right:1px solid ${P.border};
        }
        .col-right {
          flex:1;
          display:flex;
          flex-direction:column;
          padding:24px 20px;
          overflow:hidden;
        }

        /* Mobile: stack vertically */
        @media (max-width: 700px) {
          .layout {
            flex-direction:column;
            height:auto;
            overflow:auto;
          }
          .col-left {
            width:100%;
            border-right:none;
            border-bottom:1px solid ${P.border};
            overflow-y:visible;
          }
          .col-right {
            overflow:visible;
          }
        }
      `}</style>

      {/* encouragement toast */}
      {showEnc && (
        <div style={{
          position:"fixed", top:"50%", left:"50%",
          background:P.ink, color:P.bg,
          padding:"15px 32px", borderRadius:26,
          fontSize:15, letterSpacing:".08em",
          zIndex:999, pointerEvents:"none", whiteSpace:"nowrap",
          boxShadow:"0 20px 48px rgba(44,40,37,.36)",
          animation:"popIn .36s cubic-bezier(.34,1.56,.64,1) forwards, fadeUp .55s ease 1.65s forwards",
        }}>{encText}</div>
      )}

      <div className="layout">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
        <div className="col-left left-scroll">

          {/* logo / date */}
          <div>
            <div style={{
              fontFamily:"'Cormorant Garamond',serif", fontSize:22,
              fontWeight:300, color:P.ink, letterSpacing:".04em", lineHeight:1.2,
            }}>
              今日の<em style={{ fontStyle:"italic", color:P.fiesta }}>やること</em>
            </div>
            <div style={{ fontSize:10, color:P.inkFaint, marginTop:4, letterSpacing:".06em", lineHeight:1.6 }}>
              {todayLabel}
            </div>
          </div>

          {/* stats */}
          <div style={{
            background:P.surface, borderRadius:18, padding:"14px 14px 12px",
            border:`1px solid ${P.border}`,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:9, color:P.inkFaint, letterSpacing:".1em", marginBottom:1 }}>累計達成数</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:40, fontWeight:300, color:P.ink, lineHeight:1 }}>
                  {done}<span style={{ fontSize:13, color:P.inkFaint }}> 件</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9, color:P.inkFaint, letterSpacing:".1em", marginBottom:1 }}>残 / 全体</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:300, color:P.ink }}>
                  {undone}<span style={{ fontSize:12, color:P.inkFaint }}> / {total}</span>
                </div>
              </div>
            </div>
            <div style={{ height:6, background:"#EDE8E3", borderRadius:6, overflow:"hidden", marginBottom:8 }}>
              <div className="bar-fill" style={{ width:`${pct}%` }} />
            </div>
            <span style={{
              fontSize:10, padding:"2px 10px", borderRadius:10,
              background:P.fiestaBg, color:P.fiesta, letterSpacing:".04em",
            }}>{moodMsg}</span>
          </div>

          {/* calendar */}
          <MiniCalendar tasks={tasks} />

          {/* add form */}
          <AddTaskForm onAdd={addTask} />

        </div>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════════ */}
        <div className="col-right">

          {/* filters */}
          <div style={{
            display:"flex", gap:6, marginBottom:14,
            overflowX:"auto", paddingBottom:4, scrollbarWidth:"none", flexShrink:0,
          }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
                flexShrink:0, fontFamily:"'Noto Sans JP',sans-serif",
                fontSize:12, padding:"5px 14px", borderRadius:20, cursor:"pointer",
                border:`1.5px solid ${activeFilter===f.id ? P.ink : P.border}`,
                background: activeFilter===f.id ? P.ink : P.surface,
                color: activeFilter===f.id ? P.bg : P.inkSub,
                whiteSpace:"nowrap", transition:"all .15s", letterSpacing:".04em",
              }}>{f.label}</button>
            ))}
          </div>

          {/* task list — scrollable area */}
          <div className="task-scroll" style={{
            flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8,
            paddingRight:4,
          }}>
            {filteredTasks.length === 0 ? (
              <div style={{
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                color:P.inkFaint, fontSize:13, lineHeight:2.4, textAlign:"center",
              }}>
                <div style={{ fontSize:28, opacity:.5, marginBottom:8 }}>✦</div>
                {activeFilter==="done"     ? "まだ完了したタスクはありません" :
                 activeFilter==="deadline" ? "〆切のあるタスクはありません"   :
                 "タスクなし。余裕の一日！"}
              </div>
            ) : (
              filteredTasks.map(t => (
                <TaskCard key={t.id} task={t}
                  onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} />
              ))
            )}
          </div>

        </div>
      </div>
    </>
  );
}

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
  { id:"design",   label:"デザイン",    emoji:"✦",  color:P.fiesta,   bg:P.fiestaBg  },
  { id:"coding",   label:"コーディング", emoji:"⟨⟩", color:P.dusty,    bg:P.dustyBg   },
  { id:"meeting",  label:"打ち合わせ",   emoji:"◈",  color:P.lavender, bg:P.lavBg     },
  { id:"item",     label:"商品ページ",   emoji:"■",  color:P.dusty,    bg:P.dustyBg   },
  { id:"contents", label:"コンテンツ",   emoji:"＊",  color:P.sage,     bg:P.sageBg    },
  { id:"sales",    label:"セール",       emoji:"◆",  color:P.saffron,  bg:P.saffronBg },
  { id:"other",    label:"その他",       emoji:"◇",  color:P.sage,     bg:P.sageBg    },
  { id:"price",    label:"値上げ",       emoji:"◉",  color:P.dusty,    bg:P.dustyBg   },
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
  { id:1, text:"バナーデザイン修正",      category:"design",  done:false, waiting:false, priority:"high", deadline:"25/06/10", url:"",                    memo:""         },
  { id:2, text:"クライアントMTG資料準備",  category:"meeting", done:false, waiting:true,  priority:"high", deadline:"25/06/07", url:"",                    memo:"3Fの会議室" },
  { id:3, text:"LP配色確認",              category:"design",  done:true,  waiting:false, priority:"mid",  deadline:"",         url:"",                    memo:""         },
  { id:4, text:"カート実装",              category:"coding",  done:false, waiting:false, priority:"mid",  deadline:"25/06/20", url:"https://github.com",  memo:""         },
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

// ── Daily progress helpers ───────────────────────────────────────────────────
function todayKey() {
  const t = new Date();
  return `taskapp-daily-${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function loadDailyProgress() {
  try {
    const key = todayKey();
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : { doneIds: [] };
  } catch { return { doneIds: [] }; }
}

function saveDailyProgress(doneIds) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify({ doneIds }));
  } catch {}
}


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

// ── Memo helpers ─────────────────────────────────────────────────────────────
const MEMO_CATEGORIES = [
  { id:"all",     label:"すべて", color:P.inkSub,   bg:P.bg        },
  ...CATEGORIES.map(c => ({ id:c.id, label:c.label, color:c.color, bg:c.bg, emoji:c.emoji })),
];

const MEMO_COLORS = [
  { id:"white",  bg:"#FFFFFF",  border:"#E8E3DD", label:"ホワイト"   },
  { id:"pink",   bg:"#FDE8F0",  border:"#F2A7C3", label:"ピンク"     },
  { id:"lav",    bg:"#EDE8F9",  border:"#C9A7E8", label:"ラベンダー" },
  { id:"sky",    bg:"#E8F2FD",  border:"#A7C9F2", label:"スカイ"     },
  { id:"mint",   bg:"#E8F7F0",  border:"#A7E8C9", label:"ミント"     },
  { id:"cream",  bg:"#FDF5E8",  border:"#E8CFA7", label:"クリーム"   },
];

function MemoCard({ memo, onUpdate, onDelete, onDragStart, onDragEnter, onDragEnd, isDraggingOver }) {
  const [editing, setEditing]   = useState(false);
  const [editTitle, setEditTitle] = useState(memo.title);
  const [editBody,  setEditBody]  = useState(memo.body);
  const [editCat,   setEditCat]   = useState(memo.category);
  const [editColor, setEditColor] = useState(memo.color);
  const textareaRef = useRef(null);

  useEffect(() => {
    setEditTitle(memo.title);
    setEditBody(memo.body);
    setEditCat(memo.category);
    setEditColor(memo.color);
  }, [memo]);

  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  const mc = MEMO_COLORS.find(c => c.id === editColor) || MEMO_COLORS[0];
  const displayMc = MEMO_COLORS.find(c => c.id === memo.color) || MEMO_COLORS[0];
  const cat = CATEGORIES.find(c => c.id === memo.category);

  const save = () => {
    onUpdate(memo.id, { title: editTitle, body: editBody, category: editCat, color: editColor });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{
        background: mc.bg, border:`1.5px solid ${mc.border}`,
        borderRadius:16, padding:"14px", display:"flex", flexDirection:"column", gap:10,
        boxShadow:"0 4px 16px rgba(44,40,37,.08)", animation:"slideDown .18s ease",
      }}>
        {/* color picker */}
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          {MEMO_COLORS.map(c => (
            <button key={c.id} onClick={() => setEditColor(c.id)} style={{
              width:18, height:18, borderRadius:"50%", border:`2px solid ${editColor===c.id ? P.ink : "transparent"}`,
              background:c.bg, cursor:"pointer", outline:`1px solid ${c.border}`,
            }} title={c.label} />
          ))}
          <span style={{ fontSize:10, color:P.inkFaint, marginLeft:4 }}>色</span>
        </div>
        {/* title */}
        <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
          placeholder="タイトル（任意）"
          style={{
            border:"none", borderBottom:`1px solid ${mc.border}`,
            background:"transparent", fontFamily:"inherit", fontSize:13, fontWeight:500,
            color:P.ink, outline:"none", padding:"2px 0 6px",
          }}
        />
        {/* body */}
        <textarea ref={textareaRef} value={editBody} onChange={e => setEditBody(e.target.value)}
          placeholder="メモを入力..."
          rows={4}
          style={{
            border:`1px solid ${mc.border}`, borderRadius:10,
            background:"rgba(255,255,255,.6)", fontFamily:"inherit", fontSize:12,
            color:P.ink, outline:"none", padding:"8px 10px", resize:"vertical", lineHeight:1.7,
          }}
        />
        {/* category */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setEditCat(c.id)} style={{
              fontFamily:"inherit", fontSize:10, padding:"2px 8px", borderRadius:10, cursor:"pointer",
              border:`1.5px solid ${editCat===c.id ? c.color : "transparent"}`,
              background: editCat===c.id ? c.bg : "rgba(255,255,255,.5)",
              color: editCat===c.id ? c.color : P.inkSub, transition:"all .15s",
            }}>{c.emoji} {c.label}</button>
          ))}
        </div>
        {/* actions */}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={() => { setEditing(false); setEditTitle(memo.title); setEditBody(memo.body); setEditCat(memo.category); setEditColor(memo.color); }} style={{
            background:"none", border:`1px solid ${mc.border}`, color:P.inkSub,
            padding:"4px 12px", borderRadius:9, fontSize:11, cursor:"pointer",
          }}>キャンセル</button>
          <button onClick={save} style={{
            background:P.ink, color:P.bg, border:"none",
            padding:"4px 14px", borderRadius:9, fontSize:11, cursor:"pointer",
          }}>保存 ✓</button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart && onDragStart(memo.id)}
      onDragEnter={() => onDragEnter && onDragEnter(memo.id)}
      onDragEnd={() => onDragEnd && onDragEnd()}
      onDragOver={e => e.preventDefault()}
      style={{
        background: displayMc.bg,
        border:`1.5px solid ${isDraggingOver ? P.lavender : displayMc.border}`,
        borderRadius:16, padding:"14px", cursor:"grab",
        boxShadow: isDraggingOver
          ? "0 6px 24px rgba(123,110,166,.25)"
          : "0 2px 10px rgba(44,40,37,.06)",
        transform: isDraggingOver ? "scale(1.02)" : "scale(1)",
        transition:"box-shadow .15s, transform .15s, border-color .15s",
        display:"flex", flexDirection:"column", gap:8, position:"relative",
        minHeight:80,
      }}
    >
      {/* header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          {memo.title && (
            <div style={{ fontSize:13, fontWeight:500, color:P.ink, lineHeight:1.4, marginBottom:4, wordBreak:"break-all" }}>
              {memo.title}
            </div>
          )}
          {memo.body && (
            <div style={{ fontSize:12, color:P.inkSub, lineHeight:1.7, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
              {memo.body}
            </div>
          )}
          {!memo.title && !memo.body && (
            <div style={{ fontSize:12, color:P.inkFaint, fontStyle:"italic" }}>（空のメモ）</div>
          )}
        </div>
        <div style={{ display:"flex", gap:2, flexShrink:0 }}>
          <button onClick={() => setEditing(true)} style={{
            background:"none", border:"none", cursor:"pointer", color:P.inkFaint,
            fontSize:13, padding:"2px 4px", borderRadius:6, lineHeight:1,
          }} title="編集">✎</button>
          <button onClick={() => onDelete(memo.id)} style={{
            background:"none", border:"none", cursor:"pointer", color:P.inkFaint,
            fontSize:16, padding:"1px 4px", borderRadius:6, lineHeight:1,
          }} title="削除">×</button>
        </div>
      </div>
      {/* footer */}
      {cat && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:10, padding:"1px 7px", borderRadius:6, background:cat.bg, color:cat.color }}>
            {cat.emoji} {cat.label}
          </span>
        </div>
      )}
    </div>
  );
}

function MemoBoard({ memos, onAdd, onUpdate, onDelete, onReorder }) {
  const [filterCat, setFilterCat] = useState("all");
  const [dragId,    setDragId]    = useState(null);
  const [hoverDragId, setHoverDragId] = useState(null);

  const filtered = filterCat === "all"
    ? memos
    : memos.filter(m => m.category === filterCat);

  const addMemo = () => {
    onAdd({ title:"", body:"", category: filterCat === "all" ? "" : filterCat, color:"white" });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%" }}>
      {/* sub-filter bar */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", flexShrink:0 }}>
        {MEMO_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)} style={{
            fontFamily:"inherit", fontSize:11, padding:"4px 12px", borderRadius:16, cursor:"pointer",
            border:`1.5px solid ${filterCat===c.id ? (c.color||P.ink) : P.border}`,
            background: filterCat===c.id ? (c.bg||P.ink) : P.surface,
            color: filterCat===c.id ? (c.color||P.bg) : P.inkSub,
            whiteSpace:"nowrap", transition:"all .15s",
          }}>{c.emoji ? `${c.emoji} ` : ""}{c.label}</button>
        ))}
        <button onClick={addMemo} style={{
          marginLeft:"auto", fontFamily:"inherit", fontSize:11,
          padding:"4px 14px", borderRadius:16, cursor:"pointer",
          background:P.ink, color:P.bg, border:"none",
          letterSpacing:".04em", whiteSpace:"nowrap",
        }}>＋ メモを追加</button>
      </div>

      {/* memo grid — 3 columns on PC */}
      <div style={{
        flex:1, minHeight:0, overflowY:"auto",
        display:"grid",
        gridTemplateColumns:"repeat(3, 1fr)",
        gridAutoRows:"min-content",
        gap:12,
        paddingBottom:20, paddingRight:4,
        alignContent:"start",
      }}
        className="task-scroll memo-grid"
      >
        {filtered.length === 0 ? (
          <div style={{
            gridColumn:"1/-1",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            color:P.inkFaint, fontSize:13, lineHeight:2.4, textAlign:"center",
            minHeight:200,
          }}>
            <div style={{ fontSize:28, opacity:.4, marginBottom:8 }}>📋</div>
            メモがまだありません。<br/>右上の「＋ メモを追加」から作成できます。
          </div>
        ) : (
          filtered.map(m => (
            <MemoCard key={m.id} memo={m}
              onUpdate={onUpdate} onDelete={onDelete}
              onDragStart={id => { setDragId(id); setHoverDragId(id); }}
              onDragEnter={id => {
                if (dragId !== null && id !== dragId) {
                  onReorder(dragId, id);
                  setDragId(id);
                }
                setHoverDragId(id);
              }}
              onDragEnd={() => { setDragId(null); setHoverDragId(null); }}
              isDraggingOver={hoverDragId === m.id && dragId !== null && dragId !== m.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onToggleWaiting, onDelete, onUpdate, onDragStart, onDragEnter, onDragEnd, isDraggingOver }) {
  const [open,      setOpen]      = useState(false);
  const [editUrl,   setEditUrl]   = useState(task.url);
  const [editMemo,  setEditMemo]  = useState(task.memo);
  const [dirty,     setDirty]     = useState(false);
  const [editing,   setEditing]   = useState(false);
  // edit fields
  const [editText, setEditText]   = useState(task.text);
  const [editCat,  setEditCat]    = useState(task.category);
  const [editPri,  setEditPri]    = useState(task.priority);
  const [editDl,   setEditDl]     = useState(task.deadline);

  // sync when task prop changes
  useEffect(() => {
    setEditText(task.text);
    setEditCat(task.category);
    setEditPri(task.priority);
    setEditDl(task.deadline);
    setEditUrl(task.url);
    setEditMemo(task.memo);
  }, [task]);

  const cat  = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[4];
  const pri  = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1];
  const chip = deadlineChip(task.deadline);

  const saveEdit = () => {
    onUpdate(task.id, { text: editText.trim() || task.text, category: editCat, priority: editPri, deadline: editDl, url: editUrl, memo: editMemo });
    setEditing(false);
    setDirty(false);
  };

  return (
    <div
      draggable={!task.done && !editing}
      onDragStart={() => onDragStart && onDragStart(task.id)}
      onDragEnter={() => onDragEnter && onDragEnter(task.id)}
      onDragEnd={() => onDragEnd && onDragEnd()}
      onDragOver={e => e.preventDefault()}
      style={{
        background: task.done ? "#FAFAF8" : task.waiting ? "#F3F1FA" : P.surface,
        borderRadius:16, flexShrink: 0,
        border:`1px solid ${isDraggingOver ? "#C9A7E8" : task.waiting && !task.done ? P.lavender+"60" : P.border}`,
        overflow:"hidden", opacity: task.done ? .45 : 1,
        transition:"box-shadow .15s, transform .15s, border-color .15s",
        boxShadow: isDraggingOver ? "0 4px 20px rgba(201,167,232,.35)" : "0 2px 10px rgba(44,40,37,.05)",
        transform: isDraggingOver ? "scale(1.01)" : "scale(1)",
        cursor: task.done || editing ? "default" : "grab",
      }}>
      {/* ── edit mode ── */}
      {editing ? (
        <div style={{ padding:"14px 14px 16px", animation:"slideDown .18s ease" }}>
          <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".1em", textTransform:"uppercase", marginBottom:8 }}>タスクを編集</div>
          {/* name */}
          <input value={editText} onChange={e => setEditText(e.target.value)}
            style={{
              width:"100%", border:"none", borderBottom:`1.5px solid ${P.inkFaint}`,
              outline:"none", fontFamily:"inherit", fontSize:14,
              color:P.ink, background:"transparent",
              padding:"4px 0 8px", marginBottom:12,
            }}
          />
          {/* category */}
          <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".1em", textTransform:"uppercase", marginBottom:6 }}>カテゴリ</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setEditCat(c.id)} style={{
                fontFamily:"inherit", fontSize:10, padding:"3px 9px", borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${editCat===c.id ? c.color : "transparent"}`,
                background: editCat===c.id ? c.bg : P.bg,
                color: editCat===c.id ? c.color : P.inkSub,
                transition:"all .15s",
              }}>{c.emoji} {c.label}</button>
            ))}
          </div>
          {/* priority */}
          <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".1em", textTransform:"uppercase", marginBottom:6 }}>優先度</div>
          <div style={{ display:"flex", gap:4, marginBottom:10 }}>
            {PRIORITIES.map(p => (
              <button key={p.id} onClick={() => setEditPri(p.id)} style={{
                fontFamily:"inherit", fontSize:10, padding:"3px 9px", borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${editPri===p.id ? p.color : "transparent"}`,
                background: editPri===p.id ? `${p.color}18` : P.bg,
                color: editPri===p.id ? p.color : P.inkSub,
                transition:"all .15s",
              }}>● {p.label}</button>
            ))}
          </div>
          {/* deadline */}
          <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".1em", textTransform:"uppercase", marginBottom:6 }}>〆切日</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <input value={editDl} placeholder="yymmdd" maxLength={8}
              onChange={e => setEditDl(fmtDlInput(e.target.value))}
              style={{
                width:110, border:`1.5px solid ${P.border}`, borderRadius:10,
                padding:"5px 10px", fontFamily:"inherit", fontSize:12,
                color:P.ink, outline:"none", background:P.surface,
              }}
            />
            {parseDeadline(editDl) && (
              <span style={{ fontSize:11, color:P.inkSub }}>
                🗓 {parseDeadline(editDl).toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"})}
              </span>
            )}
          </div>
          {/* URL */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:11, color:P.inkSub, minWidth:44, whiteSpace:"nowrap" }}>🔗 URL</span>
            <input value={editUrl} placeholder="https://..."
              onChange={e => setEditUrl(e.target.value)}
              style={{
                flex:1, border:`1px solid ${P.border}`, borderRadius:9,
                padding:"5px 9px", fontSize:12, fontFamily:"inherit",
                color:P.ink, background:P.surface, outline:"none",
              }}
            />
          </div>
          {/* Memo */}
          <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:11, color:P.inkSub, minWidth:44, whiteSpace:"nowrap", paddingTop:6 }}>📝 メモ</span>
            <textarea value={editMemo} placeholder="メモを入力..." rows={2}
              onChange={e => setEditMemo(e.target.value)}
              style={{
                flex:1, border:`1px solid ${P.border}`, borderRadius:9,
                padding:"5px 9px", fontSize:12, fontFamily:"inherit",
                color:P.ink, background:P.surface, outline:"none", resize:"vertical",
              }}
            />
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={() => { setEditing(false); setEditText(task.text); setEditCat(task.category); setEditPri(task.priority); setEditDl(task.deadline); setEditUrl(task.url); setEditMemo(task.memo); }} style={{
              background:"none", border:`1px solid ${P.border}`, color:P.inkSub,
              padding:"5px 14px", borderRadius:10, fontSize:11, cursor:"pointer",
            }}>キャンセル</button>
            <button onClick={saveEdit} style={{
              background:P.ink, color:P.bg, border:"none",
              padding:"5px 16px", borderRadius:10, fontSize:11,
              cursor:"pointer", letterSpacing:".04em",
            }}>保存する ✓</button>
          </div>
        </div>
      ) : (
      <>
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
            {task.waiting && !task.done && (
              <span style={{
                fontSize:10, padding:"2px 7px", borderRadius:7,
                background:P.lavBg, color:P.lavender,
                border:`1px solid ${P.lavender}40`,
              }}>⏳ 確認待ち</span>
            )}
            {(task.url || task.memo) && (
              <span style={{ fontSize:10, color:P.inkFaint }}>
                {task.url ? "🔗" : ""}{task.memo ? " 📝" : ""}
              </span>
            )}
          </div>
        </div>

        {/* actions */}
        <div style={{ display:"flex", gap:1, flexShrink:0, alignItems:"center" }}>
          {/* ドラッグハンドル */}
          {!task.done && (
            <div
              title="ドラッグして並び替え"
              style={{
                display:"flex", flexDirection:"column", gap:2.5,
                padding:"4px 5px", cursor:"grab", flexShrink:0, opacity:.35,
              }}
            >
              {[0,1,2].map(i => (
                <div key={i} style={{ width:14, height:1.5, borderRadius:2, background:P.inkSub }} />
              ))}
            </div>
          )}
          {/* 確認依頼ボタン */}
          {!task.done && (
            <button
              onClick={() => onToggleWaiting(task.id)}
              title={task.waiting ? "確認待ち解除" : "確認依頼する"}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center",
                width:22, height:22, borderRadius:5, cursor:"pointer",
                border:`1.5px solid ${task.waiting ? P.lavender : P.inkFaint}`,
                background: task.waiting ? P.lavBg : "none",
                color: task.waiting ? P.lavender : P.inkFaint,
                fontSize:11, fontWeight:600,
                transition:"all .18s", flexShrink:0,
                marginRight:2,
              }}
            >{task.waiting ? "✓" : ""}</button>
          )}
          {/* 編集ボタン */}
          {!task.done && (
            <button onClick={() => { setEditing(true); setOpen(false); }}
              title="編集"
              style={{
                background:"none", border:"none", cursor:"pointer",
                color:P.inkFaint, fontSize:13, padding:"4px 5px", borderRadius:6,
                transition:"color .15s",
              }}>✎</button>
          )}
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
      </>
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
  { id:"all",      label:"未完了"        },
  { id:"waiting",  label:"⏳ 確認待ち"    },
  { id:"deadline", label:"🗓 〆切あり"    },
  { id:"meeting",  label:"◈ 打ち合わせ"  },
  { id:"memos",    label:"📋 メモ"       },
  { id:"pri_high", label:"● 急ぎ"        },
  { id:"pri_mid",  label:"● 普通"        },
  { id:"pri_low",  label:"● 余裕"        },
  { id:"price",    label:"◉ 値上げ"      },
  { id:"design",   label:"✦ デザイン"    },
  { id:"coding",   label:"⟨⟩ コーディング" },
  { id:"item",     label:"■ 商品ページ"  },
  { id:"contents", label:"＊ コンテンツ"  },
  { id:"sales",    label:"◆ セール"      },
  { id:"other",    label:"◇ その他"      },
  { id:"done",     label:"完了済み ✓"     },
];

const priOrder = { high:0, mid:1, low:2 };

export default function App() {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("taskapp-tasks");
      if (!saved) return INITIAL_TASKS;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });
  const [activeFilter, setActiveFilter] = useState("all");
  const [encText,      setEncText]      = useState("");
  const [showEnc,      setShowEnc]      = useState(false);
  const [dragId,       setDragId]       = useState(null);
  const [hoverDragId,  setHoverDragId]  = useState(null);

  // 今日完了したタスクIDを管理
  const [todayDoneIds, setTodayDoneIds] = useState(() => loadDailyProgress().doneIds);

  // 初回レンダー判定（初回はlocalStorageへ書き込まない）
  const isFirstRender = useRef(true);

  // tasksが変わるたびにlocalStorageへ自動保存（初回スキップ）
  useEffect(() => {
    if (isFirstRender.current) return;
    try {
      localStorage.setItem("taskapp-tasks", JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  // todayDoneIdsが変わるたびに日次進捗を保存（初回スキップ）
  useEffect(() => {
    if (isFirstRender.current) return;
    saveDailyProgress(todayDoneIds);
  }, [todayDoneIds]);

  // ── Memos ─────────────────────────────────────────────────────────────────
  const [memos, setMemos] = useState(() => {
    try {
      const saved = localStorage.getItem("taskapp-memos");
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    try { localStorage.setItem("taskapp-memos", JSON.stringify(memos)); } catch {}
  }, [memos]);

  const addMemo = ({ title, body, category, color }) => {
    setMemos(prev => [{ id:Date.now(), title, body, category, color }, ...prev]);
  };

  const addTask = ({ text, category, priority, deadline }) => {
    setTasks(prev => [{ id:Date.now(), text, category, priority, deadline, done:false, waiting:false, url:"", memo:"" }, ...prev]);
  };
  const toggleTask = id => setTasks(prev => prev.map(t => {
    if (t.id !== id) return t;
    if (!t.done) {
      const msg = ENCOURAGEMENTS[Math.floor(Math.random()*ENCOURAGEMENTS.length)];
      setEncText(msg); setShowEnc(true);
      setTimeout(() => setShowEnc(false), 2200);
      setTodayDoneIds(ids => ids.includes(id) ? ids : [...ids, id]);
    } else {
      setTodayDoneIds(ids => ids.filter(i => i !== id));
    }
    return { ...t, done:!t.done };
  }));
  const toggleWaiting = id => setTasks(prev => prev.map(t => t.id===id ? {...t, waiting:!t.waiting} : t));
  const deleteTask = id => setTasks(prev => prev.filter(t => t.id !== id));
  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id===id ? {...t,...patch} : t));
  const updateMemo = (id, patch) => setMemos(prev => prev.map(m => m.id===id ? {...m,...patch} : m));
  const deleteMemo = id => setMemos(prev => prev.filter(m => m.id !== id));
  const reorderMemos = (dragId, hoverId) => {
    setMemos(prev => {
      const arr = [...prev];
      const di = arr.findIndex(m => m.id === dragId);
      const hi = arr.findIndex(m => m.id === hoverId);
      if (di < 0 || hi < 0 || di === hi) return prev;
      const [item] = arr.splice(di, 1);
      arr.splice(hi, 0, item);
      return arr;
    });
  };

  // ドラッグ＆ドロップで並び替え
  const reorderTasks = (dragId, hoverId) => {
    setTasks(prev => {
      const arr = [...prev];
      const dragIdx  = arr.findIndex(t => t.id === dragId);
      const hoverIdx = arr.findIndex(t => t.id === hoverId);
      if (dragIdx < 0 || hoverIdx < 0 || dragIdx === hoverIdx) return prev;
      const [item] = arr.splice(dragIdx, 1);
      arr.splice(hoverIdx, 0, item);
      return arr;
    });
  };

  // 今日の進捗（今日完了 / 全体タスク数）
  const todayDone  = todayDoneIds.filter(id => tasks.some(t => t.id === id)).length;
  const total      = tasks.length;
  const undone     = tasks.filter(t => !t.done).length;
  const pct        = total === 0 ? 0 : Math.round((todayDone / total) * 100);

  const filteredTasks = useMemo(() => {
    if (activeFilter === "done")
      return tasks.filter(t => t.done);
    if (activeFilter === "waiting")
      return tasks.filter(t => !t.done && t.waiting);
    if (activeFilter === "pri_high")
      return tasks.filter(t => !t.done && t.priority === "high");
    if (activeFilter === "pri_mid")
      return tasks.filter(t => !t.done && t.priority === "mid");
    if (activeFilter === "pri_low")
      return tasks.filter(t => !t.done && t.priority === "low");
    if (activeFilter === "deadline")
      return tasks
        .filter(t => !t.done && !!parseDeadline(t.deadline))
        .sort((a,b) => parseDeadline(a.deadline) - parseDeadline(b.deadline));
    // "all" とカテゴリフィルターは tasks の手動順序をそのまま使う
    if (activeFilter === "all")
      return tasks.filter(t => !t.done);
    return tasks.filter(t => t.category === activeFilter && !t.done);
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
        html, body { height:100%; overflow:hidden; background:${P.bg}; }
        body { font-family:'Noto Sans JP',sans-serif; color:${P.ink}; }

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
          background:linear-gradient(90deg,#F2A7C3,#C9A7E8,#A7C9F2,#F2A7C3);
          background-size:300% auto;
          animation:shimBar 5s linear infinite;
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

        /* PC layout — position:fixed で確実に高さを制御 */
        .col-left {
          position:fixed;
          top:0; left:0; bottom:0;
          width:320px;
          display:flex;
          flex-direction:column;
          padding:20px 16px;
          gap:12px;
          overflow-y:auto;
          overflow-x:hidden;
          border-right:1px solid ${P.border};
          background:${P.bg};
          z-index:1;
        }

/* --- 修正後：ここをそのまま貼り付け --- */
.col-right {
  position: fixed;
  top: 0; 
  left: 320px; 
  right: 0; 
  bottom: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 20px 0 20px;
  /* 親は溢れた分を「隠す」設定にする（これが圧迫を防ぐコツ） */
  overflow: hidden; 
}

.col-right-filters {
  flex-shrink: 0; /* フィルター部分は絶対に潰さない */
  padding-bottom: 12px;
}

.col-right-tasks {
  flex: 1;         /* 余った画面の高さをすべてこのエリアに割り当てる */
  min-height: 0;   /* これがないと、中身に押されてエリアが広がろうとしてしまいます */
  overflow-y: auto; /* ここで初めてスクロールを許可する */
  padding-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* -------------------------------------- */



        /* Mobile */
        @media (max-width: 700px) {
          html, body { overflow:auto; }
          .col-left {
            position:static;
            width:100%;
            border-right:none;
            border-bottom:1px solid ${P.border};
          }
          .col-right {
            position:static;
            overflow:visible;
            padding-bottom:40px;
          }
          .col-right-tasks {
            overflow-y:visible;
          }
          .memo-grid {
            grid-template-columns: 1fr !important;
          }
          .col-right-filters {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
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

      {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
      <div className="col-left left-scroll">

          {/* stats */}
          <div style={{
            background:P.surface, borderRadius:18, padding:"12px 14px 12px",
            border:`1px solid ${P.border}`,
          }}>
            <div style={{ fontSize:10, color:P.inkFaint, letterSpacing:".06em", marginBottom:10, lineHeight:1.5 }}>
              {todayLabel}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:9, color:P.inkFaint, letterSpacing:".1em", marginBottom:1 }}>今日の達成数</div>
                <div style={{ fontFamily:"'Noto Sans JP',sans-serif", fontSize:36, fontWeight:300, color:P.ink, lineHeight:1 }}>
                  {todayDone}<span style={{ fontSize:13, color:P.inkFaint }}> 件</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9, color:P.inkFaint, letterSpacing:".1em", marginBottom:1 }}>残 / 全体</div>
                <div style={{ fontFamily:"'Noto Sans JP',sans-serif", fontSize:20, fontWeight:300, color:P.ink }}>
                  {undone}<span style={{ fontSize:11, color:P.inkFaint, fontWeight:300 }}> / {total}</span>
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

        {/* filters — 1行目: ステータス系 / 2行目: カテゴリ系 */}
        {(() => {
          const ROW1 = ["all","waiting","deadline","memos","pri_high","pri_mid","pri_low","done"];
          const ROW2 = ["price","design","coding","meeting","item","contents","sales","other"];
          const btnStyle = (f) => ({
            flexShrink:0, fontFamily:"'Noto Sans JP',sans-serif",
            fontSize:12, padding:"5px 14px", borderRadius:20, cursor:"pointer",
            border:`1.5px solid ${activeFilter===f.id ? P.ink : f.id.startsWith("pri_") && activeFilter!==f.id ? "transparent" : P.border}`,
            background: activeFilter===f.id ? P.ink : P.surface,
            color: activeFilter===f.id ? P.bg : f.id==="pri_high" ? P.fiesta : f.id==="pri_mid" ? P.dusty : f.id==="pri_low" ? P.inkFaint : P.inkSub,
            whiteSpace:"nowrap", transition:"all .15s", letterSpacing:".04em",
          });
          return (
            <div className="col-right-filters" style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ display:"flex", gap:6, flexWrap:"nowrap", overflowX:"auto", scrollbarWidth:"none" }}>
                {FILTERS.filter(f => ROW1.includes(f.id)).sort((a,b) => ROW1.indexOf(a.id)-ROW1.indexOf(b.id)).map(f => (
                  <button key={f.id} onClick={() => setActiveFilter(f.id)} style={btnStyle(f)}>{f.label}</button>
                ))}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"nowrap", overflowX:"auto", scrollbarWidth:"none" }}>
                {FILTERS.filter(f => ROW2.includes(f.id)).sort((a,b) => ROW2.indexOf(a.id)-ROW2.indexOf(b.id)).map(f => (
                  <button key={f.id} onClick={() => setActiveFilter(f.id)} style={btnStyle(f)}>{f.label}</button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* task list — scrollable area / memo board */}
        {activeFilter === "memos" ? (
          <div className="col-right-tasks" style={{ paddingRight:4 }}>
            <MemoBoard
              memos={memos}
              onAdd={addMemo}
              onUpdate={updateMemo}
              onDelete={deleteMemo}
              onReorder={reorderMemos}
            />
          </div>
        ) : (
        <div className="task-scroll col-right-tasks" style={{
            display:"flex", flexDirection:"column", gap:8,
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
                 activeFilter==="waiting"  ? "確認待ちのタスクはありません"   :
                 activeFilter==="deadline" ? "〆切のあるタスクはありません"   :
                 activeFilter==="pri_high"  ? "「急ぎ」のタスクはありません"    :
                 activeFilter==="pri_mid"   ? "「普通」のタスクはありません"    :
                 activeFilter==="pri_low"   ? "「余裕」のタスクはありません"    :
                 "タスクなし。余裕の一日！"}
              </div>
            ) : (
              filteredTasks.map(t => (
                <TaskCard key={t.id} task={t}
                  onToggle={toggleTask} onToggleWaiting={toggleWaiting} onDelete={deleteTask} onUpdate={updateTask}
                  onDragStart={id => { setDragId(id); setHoverDragId(id); }}
                  onDragEnter={id => {
                    if (dragId !== null && id !== dragId) {
                      reorderTasks(dragId, id);
                      setDragId(id);
                    }
                    setHoverDragId(id);
                  }}
                  onDragEnd={() => { setDragId(null); setHoverDragId(null); }}
                  isDraggingOver={hoverDragId === t.id && dragId !== null && dragId !== t.id}
                />
              ))
            )}
          </div>
        )}

      </div>
    </>
  );
}

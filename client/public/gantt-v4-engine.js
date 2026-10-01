// ═══════════════════════════════════════════════════════════════
// JIGANTO GANTT v4 ENGINE — integrated build
// Loaded via srcdoc iframe from ReactGanttChart.tsx
// Data injected via window.GANTT_INIT_DATA
// ═══════════════════════════════════════════════════════════════

// ── BAR POSITION REGISTRY ────────────────────────────────────
const barPos = {};
function registerBar(id, left, top, width, height){
  barPos[id] = {left, top, width, height, midY: top + height/2};
}

// ── TYPES & COLOURS ──────────────────────────────────────────
const LEVELS={0:'Program',1:'Project',2:'Phase',3:'Workstream',4:'Activity',5:'Task',6:'Milestone',7:'Release'};
const LEVEL_COLORS=['#3730a3','#4f46e5','#0891b2','#059669','#d97706','#64748b','#db2777','#7c3aed'];
const LEVEL_BG=['rgba(55,48,163,.12)','rgba(79,70,229,.10)','rgba(8,145,178,.08)','rgba(5,150,105,.07)','rgba(217,119,6,.07)','rgba(100,116,139,.06)','rgba(219,39,119,.08)','rgba(124,58,237,.08)'];
const RAG_COL={g:'#059669',a:'#d97706',r:'#dc2626'};
const RAG_PILL_LABELS={
  bgt:{g:'On Track',a:'At Risk',r:'Over Budget'},
  sch:{g:'On Track',a:'At Risk',r:'Delayed'},
  scp:{g:'On Track',a:'At Risk',r:'Increase'},
};
function ragField(t,dim){
  if(dim==='bgt') return t.ragBgt||t.rag||'g';
  if(dim==='sch') return t.ragSch||t.rag||'g';
  return t.ragScp||t.rag||'g';
}
function normalizeTaskRags(t){
  const r=t.rag||'g';
  if(!t.ragBgt) t.ragBgt=r;
  if(!t.ragSch) t.ragSch=r;
  if(!t.ragScp) t.ragScp=r;
  t.rag=t.ragScp||r;
  if(!t.depType) t.depType='FS';
  // Additional predecessors beyond the primary predId — always FS-type (no UI
  // to set a type per extra link yet). Absent/empty on every task that only
  // ever had one predecessor, which is all real data as of this field's
  // introduction — see predEdges() for how this stays a no-op for those.
  if(!Array.isArray(t.extraPredIds)) t.extraPredIds=[];
  return t;
}
/** Every predecessor constraint a task has: its primary predId/depType (if
 * any) plus any extraPredIds (always FS). For a task with no extraPredIds —
 * true of all tasks before this field existed — this returns exactly the
 * single {id,type} pair (or none) that predId/depType alone used to
 * represent, so every caller built against this instead of predId directly
 * behaves identically on that data. */
function predEdges(t,byId){
  const edges=[];
  if(t.predId&&byId.has(t.predId)) edges.push({id:t.predId,type:t.depType||'FS'});
  if(Array.isArray(t.extraPredIds)){
    t.extraPredIds.forEach(id=>{
      if(id&&id!==t.predId&&byId.has(id)) edges.push({id,type:'FS'});
    });
  }
  return edges;
}
function buildRagPillCell(t,id,dim){
  const v=ragField(t,dim);
  const lbl=(RAG_PILL_LABELS[dim]||RAG_PILL_LABELS.scp)[v]||'On Track';
  return '<div class="task-rag-pill-col" data-rag="'+dim+'" onclick="event.stopPropagation();cycleRagDim('+id+',\''+dim+'\')" title="Click to cycle '+dim+' RAG">'+
    '<span class="rag-pill rag-pill-'+v+'"><span class="rag-pill-dot"></span><span class="rag-pill-lbl">'+lbl+'</span></span></div>';
}
const TYPE_ICONS={0:'🔷',1:'📁',2:'📋',3:'🔀',4:'⚡',5:'☑',6:'◆',7:'🚀'};

// ── OWNERS (populated from init data) ────────────────────────
const OWNERS = [];

// ── STATE ────────────────────────────────────────────────────
let tasks=[];
let nextId=100000;
let collapsed={};
let editingId=null;
let currentRag='g';
let currentDep='FS';
/** Additional predecessor ids being edited in the modal, in-progress state
 * mirroring currentRag/currentDep — flushed to t.extraPredIds on save. */
let editingExtraPredIds=[];
let zoom='week';
let colW=28;
let showCP=false;
let mainView='gantt'; // 'gantt' (chart container) | 'list' (list-only page)
/** Independent panes — both on = combined (list columns + timeline). */
let viewShowList=true;
let viewShowGantt=true;
let criticalIds=new Set();
let importMode='append';
let customCols=[];
let ccNextId=1;
/** Built-in field visibility — Type is optional (off by default) */
const BUILTIN_FIELDS=[
  {id:'wbs',label:'#',locked:true,defaultOn:true,widthKey:'--wbs-w',widthFb:48,minW:36},
  {id:'name',label:'Task name',locked:true,defaultOn:true,widthKey:'--name-w',widthFb:200,minW:120},
  {id:'type',label:'Type',locked:false,defaultOn:true,widthKey:'--type-w',widthFb:110,minW:64},
  {id:'owner',label:'Owner',locked:false,defaultOn:true,widthKey:'--owner-w',widthFb:56,minW:40},
  {id:'start',label:'Start',locked:false,defaultOn:true,widthKey:'--start-w',widthFb:88,minW:72},
  {id:'end',label:'End',locked:false,defaultOn:true,widthKey:'--end-w',widthFb:88,minW:72},
  {id:'duration',label:'Duration',locked:false,defaultOn:true,widthKey:'--dur-w',widthFb:56,minW:40},
  {id:'pred',label:'Pred',locked:false,defaultOn:true,widthKey:'--pred-w',widthFb:72,minW:48},
  {id:'prog',label:'%',locked:false,defaultOn:true,widthKey:'--prog-w',widthFb:72,minW:56},
  {id:'budget',label:'Budget',locked:false,defaultOn:true,widthKey:'--budget-w',widthFb:90,minW:64},
  {id:'sched',label:'Sched',locked:false,defaultOn:true,widthKey:'--sched-w',widthFb:90,minW:64},
  {id:'scope',label:'Scope',locked:false,defaultOn:true,widthKey:'--scope-w',widthFb:90,minW:64},
];
let fieldVisibility={}; // id -> boolean
/** Per-column pixel widths (field id or custom:id) — overrides CSS defaults when set */
let columnWidths={};
/** Selected type numbers for filter; empty Set = show all types */
let levelFilterTypes=new Set();
const LEVEL_FILTER_ORDER=[0,1,7,2,3,4,5,6];
/** Selected owner names for filter; empty Set = show all owners */
let ownerFilterOwners=new Set();
/** Selected RAG keys `dim:val` (e.g. bgt:g); empty Set = show all */
let ragFilterKeys=new Set();
const RAG_FILTER_OPTS=[
  {sec:'Budget',dim:'bgt',val:'g',label:'Budget · Green',dot:'🟢'},
  {sec:'Budget',dim:'bgt',val:'a',label:'Budget · Amber',dot:'🟡'},
  {sec:'Budget',dim:'bgt',val:'r',label:'Budget · Red',dot:'🔴'},
  {sec:'Schedule',dim:'sch',val:'g',label:'Schedule · Green',dot:'🟢'},
  {sec:'Schedule',dim:'sch',val:'a',label:'Schedule · Amber',dot:'🟡'},
  {sec:'Schedule',dim:'sch',val:'r',label:'Schedule · Red',dot:'🔴'},
  {sec:'Scope',dim:'scp',val:'g',label:'Scope · Green',dot:'🟢'},
  {sec:'Scope',dim:'scp',val:'a',label:'Scope · Amber',dot:'🟡'},
  {sec:'Scope',dim:'scp',val:'r',label:'Scope · Red',dot:'🔴'},
];
let depDrawMode=false;
let depSourceId=null;
let suppressNextDepClick=false;
let selectedTaskId=null;
/** Checked rows for bulk actions (CRM-style selection bar) */
const checkedRowIds=new Set();
let insertAfterId=null;
let pendingCellEdit=null; // {id, field} — resume edit after render (Tab nav)
let pendingCellEditValue=null; // optional draft to restore after remount
const createInFlight=new WeakMap(); // task -> Promise
let scrollSyncing=false;
let autoSchedule=false;
let zoomFitActive=false;
let zoomBeforeFit={zoom:'week',colW:28};
let savedGanttBodyHTML=null;
let scrollSyncBound=false;
let splitterBound=false;
const ROW_H=36;
const history=[];
let historyIdx=-1;
const MAX_HISTORY=50;
/** Invalidated whenever `tasks` structure changes — speeds getChildren / lookups */
let taskById=new Map();
let childrenByParent=new Map();
let taskIndexDirty=true;

function invalidateTaskIndex(){ taskIndexDirty=true; }
function rebuildTaskIndex(){
  taskById=new Map();
  childrenByParent=new Map();
  for(let i=0;i<tasks.length;i++){
    const t=tasks[i];
    taskById.set(t.id,t);
    const p=t.parent;
    let arr=childrenByParent.get(p);
    if(!arr){ arr=[]; childrenByParent.set(p,arr); }
    arr.push(t);
  }
  taskIndexDirty=false;
}
function ensureTaskIndex(){
  if(taskIndexDirty) rebuildTaskIndex();
}
function getTaskById(id){
  ensureTaskIndex();
  return taskById.get(id);
}
function historyCap(){
  return tasks.length>400?15:(tasks.length>150?25:MAX_HISTORY);
}

// ── UTILS ────────────────────────────────────────────────────
const D=(s)=>{ const dt=new Date(s+'T00:00:00'); return dt; };
const fmt=(dt)=>{
  const y=dt.getFullYear();
  const m=String(dt.getMonth()+1).padStart(2,'0');
  const d=String(dt.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+d;
};
const addDays=(dt,n)=>{ const r=new Date(dt); r.setDate(r.getDate()+n); return r; };
const daysBetween=(a,b)=>Math.round((b-a)/86400000);
const taskDurationDays=(s,e)=>Math.max(0,daysBetween(D(s),D(e)));

function taskDuration(t){
  if(t.type===6) return 0;
  const eff=getChildren(t.id).length?getEffectiveDates(t):{start:t.start,end:t.end};
  return taskDurationDays(eff.start,eff.end)+1;
}
function formatDuration(t){
  if(t.type===6) return '0d';
  return taskDuration(t)+'d';
}
function setTaskDuration(t,days){
  const d=Math.max(0,parseInt(days,10)||0);
  if(t.type===6){ t.end=t.start; return; }
  t.end=fmt(addDays(D(t.start),Math.max(0,d-1)));
}

// ── CRITICAL PATH TOGGLE ─────────────────────────────────────
function toggleCP(fromSwitch){
  if(fromSwitch===true){
    const sw=document.getElementById('switchCP');
    showCP=!!(sw&&sw.checked);
  } else {
    showCP=!showCP;
    const sw=document.getElementById('switchCP');
    if(sw) sw.checked=showCP;
  }
  const btn=document.getElementById('cpBtn');
  if(btn) btn.classList.toggle('on',showCP);
    renderAll();
    updateCpBanner();
    if(showCP){
      if(!tasks.some(t=>t.predId)){
        showToast('Add links in the Pred column (or Edit → Predecessor)','info',4200);
        pulsePredColumn();
      } else if(!criticalIds.size){
        showToast('No critical path found for current dependencies','info',3000);
      } else {
        showToast('Critical path: '+criticalIds.size+' item'+(criticalIds.size===1?'':'s')+' highlighted','ok',2200);
        focusFirstCritical();
      }
  }
}
function updateCpBanner(){
  let el=document.getElementById('cpBanner');
  if(!showCP){
    if(el) el.remove();
    return;
  }
  const toolbar=document.getElementById('ganttToolbar');
  if(!el){
    el=document.createElement('div');
    el.id='cpBanner';
    el.setAttribute('role','status');
    if(toolbar&&toolbar.parentNode) toolbar.parentNode.insertBefore(el, toolbar.nextSibling);
    else document.body.prepend(el);
  }
  const hasDeps=tasks.some(t=>t.predId);
  if(!hasDeps){
    el.className='cp-banner cp-banner-hint';
    el.innerHTML='<span><strong>Critical path on</strong> — hover a timeline bar, drag the <em>•</em> connector on either end to another bar (like ClickUp / monday Gantt). Pred column still works.</span>';
  } else if(!criticalIds.size){
    el.className='cp-banner cp-banner-warn';
    el.innerHTML='<span><strong>Critical path on</strong> — no zero-slack chain for the current links. Check predecessor and dependency type (FS / SS / FF).</span>'+
      '<button type="button" class="cp-banner-x" onclick="toggleCP()">Turn off</button>';
  } else {
    el.className='cp-banner cp-banner-on';
    el.innerHTML='<span><strong>Critical path on</strong> — '+criticalIds.size+' item'+(criticalIds.size===1?'':'s')+' in red.</span>'+
      '<button type="button" class="cp-banner-x" onclick="toggleCP()">Turn off</button>';
  }
}
function focusFirstCritical(){
  if(!criticalIds.size) return;
  const id=[...criticalIds][0];
  const row=document.getElementById('tr-'+id)||document.querySelector('.list-tr[data-id="'+id+'"]');
  const bar=document.getElementById('bar-'+id)||document.querySelector('.milestone-diamond.critical[data-id="'+id+'"]');
  const target=bar||row;
  if(target&&target.scrollIntoView) target.scrollIntoView({block:'nearest',inline:'nearest'});
  if(row){
    row.classList.add('cp-flash');
    setTimeout(()=>row.classList.remove('cp-flash'),1400);
  }
}
function pulsePredColumn(){
  const th=document.querySelector('.th-pred');
  if(!th) return;
  th.classList.add('th-pred-pulse');
  setTimeout(()=>th.classList.remove('th-pred-pulse'),2400);
  document.querySelectorAll('.task-pred-col').forEach(c=>{
    c.classList.add('pred-col-hint');
    setTimeout(()=>c.classList.remove('pred-col-hint'),2400);
  });
}
function toggleAutoSchedule(fromSwitch){
  if(fromSwitch===true){
    const sw=document.getElementById('switchAutoSched');
    autoSchedule=!!(sw&&sw.checked);
  } else {
    autoSchedule=!autoSchedule;
    const sw=document.getElementById('switchAutoSched');
    if(sw) sw.checked=autoSchedule;
  }
  if(autoSchedule){
    try{
      pushHistory();
      applyAutoSchedule();
      renderAll();
      void persistScheduleChanges();
      showToast('✓ Auto schedule applied','ok');
    }catch(e){
      showToast('Auto schedule failed','err',2800);
    }
  }
}
function toggleCollapseRows(fromSwitch){
  const sw=document.getElementById('switchCollapse');
  if(fromSwitch===true){
    // Bottom switch always collapses/expands the whole plan
    if(sw&&sw.checked) collapseAll(true);
    else expandAll(true);
  }
}
function toggleZoomFit(fromSwitch){
  const sw=document.getElementById('switchZoomFit');
  const on=fromSwitch===true?!!(sw&&sw.checked):!zoomFitActive;
  if(sw) sw.checked=on;
    if(on){
      zoomBeforeFit={zoom,colW};
      zoomFitActive=true;
      zoomToFit();
    } else {
      zoomFitActive=false;
      zoom=zoomBeforeFit.zoom||'week';
      colW=zoomBeforeFit.colW||28;
      const sel=document.getElementById('zoomToSelect');
      if(sel) sel.value=zoom;
      renderAll();
  }
}
function applyAutoSchedule(){
  let anyChanged=false;
  let changed=true,iter=0;
  while(changed&&iter<120){
    changed=false; iter++;
    tasks.forEach(t=>{
      if(!t.predId||t.type===6||getChildren(t.id).length) return;
      const pred=tasks.find(x=>x.id===t.predId);
      if(!pred) return;
      const predStart=D(pred.start),predEnd=D(pred.end);
      const depType=t.depType||'FS';
      const dur=taskDurationDays(t.start,t.end);
      let newStart=D(t.start),newEnd=D(t.end);
      if(depType==='FS'){
        const minStart=addDays(predEnd,1);
        if(newStart<minStart){ newStart=minStart; newEnd=addDays(newStart,dur); changed=true; }
      } else if(depType==='SS'){
        if(newStart<predStart){ newStart=new Date(predStart); newEnd=addDays(newStart,dur); changed=true; }
      } else if(depType==='EE'){
        if(newEnd<predEnd){ newEnd=new Date(predEnd); newStart=addDays(newEnd,-dur); changed=true; }
      }
      const ns=fmt(newStart),ne=fmt(newEnd);
      if(ns!==t.start||ne!==t.end){ t.start=ns; t.end=ne; changed=true; anyChanged=true; }
    });
  }
  rollupParentDates();
  return anyChanged;
}
function rollupParentDates(){
  [...tasks].sort((a,b)=>getDepth(b)-getDepth(a)).forEach(t=>{
    const kids=getChildren(t.id);
    if(!kids.length) return;
    const eff=getEffectiveDates(t);
    t.start=eff.start;
    t.end=eff.end;
  });
}
function afterTaskDateChange(task){
  if(autoSchedule) applyAutoSchedule();
  renderAll();
  if(task&&!isUnsavedLocal(task)){
    persistSave(task);
    if(autoSchedule) void persistScheduleChanges(task);
  }
}
async function persistScheduleChanges(primary){
  const touched=new Set();
  if(primary&&!isUnsavedLocal(primary)) touched.add(primary.id);
  if(autoSchedule){
    tasks.filter(t=>!isUnsavedLocal(t)&&(t.predId||tasks.some(x=>x.predId===t.id))).forEach(t=>touched.add(t.id));
  }
  for(const id of touched){
    const t=tasks.find(x=>x.id===id);
    if(t) await persistSave(t);
  }
}
function getChildren(id){
  ensureTaskIndex();
  return childrenByParent.get(id)||[];
}
function getSubtreeTasks(rootId){
  const out=[];
  function walk(id){
    const t=tasks.find(x=>x.id===id);
    if(t) out.push(t);
    getChildren(id).forEach(c=>walk(c.id));
  }
  walk(rootId);
  return out;
}
/** Container type when a Task/Milestone gains children (must not stay labeled Task). */
function suggestedContainerType(t){
  const p=t&&t.parent!=null?tasks.find(x=>x.id===t.parent):null;
  if(!p||p.type===0||p.type===1||p.type===7) return 2; // Phase under program/project/release
  if(p.type===2) return 4; // Activity under phase
  if(p.type===3) return 4; // Activity under workstream
  return 4;
}
function effectiveType(t){
  if(!t) return 5;
  if(getChildren(t.id).length&&(t.type===5||t.type===6)) return suggestedContainerType(t);
  return t.type;
}
function typeLabel(t){ return LEVELS[effectiveType(t)]||'Task'; }
function typeColorOf(t){ return LEVEL_COLORS[effectiveType(t)]||'#64748b'; }
/** Persistable promote: Task/Milestone with children → Phase/Activity. */
function promoteToContainerIfNeeded(t){
  if(!t||!getChildren(t.id).length) return false;
  if(t.type!==5&&t.type!==6) return false;
  const next=suggestedContainerType(t);
  if(t.type===next) return false;
  t.type=next;
  t.color=LEVEL_COLORS[next]||t.color;
  return true;
}
function normalizeContainerTypes(){
  let n=0;
  tasks.forEach(t=>{ if(promoteToContainerIfNeeded(t)) n++; });
  return n;
}
function getEffectiveDates(t){
  const kids=getChildren(t.id);
  if(!kids.length) return {start:t.start,end:t.end};
  let minS=null,maxE=null;
  kids.forEach(c=>{
    const ed=getEffectiveDates(c);
    const s=D(ed.start),e=D(ed.end);
    if(!minS||s<minS) minS=s;
    if(!maxE||e>maxE) maxE=e;
  });
  return {start:fmt(minS),end:fmt(maxE)};
}

function snapshotTasks(){ return JSON.stringify(tasks); }
function pushHistory(){
  const snap=snapshotTasks();
  if(historyIdx>=0&&history[historyIdx]===snap) return;
  history.splice(historyIdx+1);
  history.push(snap);
  const cap=historyCap();
  if(history.length>cap){
    history.shift();
    if(historyIdx>0) historyIdx--;
  }
  historyIdx=history.length-1;
  updateUndoRedoButtons();
}
function restoreHistory(idx){
  if(idx<0||idx>=history.length) return;
  historyIdx=idx;
  tasks=JSON.parse(history[historyIdx]);
  invalidateTaskIndex();
  updateUndoRedoButtons();
  renderAll();
  if(selectedTaskId!=null) selectTask(selectedTaskId);
}
function undo(){
  if(historyIdx<0||!history.length) return;
    const live=snapshotTasks();
    // Live mutated past tip (e.g. drag) — stash live for Redo, then restore tip
    if(live!==history[historyIdx]){
      history.splice(historyIdx+1);
      history.push(live);
      if(history.length>MAX_HISTORY){
        history.shift();
        historyIdx=Math.max(0,historyIdx-1);
      }
      restoreHistory(historyIdx);
      return;
    }
    if(historyIdx<=0) return;
    restoreHistory(historyIdx-1);
}
function redo(){
  if(historyIdx>=history.length-1) return;
  restoreHistory(historyIdx+1);
}
function updateUndoRedoButtons(){
  const u=document.getElementById('undoBtn');
  const r=document.getElementById('redoBtn');
  const canUndo=historyIdx>0||(historyIdx>=0&&!!history[historyIdx]&&snapshotTasks()!==history[historyIdx]);
  const canRedo=historyIdx<history.length-1;
  if(u) u.disabled=!canUndo;
  if(r) r.disabled=!canRedo;
}
function formatPred(t){
  if(!t.predId) return '—';
  const p=tasks.find(x=>x.id===t.predId);
  if(!p) return '—';
  const w=p.wbs||p.name.substring(0,12);
  const d=t.depType==='EE'?'FF':(t.depType||'FS');
  return w+' · '+d;
}
function getSummaryLevel(t){
  return Math.min(2, getDepth(t));
}
function getTaskBarClass(t,hasKids,isCrit){
  if(isCrit) return 'critical';
  if(hasKids) return 'summary-bar summary-l'+getSummaryLevel(t);
  if(t.type===4) return 'task-bar task-bar-activity';
  if(t.type===3) return 'task-bar task-bar-ws';
  if(t.rag==='r'||t.ragScp==='r') return 'task-bar task-bar-risk';
  return 'task-bar';
}
function saveCustomCols(){
  const pid=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||0;
  try{ localStorage.setItem('gantt-custom-cols-'+pid,JSON.stringify(customCols)); }catch(e){}
}
function loadCustomCols(){
  const pid=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||0;
  try{
    const raw=localStorage.getItem('gantt-custom-cols-'+pid);
    if(raw){
      customCols=JSON.parse(raw)||[];
      if(customCols.length) ccNextId=Math.max(ccNextId,...customCols.map(c=>Number(c.id)||0))+1;
    }
  }catch(e){ customCols=[]; }
}
function fieldVisibilityKey(){
  const pid=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||0;
  return 'gantt-field-vis-'+pid;
}
function isFieldVisible(id){
  if(Object.prototype.hasOwnProperty.call(fieldVisibility,id)) return !!fieldVisibility[id];
  const builtin=BUILTIN_FIELDS.find(f=>f.id===id);
  if(builtin) return !!builtin.defaultOn;
  // custom columns default on
  return true;
}
function loadFieldVisibility(){
  fieldVisibility={};
  BUILTIN_FIELDS.forEach(f=>{ fieldVisibility[f.id]=!!f.defaultOn; });
  try{
    const raw=localStorage.getItem(fieldVisibilityKey());
    if(raw){
      const saved=JSON.parse(raw)||{};
      Object.keys(saved).forEach(k=>{ fieldVisibility[k]=!!saved[k]; });
    }
  }catch(e){}
  // Locked fields always on
  BUILTIN_FIELDS.forEach(f=>{ if(f.locked) fieldVisibility[f.id]=true; });
}
function saveFieldVisibility(){
  try{ localStorage.setItem(fieldVisibilityKey(),JSON.stringify(fieldVisibility)); }catch(e){}
}
function columnWidthsKey(){
  const pid=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||0;
  return 'gantt-col-widths-'+pid;
}
function getBuiltinField(id){ return BUILTIN_FIELDS.find(f=>f.id===id)||null; }
function getColumnMinWidth(id){
  if(String(id).startsWith('custom:')) return 60;
  const f=getBuiltinField(id);
  return (f&&f.minW)||40;
}
function getColumnWidth(id){
  if(Object.prototype.hasOwnProperty.call(columnWidths,id)&&Number.isFinite(columnWidths[id])){
    return columnWidths[id];
  }
  if(String(id).startsWith('custom:')){
    const colId=Number(String(id).slice(7));
    const c=(customCols||[]).find(x=>Number(x.id)===colId);
    return Number(c&&c.width)||110;
  }
  const f=getBuiltinField(id);
  if(!f) return 80;
  if(f.widthKey){
    const n=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(f.widthKey));
    if(Number.isFinite(n)&&n>0) return n;
  }
  return f.widthFb||80;
}
function setColumnWidth(id,px,opts){
  const minW=getColumnMinWidth(id);
  const maxW=720;
  const w=Math.max(minW,Math.min(maxW,Math.round(Number(px)||minW)));
  columnWidths[id]=w;
  if(String(id).startsWith('custom:')){
    const colId=Number(String(id).slice(7));
    const c=(customCols||[]).find(x=>Number(x.id)===colId);
    if(c){
      c.width=w;
      const th=document.querySelector('#tpHeader .th-custom-col[data-col="'+colId+'"]');
      if(th){ th.style.width=w+'px'; th.style.minWidth=w+'px'; }
      document.querySelectorAll('.task-custom-col[data-col="'+colId+'"]').forEach(el=>{
        el.style.minWidth=w+'px';
        el.style.maxWidth=w+'px';
        el.style.width=w+'px';
      });
      if(!(opts&&opts.skipSave)) saveCustomCols();
    }
  } else {
    const f=getBuiltinField(id);
    if(f&&f.widthKey){
      document.documentElement.style.setProperty(f.widthKey,w+'px');
    }
  }
  if(!(opts&&opts.skipSave)){
    try{ localStorage.setItem(columnWidthsKey(),JSON.stringify(columnWidths)); }catch(e){}
  }
  if(!(opts&&opts.skipSync)) syncTaskPanelToContent(true);
  return w;
}
function loadColumnWidths(){
  columnWidths={};
  try{
    const raw=localStorage.getItem(columnWidthsKey());
    if(raw){
      const saved=JSON.parse(raw)||{};
      Object.keys(saved).forEach(k=>{
        const n=Number(saved[k]);
        if(Number.isFinite(n)&&n>0) columnWidths[k]=n;
      });
    }
  }catch(e){ columnWidths={}; }
  BUILTIN_FIELDS.forEach(f=>{
    if(!f.widthKey) return;
    const w=columnWidths[f.id]!=null?columnWidths[f.id]:f.widthFb;
    document.documentElement.style.setProperty(f.widthKey,(w||f.widthFb)+'px');
  });
  (customCols||[]).forEach(c=>{
    const key='custom:'+c.id;
    if(columnWidths[key]!=null) c.width=columnWidths[key];
  });
}
function ensureColumnResizeHandles(){
  const header=document.getElementById('tpHeader');
  if(!header) return;
  header.querySelectorAll('.th-cell[data-field], .th-custom-col[data-col]').forEach(th=>{
    if(th.classList.contains('th-add-col')||th.classList.contains('th-sel')||th.classList.contains('grid-filler')) return;
    if(th.getAttribute('data-field')==='sel') return;
    let handle=null;
    for(let i=0;i<th.children.length;i++){
      if(th.children[i].classList&&th.children[i].classList.contains('th-resize-handle')){
        handle=th.children[i]; break;
      }
    }
    if(!handle){
      handle=document.createElement('div');
      handle.className='th-resize-handle';
      handle.title='Drag to resize column';
      handle.setAttribute('aria-label','Resize column');
      th.appendChild(handle);
      handle.addEventListener('mousedown',e=>startColumnResize(e,th));
    }
  });
}
function startColumnResize(e,th){
  e.preventDefault();
  e.stopPropagation();
  const field=th.getAttribute('data-field');
  const colAttr=th.getAttribute('data-col');
  const id=field||(colAttr!=null?'custom:'+colAttr:null);
  if(!id) return;
  const startX=e.clientX;
  const startW=th.getBoundingClientRect().width||getColumnWidth(id);
  th.classList.add('is-resizing');
  document.body.classList.add('gantt-col-resizing');
  const move=e2=>{
    const dx=e2.clientX-startX;
    setColumnWidth(id,startW+dx,{skipSave:true,skipSync:false});
  };
  const up=()=>{
    document.removeEventListener('mousemove',move);
    document.removeEventListener('mouseup',up);
    th.classList.remove('is-resizing');
    document.body.classList.remove('gantt-col-resizing');
    setColumnWidth(id,getColumnWidth(id)); // persist + final sync
  };
  document.addEventListener('mousemove',move);
  document.addEventListener('mouseup',up);
}
function setFieldVisible(id,on){
  const builtin=BUILTIN_FIELDS.find(f=>f.id===id);
  if(builtin&&builtin.locked) return;
  fieldVisibility[id]=!!on;
  saveFieldVisibility();
  applyFieldVisibility();
  syncTaskPanelToContent(true);
  updateColumnsBtn();
  // Keep open menu checkboxes in sync if still visible
  const menu=document.getElementById('fieldsMenu');
  if(menu&&!menu.hasAttribute('hidden')) renderFieldsMenu();
}
function applyFieldVisibility(){
  const panel=document.getElementById('taskPanel');
  if(!panel) return;
  BUILTIN_FIELDS.forEach(f=>{
    panel.classList.toggle('hide-f-'+f.id, !isFieldVisible(f.id));
  });
  document.querySelectorAll('.th-custom-col[data-col], .task-custom-col[data-col]').forEach(el=>{
    const colId=el.getAttribute('data-col');
    const key='custom:'+colId;
    el.classList.toggle('is-field-hidden', !isFieldVisible(key));
  });
}
/** Toggleable column ids (built-in + custom), excluding locked # / Task name. */
function getToggleableColumnIds(){
  const ids=BUILTIN_FIELDS.filter(f=>!f.locked).map(f=>f.id);
  (customCols||[]).forEach(c=>ids.push('custom:'+c.id));
  return ids;
}
function countVisibleToggleableColumns(){
  const ids=getToggleableColumnIds();
  let on=0;
  ids.forEach(id=>{ if(isFieldVisible(id)) on++; });
  return {on,total:ids.length};
}
function updateColumnsBtn(){
  const btn=document.getElementById('fieldsMenuBtn');
  if(!btn) return;
  const {on,total}=countVisibleToggleableColumns();
  const filtered=total>0&&on<total;
  btn.classList.toggle('is-filtered',filtered);
  const caret=' <span class="type-filter-caret" aria-hidden="true">▾</span>';
  if(filtered){
    btn.innerHTML='Columns · '+on+'/'+total+caret;
    btn.title='Showing '+on+' of '+total+' optional columns — click to choose';
  } else {
    btn.innerHTML='Columns'+caret;
    btn.title='Choose which table columns are visible';
  }
}
function showAllColumns(){
  getToggleableColumnIds().forEach(id=>{ fieldVisibility[id]=true; });
  BUILTIN_FIELDS.forEach(f=>{ if(f.locked) fieldVisibility[f.id]=true; });
  saveFieldVisibility();
  applyFieldVisibility();
  syncTaskPanelToContent(true);
  updateColumnsBtn();
  renderFieldsMenu();
  showToast('All columns shown','ok',1600);
}
/** Keep # + Task name + Start + End; hide the rest. */
function showEssentialColumnsOnly(){
  const keep=new Set(['wbs','name','start','end']);
  BUILTIN_FIELDS.forEach(f=>{
    fieldVisibility[f.id]=keep.has(f.id)||!!f.locked;
  });
  (customCols||[]).forEach(c=>{ fieldVisibility['custom:'+c.id]=false; });
  saveFieldVisibility();
  applyFieldVisibility();
  syncTaskPanelToContent(true);
  updateColumnsBtn();
  renderFieldsMenu();
  showToast('Essential columns only (#, name, dates)','ok',2000);
}
window.showAllColumns=showAllColumns;
window.showEssentialColumnsOnly=showEssentialColumnsOnly;
function toggleFieldsMenu(e){
  if(e){e.preventDefault();e.stopPropagation();}
  const menu=document.getElementById('fieldsMenu');
  const btn=document.getElementById('fieldsMenuBtn');
  if(!menu||!btn) return;
  const open=menu.hasAttribute('hidden');
  if(open){
    // Close other filter menus
    ['ownerFilterMenu','ragFilterMenu','typeFilterMenu','versionMenu'].forEach(id=>{
      const m=document.getElementById(id);
      if(m) m.setAttribute('hidden','');
    });
    renderFieldsMenu();
    if(menu.parentElement!==document.body) document.body.appendChild(menu);
    const r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    menu.style.left=Math.max(8,Math.min(r.left, window.innerWidth-260))+'px';
    menu.removeAttribute('hidden');
    btn.setAttribute('aria-expanded','true');
    const close=(ev)=>{
      if(ev.target.closest&&(ev.target.closest('#fieldsMenuBtn')||ev.target.closest('#fieldsMenu'))) return;
      menu.setAttribute('hidden','');
      btn.setAttribute('aria-expanded','false');
      document.removeEventListener('mousedown',close,true);
    };
    setTimeout(()=>document.addEventListener('mousedown',close,true),0);
  } else {
    menu.setAttribute('hidden','');
    btn.setAttribute('aria-expanded','false');
  }
}
function renderFieldsMenu(){
  const menu=document.getElementById('fieldsMenu');
  if(!menu) return;
  const {on,total}=countVisibleToggleableColumns();
  let html=
    '<div class="fields-menu-title">Columns</div>'+
    '<p class="fields-menu-hint">Tick columns to show in the table. # and Task name stay on.</p>'+
    '<div class="type-filter-actions">'+
      '<button type="button" class="type-filter-link" onclick="event.stopPropagation();showAllColumns()">Show all</button>'+
      '<button type="button" class="type-filter-link" onclick="event.stopPropagation();showEssentialColumnsOnly()">Essential only</button>'+
    '</div>'+
    '<div class="fields-menu-count">'+on+' of '+total+' optional columns on</div>';
  BUILTIN_FIELDS.forEach(f=>{
    const visible=isFieldVisible(f.id);
    const locked=!!f.locked;
    html+=
      '<label class="fields-menu-opt'+(locked?' is-locked':'')+(visible?' is-on':'')+'" role="menuitemcheckbox" aria-checked="'+(visible?'true':'false')+'">'+
        '<input type="checkbox" '+(visible?'checked':'')+' '+(locked?'disabled':'')+
          ' onchange="setFieldVisible(\''+f.id+'\',this.checked)">'+
        '<span>'+esc(f.label)+(locked?' <span class="fields-locked-tag">always on</span>':'')+'</span>'+
      '</label>';
  });
  if(customCols.length){
    html+='<div class="fields-menu-sep"></div><div class="fields-menu-title">Custom</div>';
    customCols.forEach(c=>{
      const key='custom:'+c.id;
      const visible=isFieldVisible(key);
      html+=
        '<label class="fields-menu-opt'+(visible?' is-on':'')+'" role="menuitemcheckbox" aria-checked="'+(visible?'true':'false')+'">'+
          '<input type="checkbox" '+(visible?'checked':'')+
            ' onchange="setFieldVisible(\''+key+'\',this.checked)">'+
          '<span>'+esc(c.name)+'</span>'+
        '</label>';
    });
  }
  menu.innerHTML=html;
}
window.toggleFieldsMenu=toggleFieldsMenu;
window.setFieldVisible=setFieldVisible;

function renderCustomHeaders(){
  const el=document.getElementById('tpCustomHeaders');
  if(!el) return;
  const typeLabel={text:'Text',number:'Number',date:'Date',select:'Dropdown',checkbox:'Checkbox'};
  el.innerHTML=customCols.map(c=>{
    const w=getColumnWidth('custom:'+c.id);
    return '<div class="th-cell th-custom-col'+(isFieldVisible('custom:'+c.id)?'':' is-field-hidden')+'" data-col="'+c.id+'" style="width:'+w+'px;min-width:'+w+'px;" title="'+esc(c.name)+' · '+(typeLabel[c.type]||c.type||'Text')+'">'+
      esc(c.name)+' <span class="th-col-rm" onclick="event.stopPropagation();removeCustomColumn('+c.id+')" title="Remove column">×</span>'+
    '</div>';
  }).join('');
  ensureColumnResizeHandles();
}

function ensureAddColumnModal(){
  let modal=document.getElementById('modalAddColumn');
  // Replace older incomplete markup (name-only / select without type grid)
  if(modal&&!document.getElementById('acTypeGrid')){
    modal.remove();
    modal=null;
  }
  if(!modal){
    modal=document.createElement('div');
    modal.id='modalAddColumn';
    modal.className='modal-bg';
    modal.innerHTML=
      '<div class="modal" style="width:460px;" role="dialog" aria-labelledby="acTitle">'+
        '<div class="mh"><h3 id="acTitle">Add column</h3>'+
          '<button type="button" class="mc" id="acCloseBtn" aria-label="Close">✕</button></div>'+
        '<div class="mb">'+
          '<div class="fg"><label class="fl" for="acName">Column name</label>'+
            '<input id="acName" class="fi" type="text" maxlength="80" placeholder="e.g. Priority, Due date, Status" autocomplete="off"></div>'+
          '<div class="fg"><span class="fl">Column type</span>'+
            '<div class="ac-type-grid" id="acTypeGrid" role="radiogroup" aria-label="Column type">'+
              '<button type="button" class="ac-type-btn sel" data-type="text">Text</button>'+
              '<button type="button" class="ac-type-btn" data-type="number">Number</button>'+
              '<button type="button" class="ac-type-btn" data-type="date">Date</button>'+
              '<button type="button" class="ac-type-btn" data-type="select">Dropdown</button>'+
              '<button type="button" class="ac-type-btn" data-type="checkbox">Checkbox</button>'+
            '</div>'+
            '<input type="hidden" id="acType" value="text">'+
          '</div>'+
          '<div class="fg" id="acOptsWrap">'+
            '<label class="fl" for="acOpts">Dropdown options</label>'+
            '<textarea id="acOpts" class="fi" rows="4" placeholder="One option per line&#10;Low&#10;Medium&#10;High"></textarea>'+
            '<p class="versions-hint" style="margin:0;">Enter each choice on its own line (at least 2).</p>'+
          '</div>'+
          '<p class="vn-error" id="acError" hidden></p>'+
        '</div>'+
        '<div class="mf">'+
          '<button type="button" class="btn btn-ghost" id="acCancelBtn">Cancel</button>'+
          '<button type="button" class="btn btn-p" id="acConfirmBtn">Add column</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(modal);
  }
  if(!modal.dataset.acWired){
    modal.dataset.acWired='1';
    modal.addEventListener('click',function(e){ if(e.target===modal) closeModal('modalAddColumn'); });
    const closeBtn=document.getElementById('acCloseBtn');
    const cancelBtn=document.getElementById('acCancelBtn');
    const confirmBtn=document.getElementById('acConfirmBtn');
    const typeGrid=document.getElementById('acTypeGrid');
    const nameInp=document.getElementById('acName');
    if(closeBtn) closeBtn.onclick=function(){ closeModal('modalAddColumn'); };
    if(cancelBtn) cancelBtn.onclick=function(){ closeModal('modalAddColumn'); };
    if(confirmBtn) confirmBtn.onclick=function(){ confirmAddColumn(); };
    if(typeGrid) typeGrid.addEventListener('click',function(e){
      const btn=e.target.closest('.ac-type-btn');
      if(!btn) return;
      const type=btn.getAttribute('data-type');
      const typeEl=document.getElementById('acType');
      if(typeEl) typeEl.value=type;
      document.querySelectorAll('#acTypeGrid .ac-type-btn').forEach(function(b){ b.classList.toggle('sel', b===btn); });
      onAddColumnTypeChange();
    });
    if(nameInp) nameInp.addEventListener('keydown',function(e){
      if(e.key==='Enter'){ e.preventDefault(); confirmAddColumn(); }
    });
  }
  onAddColumnTypeChange();
  return modal;
}

function promptAddColumn(){ openAddColumnModal(); }
function openAddColumnModal(){
  const modal=ensureAddColumnModal();
  const err=document.getElementById('acError');
  if(err){ err.hidden=true; err.textContent=''; }
  const name=document.getElementById('acName');
  const type=document.getElementById('acType');
  const opts=document.getElementById('acOpts');
  if(name) name.value='';
  if(type) type.value='text';
  if(opts) opts.value='';
  document.querySelectorAll('#acTypeGrid .ac-type-btn').forEach(function(b){
    b.classList.toggle('sel', b.getAttribute('data-type')==='text');
  });
  onAddColumnTypeChange();
  modal.classList.add('open');
  setTimeout(function(){ if(name) name.focus(); },30);
}
function onAddColumnTypeChange(){
  const typeEl=document.getElementById('acType');
  const type=typeEl?typeEl.value:'text';
  const wrap=document.getElementById('acOptsWrap');
  if(!wrap) return;
  const show=type==='select';
  wrap.classList.toggle('is-open',show);
  wrap.hidden=!show;
  if(show){
    const opts=document.getElementById('acOpts');
    if(opts) setTimeout(function(){ opts.focus(); },20);
  }
}
function customColDefaultWidth(type){
  if(type==='number') return 80;
  if(type==='date') return 118;
  if(type==='select') return 120;
  if(type==='checkbox') return 72;
  return 110;
}
function confirmAddColumn(){
  ensureAddColumnModal();
  const nameEl=document.getElementById('acName');
  const typeEl=document.getElementById('acType');
  const optsEl=document.getElementById('acOpts');
  const err=document.getElementById('acError');
  const name=((nameEl&&nameEl.value)||'').trim();
  const type=(typeEl&&typeEl.value)||'text';
  if(!name){
    if(err){ err.hidden=false; err.textContent='Please enter a column name.'; }
    if(nameEl) nameEl.focus();
    return;
  }
  var opts=[];
  if(type==='select'){
    opts=String((optsEl&&optsEl.value)||'')
      .split(/\r?\n|,/)
      .map(function(s){ return s.trim(); })
      .filter(Boolean);
    opts=opts.filter(function(v,i,a){ return a.indexOf(v)===i; });
    if(opts.length<2){
      if(err){ err.hidden=false; err.textContent='Add at least 2 dropdown options (one per line).'; }
      if(optsEl){ optsEl.focus(); }
      return;
    }
  }
  pushHistory();
  customCols.push({
    id:ccNextId++,
    name:name,
    width:customColDefaultWidth(type),
    type:type,
    opts:type==='select'?opts:undefined,
  });
  fieldVisibility['custom:'+(ccNextId-1)]=true;
  saveFieldVisibility();
  saveCustomCols();
  closeModal('modalAddColumn');
  renderCustomHeaders();
  renderAll();
  syncTaskPanelToContent(true);
  applyFieldVisibility();
  updateColumnsBtn();
  showToast('Column "'+name+'" added','ok',2200);
}
window.promptAddColumn=promptAddColumn;
window.openAddColumnModal=openAddColumnModal;
window.onAddColumnTypeChange=onAddColumnTypeChange;
window.confirmAddColumn=confirmAddColumn;
window.ensureAddColumnModal=ensureAddColumnModal;

function removeCustomColumn(id){
  if(!confirm('Remove this column?')) return;
  pushHistory();
  customCols=customCols.filter(c=>c.id!==id);
  delete fieldVisibility['custom:'+id];
  saveFieldVisibility();
  tasks.forEach(t=>{
    if(t.customData) delete t.customData[id];
  });
  saveCustomCols();
  renderCustomHeaders();
  renderAll();
  syncTaskPanelToContent(true);
  applyFieldVisibility();
  updateColumnsBtn();
}
function updateTaskDateCells(taskId,startStr,endStr){
  const row=document.getElementById('tr-'+taskId);
  if(!row) return;
  const spans=row.querySelectorAll('.task-date-col span');
  if(spans[0]) spans[0].textContent=startStr;
  if(spans[1]) spans[1].textContent=endStr;
}
const fmtShort=(dt)=>dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
const fmtDisp=(dt)=>dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
function avInits(n){if(!n)return'?';return n.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();}
function avC(n){
  if(!n) return '#64748b';
  const palette=['#4f46e5','#059669','#0891b2','#d97706','#db2477','#ea580c','#7c3aed','#0f766e'];
  let h=0; for(let i=0;i<n.length;i++) h=(h*31+n.charCodeAt(i))&0xffffffff;
  return palette[Math.abs(h)%palette.length];
}
function esc(s){const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}

// ── WBS CALCULATION ──────────────────────────────────────────
function calcWBS(){
  tasks.forEach(t=>{ t.wbs=''; });
  // Break self-parent / cycles so hierarchy walks cannot hang the iframe
  tasks.forEach(t=>{
    if(t.parent===t.id) t.parent=null;
  });
  const rootTasks=tasks.filter(t=>t.parent===null);
  const visiting=new Set();
  function assign(list,prefix){
    let c=0;
    list.forEach(t=>{
      if(visiting.has(t.id)) return;
      visiting.add(t.id);
      c++;
      const wbs=prefix?(prefix+'.'+c):String(c);
      t.wbs=wbs;
      const children=tasks.filter(ch=>ch.parent===t.id&&ch.id!==t.id);
      if(children.length) assign(children,wbs);
      visiting.delete(t.id);
    });
  }
  assign(rootTasks,'');
  // Orphans (broken parent refs) get top-level WBS
  tasks.filter(t=>!t.wbs).forEach((t,i)=>{
    t.parent=null;
    t.wbs=String(rootTasks.length+i+1);
  });
}

// ── CRITICAL PATH ────────────────────────────────────────────
/** Classic ES/EF + LS/LF slack on the dependency network (predId + extraPredIds links).
 * Generalized from a single-predecessor-only version to also walk extraPredIds.
 * For any task with no extraPredIds — true of all tasks before that field
 * existed — predEdges(t) returns exactly the one {id,type} pair the old code
 * built from predId/depType directly (or none), so this computes byte-for-byte
 * the same ES/EF/LS/LF/critical-path result as before on that data: forward
 * pass takes the max candidate start across edges (one edge ⇒ that candidate,
 * unchanged), backward pass's per-successor edge type is captured at the same
 * point the old code read s.depType, so it's the same value either way. */
function computeCriticalPath(){
  criticalIds=new Set();
  if(!showCP) return;

  const byId=new Map(tasks.map(t=>[t.id,t]));
  if(!tasks.some(t=>predEdges(t,byId).length)) return;

  const successors=new Map(); // predecessor id -> [{succId,type}]
  tasks.forEach(t=>{
    predEdges(t,byId).forEach(edge=>{
      if(!successors.has(edge.id)) successors.set(edge.id,[]);
      successors.get(edge.id).push({succId:t.id,type:edge.type});
    });
  });
  const inNetwork=new Set();
  tasks.forEach(t=>{
    const edges=predEdges(t,byId);
    if(edges.length){
      inNetwork.add(t.id);
      edges.forEach(e=>inNetwork.add(e.id));
    }
  });
  if(!inNetwork.size) return;

  const durDays=(t)=>{
    if(t.type===6) return 0;
    return Math.max(1,taskDurationDays(t.start,t.end)+1);
  };

  // Forward: earliest start / finish (in day units from an arbitrary epoch).
  // A task waits for ALL its predecessors, so its earliest start is the
  // latest (max) of each edge's candidate start.
  const es=new Map(), ef=new Map();
  function calcForward(id,visiting){
    if(es.has(id)) return;
    if(visiting.has(id)) return;
    visiting.add(id);
    const t=byId.get(id);
    if(!t){ visiting.delete(id); return; }
    let start=0;
    predEdges(t,byId).forEach(edge=>{
      calcForward(edge.id,visiting);
      const pEs=es.get(edge.id)||0;
      const pEf=ef.get(edge.id)||0;
      let candidate;
      if(edge.type==='FS') candidate=pEf;
      else if(edge.type==='SS') candidate=pEs;
      else candidate=Math.max(0,pEf-durDays(t)); // FF
      if(candidate>start) start=candidate;
    });
    es.set(id,start);
    ef.set(id,start+durDays(t));
    visiting.delete(id);
  }
  inNetwork.forEach(id=>calcForward(id,new Set()));

  const projectEnd=Math.max(0,...[...inNetwork].map(id=>ef.get(id)||0));

  // Backward: latest finish / start
  const ls=new Map(), lf=new Map();
  function calcBackward(id,visiting){
    if(lf.has(id)) return;
    if(visiting.has(id)) return;
    visiting.add(id);
    const t=byId.get(id);
    if(!t){ visiting.delete(id); return; }
    const succs=(successors.get(id)||[]).filter(e=>inNetwork.has(e.succId));
    let finish=projectEnd;
    if(succs.length){
      finish=Math.min(...succs.map(e=>{
        calcBackward(e.succId,visiting);
        const sLs=ls.get(e.succId)||0;
        const sLf=lf.get(e.succId)||0;
        if(e.type==='FS') return sLs;          // pred must finish before succ starts
        if(e.type==='SS') return sLs;          // pred start aligned → treat LF as succ LS + pred dur later
        return sLf;                        // FF
      }));
    }
    lf.set(id,finish);
    ls.set(id,finish-durDays(t));
    visiting.delete(id);
  }
  inNetwork.forEach(id=>calcBackward(id,new Set()));

  const TOL=0.01;
  inNetwork.forEach(id=>{
    const slack=(ls.get(id)||0)-(es.get(id)||0);
    if(Math.abs(slack)<=TOL) criticalIds.add(id);
  });
}

// ── DATE RANGE ───────────────────────────────────────────────
function getRange(){
  const allS=tasks.map(t=>D(t.start));
  const allE=tasks.map(t=>D(t.end));
  if(!allS.length) return {start:new Date(),end:addDays(new Date(),90)};
  const min=new Date(Math.min(...allS));
  const max=new Date(Math.max(...allE));
  return {start:addDays(min,-7),end:addDays(max,14)};
}

// ── VISIBLE TASKS ────────────────────────────────────────────
function getOrderedTasks(){
  ensureTaskIndex();
  const result=[];
  const seen=new Set();
  function walk(parentId){
    const kids=childrenByParent.get(parentId)||[];
    for(let i=0;i<kids.length;i++){
      const t=kids[i];
      if(seen.has(t.id)) continue;
      seen.add(t.id);
      result.push(t);
      walk(t.id);
    }
  }
  walk(null);
  for(let i=0;i<tasks.length;i++){
    const t=tasks[i];
    if(!seen.has(t.id)){ seen.add(t.id); result.push(t); }
  }
  return result;
}
function hasLevelFilter(){
  return levelFilterTypes.size>0;
}
function syncLevelFilterHidden(){
  const el=document.getElementById('f-level');
  if(!el) return;
  if(!levelFilterTypes.size){ el.value=''; return; }
  el.value=Array.from(levelFilterTypes).sort((a,b)=>a-b).join(',');
}
function updateTypeFilterBtn(){
  const btn=document.getElementById('typeFilterBtn');
  if(!btn) return;
  if(!levelFilterTypes.size){
    btn.innerHTML='All types <span class="type-filter-caret" aria-hidden="true">▾</span>';
    btn.classList.remove('is-filtered');
    btn.title='Filter by type — tick one or more to show only those';
    btn.setAttribute('aria-expanded','false');
    return;
  }
  const labels=LEVEL_FILTER_ORDER.filter(n=>levelFilterTypes.has(n)).map(n=>LEVELS[n]||String(n));
  const text=labels.length<=2?labels.join(', '):(labels[0]+' +'+(labels.length-1));
  btn.innerHTML=esc(text)+' <span class="type-filter-caret" aria-hidden="true">▾</span>';
  btn.classList.add('is-filtered');
  btn.title='Showing: '+labels.join(', ')+' — click to change';
}
function toggleTypeFilterMenu(e){
  if(e){e.preventDefault();e.stopPropagation();}
  const menu=document.getElementById('typeFilterMenu');
  const btn=document.getElementById('typeFilterBtn');
  if(!menu||!btn) return;
  const open=menu.hasAttribute('hidden');
  if(open){
    // Close other filter menus
    const fieldsMenu=document.getElementById('fieldsMenu');
    if(fieldsMenu) fieldsMenu.setAttribute('hidden','');
    const ragMenu=document.getElementById('ragFilterMenu');
    if(ragMenu) ragMenu.setAttribute('hidden','');
    const ragBtn=document.getElementById('ragFilterBtn');
    if(ragBtn) ragBtn.setAttribute('aria-expanded','false');
    const ownerMenu=document.getElementById('ownerFilterMenu');
    if(ownerMenu) ownerMenu.setAttribute('hidden','');
    const ownerBtn=document.getElementById('ownerFilterBtn');
    if(ownerBtn) ownerBtn.setAttribute('aria-expanded','false');
    renderTypeFilterMenu();
    if(menu.parentElement!==document.body) document.body.appendChild(menu);
    const r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    menu.style.left=Math.max(8,Math.min(r.left, window.innerWidth-240))+'px';
    menu.removeAttribute('hidden');
    btn.setAttribute('aria-expanded','true');
    const close=(ev)=>{
      if(ev.target.closest&&(ev.target.closest('#typeFilterBtn')||ev.target.closest('#typeFilterMenu'))) return;
      menu.setAttribute('hidden','');
      btn.setAttribute('aria-expanded','false');
      document.removeEventListener('mousedown',close,true);
    };
    setTimeout(()=>document.addEventListener('mousedown',close,true),0);
  } else {
    menu.setAttribute('hidden','');
    btn.setAttribute('aria-expanded','false');
  }
}
function renderTypeFilterMenu(){
  const menu=document.getElementById('typeFilterMenu');
  if(!menu) return;
  const nSel=levelFilterTypes.size;
  let html='<div class="fields-menu-title">Show types</div>';
  html+='<div class="type-filter-hint">'+(nSel?nSel+' selected — tick more to combine':'Tick any combination (empty = all)')+'</div>';
  html+='<div class="type-filter-actions">'+
    '<button type="button" class="type-filter-link" onclick="selectAllTypeFilters(event)">Show all</button>'+
    '<button type="button" class="type-filter-link" onclick="clearTypeFilter(event)">Clear</button>'+
  '</div>';
  LEVEL_FILTER_ORDER.forEach(n=>{
    const on=levelFilterTypes.has(n);
    const label=LEVELS[n]||String(n);
    const icon=TYPE_ICONS[n]||'';
    html+=
      '<label class="fields-menu-opt'+(on?' is-on':'')+'" data-type="'+n+'" role="menuitemcheckbox" aria-checked="'+(on?'true':'false')+'">'+
        '<input type="checkbox" '+(on?'checked':'')+
          ' onchange="setTypeFilter('+n+',this.checked)">'+
        '<span>'+(icon?'<span class="type-filter-ico" aria-hidden="true">'+icon+'</span> ':'')+esc(label)+'</span>'+
      '</label>';
  });
  menu.innerHTML=html;
}
function setTypeFilter(typeNum,on){
  const n=Number(typeNum);
  if(on) levelFilterTypes.add(n);
  else levelFilterTypes.delete(n);
  // Selecting every type is the same as "All types" — clear for cleaner UX
  if(levelFilterTypes.size===LEVEL_FILTER_ORDER.length) levelFilterTypes.clear();
  syncLevelFilterHidden();
  updateTypeFilterBtn();
  const menu=document.getElementById('typeFilterMenu');
  if(menu&&!menu.hasAttribute('hidden')){
    // If we collapsed to "all", remount so checkboxes clear; else update in place
    if(!levelFilterTypes.size){
      renderTypeFilterMenu();
    } else {
      const nSel=levelFilterTypes.size;
      const hint=menu.querySelector('.type-filter-hint');
      if(hint) hint.textContent=nSel?nSel+' selected — tick more to combine':'Tick any combination (empty = all)';
      const lab=menu.querySelector('.fields-menu-opt[data-type="'+n+'"]');
      if(lab){
        lab.classList.toggle('is-on',!!on);
        lab.setAttribute('aria-checked',on?'true':'false');
        const inp=lab.querySelector('input');
        if(inp) inp.checked=!!on;
      }
    }
  }
  refreshVisibleStructure();
}
function clearTypeFilter(e){
  if(e){e.preventDefault();e.stopPropagation();}
  levelFilterTypes.clear();
  syncLevelFilterHidden();
  updateTypeFilterBtn();
  const menu=document.getElementById('typeFilterMenu');
  const btn=document.getElementById('typeFilterBtn');
  if(menu&&!menu.hasAttribute('hidden')){
    renderTypeFilterMenu();
    if(btn) btn.setAttribute('aria-expanded','true');
  }
  refreshVisibleStructure();
}
function selectAllTypeFilters(e){
  if(e){e.preventDefault();e.stopPropagation();}
  // "Select all" = show everything (clear filter)
  clearTypeFilter(e);
}
window.toggleTypeFilterMenu=toggleTypeFilterMenu;
window.setTypeFilter=setTypeFilter;
window.clearTypeFilter=clearTypeFilter;
window.selectAllTypeFilters=selectAllTypeFilters;

function hasOwnerFilter(){
  return ownerFilterOwners.size>0;
}
function syncOwnerFilterHidden(){
  const el=document.getElementById('f-owner');
  if(!el) return;
  if(!ownerFilterOwners.size){ el.value=''; return; }
  el.value=Array.from(ownerFilterOwners).join('\u0001');
}
function updateOwnerFilterBtn(){
  const btn=document.getElementById('ownerFilterBtn');
  if(!btn) return;
  if(!ownerFilterOwners.size){
    btn.innerHTML='All owners <span class="type-filter-caret" aria-hidden="true">▾</span>';
    btn.classList.remove('is-filtered');
    btn.title='Filter by owner — tick one or more to show only those';
    btn.setAttribute('aria-expanded','false');
    return;
  }
  const labels=OWNERS.filter(o=>ownerFilterOwners.has(o));
  const text=labels.length<=2?labels.join(', '):(labels[0]+' +'+(labels.length-1));
  btn.innerHTML=esc(text)+' <span class="type-filter-caret" aria-hidden="true">▾</span>';
  btn.classList.add('is-filtered');
  btn.title='Showing: '+labels.join(', ')+' — click to change';
}
function toggleOwnerFilterMenu(e){
  if(e){e.preventDefault();e.stopPropagation();}
  const menu=document.getElementById('ownerFilterMenu');
  const btn=document.getElementById('ownerFilterBtn');
  if(!menu||!btn) return;
  const open=menu.hasAttribute('hidden');
  if(open){
    const fieldsMenu=document.getElementById('fieldsMenu');
    if(fieldsMenu) fieldsMenu.setAttribute('hidden','');
    const ragMenu=document.getElementById('ragFilterMenu');
    if(ragMenu) ragMenu.setAttribute('hidden','');
    const ragBtn=document.getElementById('ragFilterBtn');
    if(ragBtn) ragBtn.setAttribute('aria-expanded','false');
    const typeMenu=document.getElementById('typeFilterMenu');
    if(typeMenu) typeMenu.setAttribute('hidden','');
    const typeBtn=document.getElementById('typeFilterBtn');
    if(typeBtn) typeBtn.setAttribute('aria-expanded','false');
    renderOwnerFilterMenu();
    if(menu.parentElement!==document.body) document.body.appendChild(menu);
    const r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    menu.style.left=Math.max(8,Math.min(r.left, window.innerWidth-240))+'px';
    menu.removeAttribute('hidden');
    btn.setAttribute('aria-expanded','true');
    const close=(ev)=>{
      if(ev.target.closest&&(ev.target.closest('#ownerFilterBtn')||ev.target.closest('#ownerFilterMenu'))) return;
      menu.setAttribute('hidden','');
      btn.setAttribute('aria-expanded','false');
      document.removeEventListener('mousedown',close,true);
    };
    setTimeout(()=>document.addEventListener('mousedown',close,true),0);
  } else {
    menu.setAttribute('hidden','');
    btn.setAttribute('aria-expanded','false');
  }
}
function renderOwnerFilterMenu(){
  const menu=document.getElementById('ownerFilterMenu');
  if(!menu) return;
  const nSel=ownerFilterOwners.size;
  let html='<div class="fields-menu-title">Show owners</div>';
  html+='<div class="type-filter-hint">'+(nSel?nSel+' selected — tick more to combine':'Tick any combination (empty = all)')+'</div>';
  html+='<div class="type-filter-actions">'+
    '<button type="button" class="type-filter-link" onclick="selectAllOwnerFilters(event)">Show all</button>'+
    '<button type="button" class="type-filter-link" onclick="clearOwnerFilter(event)">Clear</button>'+
  '</div>';
  if(!OWNERS.length){
    html+='<div class="type-filter-hint">No owners on this plan yet</div>';
  } else {
    OWNERS.forEach((o,i)=>{
      const on=ownerFilterOwners.has(o);
      const safe=esc(o);
      html+=
        '<label class="fields-menu-opt'+(on?' is-on':'')+'" data-owner="'+i+'" role="menuitemcheckbox" aria-checked="'+(on?'true':'false')+'">'+
          '<input type="checkbox" '+(on?'checked':'')+
            ' onchange="setOwnerFilterByIndex('+i+',this.checked)">'+
          '<span><span class="av type-filter-av" style="background:'+avC(o)+'" aria-hidden="true">'+esc(avInits(o))+'</span> '+safe+'</span>'+
        '</label>';
    });
  }
  menu.innerHTML=html;
}
function setOwnerFilterByIndex(idx,on){
  const o=OWNERS[Number(idx)];
  if(o==null) return;
  setOwnerFilter(o,on);
}
function setOwnerFilter(owner,on){
  if(on) ownerFilterOwners.add(owner);
  else ownerFilterOwners.delete(owner);
  if(OWNERS.length&&ownerFilterOwners.size===OWNERS.length) ownerFilterOwners.clear();
  syncOwnerFilterHidden();
  updateOwnerFilterBtn();
  const menu=document.getElementById('ownerFilterMenu');
  if(menu&&!menu.hasAttribute('hidden')){
    if(!ownerFilterOwners.size){
      renderOwnerFilterMenu();
    } else {
      const nSel=ownerFilterOwners.size;
      const hint=menu.querySelector('.type-filter-hint');
      if(hint) hint.textContent=nSel?nSel+' selected — tick more to combine':'Tick any combination (empty = all)';
      const i=OWNERS.indexOf(owner);
      const lab=i>=0?menu.querySelector('.fields-menu-opt[data-owner="'+i+'"]'):null;
      if(lab){
        lab.classList.toggle('is-on',!!on);
        lab.setAttribute('aria-checked',on?'true':'false');
        const inp=lab.querySelector('input');
        if(inp) inp.checked=!!on;
      }
    }
  }
  refreshVisibleStructure();
}
function clearOwnerFilter(e){
  if(e){e.preventDefault();e.stopPropagation();}
  ownerFilterOwners.clear();
  syncOwnerFilterHidden();
  updateOwnerFilterBtn();
  const menu=document.getElementById('ownerFilterMenu');
  const btn=document.getElementById('ownerFilterBtn');
  if(menu&&!menu.hasAttribute('hidden')){
    renderOwnerFilterMenu();
    if(btn) btn.setAttribute('aria-expanded','true');
  }
  refreshVisibleStructure();
}
function selectAllOwnerFilters(e){
  if(e){e.preventDefault();e.stopPropagation();}
  clearOwnerFilter(e);
}
window.toggleOwnerFilterMenu=toggleOwnerFilterMenu;
window.setOwnerFilter=setOwnerFilter;
window.setOwnerFilterByIndex=setOwnerFilterByIndex;
window.clearOwnerFilter=clearOwnerFilter;
window.selectAllOwnerFilters=selectAllOwnerFilters;

function getVisible(){
  const fq=(document.getElementById('f-search')?.value||'').trim().toLowerCase();
  const filteringTypes=hasLevelFilter();
  const filteringOwners=hasOwnerFilter();
  const filteringRag=hasRagFilter();
  ensureTaskIndex();
  return getOrderedTasks().filter(t=>{
    // When type-filtering, still show matching rows even if an ancestor folder is collapsed
    // (otherwise "Milestones only" looks empty). Otherwise respect collapse.
    if(!filteringTypes){
    let p=t.parent;
    const seen=new Set();
    while(p!==null){
      if(seen.has(p)||p===t.id) break;
      seen.add(p);
      if(collapsed[p]) return false;
        const pt=taskById.get(p);
      if(!pt||pt.parent===pt.id) break;
      p=pt.parent;
    }
    }
    if(filteringTypes&&!levelFilterTypes.has(Number(t.type))) return false;
    if(filteringOwners&&!ownerFilterOwners.has(t.owner||'')) return false;
    if(filteringRag){
      let ok=false;
      for(const key of ragFilterKeys){
        const i=key.indexOf(':');
        if(i<0) continue;
        const dim=key.slice(0,i);
        const val=key.slice(i+1);
        if(ragField(t,dim)===val){ ok=true; break; }
      }
      if(!ok) return false;
    }
    if(fq&&!(t.name||'').toLowerCase().includes(fq)&&!(t.wbs||'').toLowerCase().includes(fq)) return false;
    return true;
  });
}

let ganttSearchTimer=null;
function onGanttSearchInput(){
  if(ganttSearchTimer) clearTimeout(ganttSearchTimer);
  ganttSearchTimer=setTimeout(()=>{
    ganttSearchTimer=null;
    refreshVisibleStructure();
  },200);
}
/** Collapse / search / filter — rebuild visible rows without WBS/CP full pass when possible */
function refreshVisibleStructure(){
  const snap=captureGanttScroll();
  if(mainView==='list'){
    renderListView();
    updateCpBanner();
    restoreGanttScroll(snap);
    return;
  }
  const {start,end}=getRange();
  const totalW=daysBetween(start,end)*colW;
  renderTaskPanel();
  renderTimeline(start,end,totalW);
  positionTodayLine(start);
  if(selectedTaskId!=null) selectTask(selectedTaskId);
  restoreGanttScroll(snap);
  updateCpBanner();
}

/** Place task in the array immediately after its parent (and parent's subtree) for clear hierarchy */
function moveTaskAfterParent(task){
  const from=tasks.findIndex(x=>x.id===task.id);
  if(from<0) return;
  tasks.splice(from,1);
  if(task.parent===null){
    tasks.push(task);
    invalidateTaskIndex();
    return;
  }
  // Find end of parent's subtree in current array
  let insertAt=tasks.findIndex(x=>x.id===task.parent);
  if(insertAt<0){ tasks.push(task); invalidateTaskIndex(); return; }
  insertAt++;
  while(insertAt<tasks.length){
    const cur=tasks[insertAt];
    let d=0,p=cur.parent;
    let underParent=false;
    while(p!==null){
      if(p===task.parent){ underParent=true; break; }
      const pt=tasks.find(x=>x.id===p);
      p=pt?pt.parent:null;
      if(++d>20) break;
    }
    if(!underParent) break;
    insertAt++;
  }
  tasks.splice(insertAt,0,task);
  invalidateTaskIndex();
}

function flashTaskRow(id){
  const r=document.getElementById('tr-'+id);
  if(!r) return;
  r.classList.add('flash-hier');
  setTimeout(()=>r.classList.remove('flash-hier'),900);
}

function toggleRagFilterMenu(e){
  if(e){e.preventDefault();e.stopPropagation();}
  const menu=document.getElementById('ragFilterMenu');
  const btn=document.getElementById('ragFilterBtn');
  if(!menu||!btn) return;
  const open=menu.hasAttribute('hidden');
  if(open){
    const typeMenu=document.getElementById('typeFilterMenu');
    if(typeMenu) typeMenu.setAttribute('hidden','');
    const typeBtn=document.getElementById('typeFilterBtn');
    if(typeBtn) typeBtn.setAttribute('aria-expanded','false');
    const ownerMenu=document.getElementById('ownerFilterMenu');
    if(ownerMenu) ownerMenu.setAttribute('hidden','');
    const ownerBtn=document.getElementById('ownerFilterBtn');
    if(ownerBtn) ownerBtn.setAttribute('aria-expanded','false');
    renderRagFilterMenu();
    if(menu.parentElement!==document.body) document.body.appendChild(menu);
    const r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    menu.style.left=Math.max(8,Math.min(r.left, window.innerWidth-260))+'px';
    menu.removeAttribute('hidden');
    btn.setAttribute('aria-expanded','true');
    const close=(ev)=>{
      if(ev.target.closest&&(ev.target.closest('#ragFilterBtn')||ev.target.closest('#ragFilterMenu'))) return;
      menu.setAttribute('hidden','');
      btn.setAttribute('aria-expanded','false');
      document.removeEventListener('mousedown',close,true);
    };
    setTimeout(()=>document.addEventListener('mousedown',close,true),0);
  } else {
    menu.setAttribute('hidden','');
    btn.setAttribute('aria-expanded','false');
  }
}
function hasRagFilter(){
  return ragFilterKeys.size>0;
}
function syncRagFilterHidden(){
  const dimEl=document.getElementById('f-rag-dim');
  const hidden=document.getElementById('f-rag');
  if(!ragFilterKeys.size){
    if(dimEl) dimEl.value='';
    if(hidden) hidden.value='';
    return;
  }
  // Keep first key in hiddens for any legacy readers; filtering uses ragFilterKeys
  const first=Array.from(ragFilterKeys)[0];
  const i=first.indexOf(':');
  if(dimEl) dimEl.value=i>=0?first.slice(0,i):'';
  if(hidden) hidden.value=i>=0?first.slice(i+1):'';
}
function updateRagFilterBtn(){
  const btn=document.getElementById('ragFilterBtn');
  if(!btn) return;
  const on=hasRagFilter();
  btn.classList.toggle('active',on);
  btn.classList.toggle('is-filtered',on);
  btn.title=on
    ?('RAG filter: '+ragFilterKeys.size+' selected — click to change')
    :'Filter by Budget / Schedule / Scope RAG — tick one or more';
}
function renderRagFilterMenu(){
  const menu=document.getElementById('ragFilterMenu');
  if(!menu) return;
  const nSel=ragFilterKeys.size;
  let html='<div class="fields-menu-title">Show RAG</div>';
  html+='<div class="type-filter-hint">'+(nSel?nSel+' selected — tick more to combine':'Tick any combination (empty = all)')+'</div>';
  html+='<div class="type-filter-actions">'+
    '<button type="button" class="type-filter-link" onclick="selectAllRagFilters(event)">Show all</button>'+
    '<button type="button" class="type-filter-link" onclick="clearRagFilter(event)">Clear</button>'+
  '</div>';
  let lastSec='';
  RAG_FILTER_OPTS.forEach(opt=>{
    if(opt.sec!==lastSec){
      html+='<div class="rag-filter-sec">'+esc(opt.sec)+'</div>';
      lastSec=opt.sec;
    }
    const key=opt.dim+':'+opt.val;
    const on=ragFilterKeys.has(key);
    html+=
      '<label class="fields-menu-opt'+(on?' is-on':'')+'" data-rag-key="'+key+'" role="menuitemcheckbox" aria-checked="'+(on?'true':'false')+'">'+
        '<input type="checkbox" '+(on?'checked':'')+
          ' onchange="setRagFilterKey(\''+key+'\',this.checked)">'+
        '<span>'+opt.dot+' '+esc(opt.label)+'</span>'+
      '</label>';
  });
  menu.innerHTML=html;
}
function setRagFilterKey(key,on){
  if(on) ragFilterKeys.add(key);
  else ragFilterKeys.delete(key);
  if(ragFilterKeys.size===RAG_FILTER_OPTS.length) ragFilterKeys.clear();
  syncRagFilterHidden();
  updateRagFilterBtn();
  const menu=document.getElementById('ragFilterMenu');
  if(menu&&!menu.hasAttribute('hidden')){
    if(!ragFilterKeys.size){
      renderRagFilterMenu();
    } else {
      const nSel=ragFilterKeys.size;
      const hint=menu.querySelector('.type-filter-hint');
      if(hint) hint.textContent=nSel?nSel+' selected — tick more to combine':'Tick any combination (empty = all)';
      const lab=menu.querySelector('.fields-menu-opt[data-rag-key="'+key+'"]');
      if(lab){
        const stillOn=ragFilterKeys.has(key);
        lab.classList.toggle('is-on',stillOn);
        lab.setAttribute('aria-checked',stillOn?'true':'false');
        const inp=lab.querySelector('input');
        if(inp) inp.checked=stillOn;
      }
    }
  }
  refreshVisibleStructure();
}
/** Legacy single-select API — maps to checkbox set */
function setRagFilter(dim,val){
  ragFilterKeys.clear();
  if(dim&&val) ragFilterKeys.add(dim+':'+val);
  syncRagFilterHidden();
  updateRagFilterBtn();
  const menu=document.getElementById('ragFilterMenu');
  if(menu&&!menu.hasAttribute('hidden')) renderRagFilterMenu();
  refreshVisibleStructure();
}
function clearRagFilter(e){
  if(e){e.preventDefault();e.stopPropagation();}
  ragFilterKeys.clear();
  syncRagFilterHidden();
  updateRagFilterBtn();
  const menu=document.getElementById('ragFilterMenu');
  const btn=document.getElementById('ragFilterBtn');
  if(menu&&!menu.hasAttribute('hidden')){
    renderRagFilterMenu();
    if(btn) btn.setAttribute('aria-expanded','true');
  }
  refreshVisibleStructure();
}
function selectAllRagFilters(e){
  if(e){e.preventDefault();e.stopPropagation();}
  clearRagFilter(e);
}
window.toggleRagFilterMenu=toggleRagFilterMenu;
window.setRagFilter=setRagFilter;
window.setRagFilterKey=setRagFilterKey;
window.clearRagFilter=clearRagFilter;
window.selectAllRagFilters=selectAllRagFilters;

// ── ZOOM ─────────────────────────────────────────────────────
function setZoom(z){
  if(!z) return;
  zoom=z;
  colW={day:44,week:28,month:14,quarter:7,year:4}[z]||28;
  zoomFitActive=false;
  const sw=document.getElementById('switchZoomFit');
  if(sw) sw.checked=false;
  const sel=document.getElementById('zoomToSelect');
  if(sel) sel.value=z;
  renderAll();
}
function zoomToFit(){
  const {start,end}=getRange();
  const totalDays=Math.max(1,daysBetween(start,end)+1);
  const wrap=document.getElementById('tlWrap');
  if(!wrap) return;
  const avail=Math.max(200,wrap.clientWidth-24);
  const ideal=Math.max(3,Math.min(44,Math.floor(avail/totalDays)));
  colW=ideal;
  renderAll();
  wrap.scrollLeft=0;
}

// ── VIEW (Gantt / List are independent toggles) ──────────────
function syncViewButtons(){
    const gBtn=document.getElementById('viewGanttBtn');
    const lBtn=document.getElementById('viewListBtn');
  if(gBtn){
    gBtn.classList.toggle('on',viewShowGantt);
    gBtn.setAttribute('aria-pressed',viewShowGantt?'true':'false');
  }
  if(lBtn){
    lBtn.classList.toggle('on',viewShowList);
    lBtn.setAttribute('aria-pressed',viewShowList?'true':'false');
  }
}

function applyViewPanes(){
  syncViewButtons();
    const gv=document.getElementById('ganttView');
    const lv=document.getElementById('listView');
  const taskPanel=document.getElementById('taskPanel');
  const splitter=document.getElementById('panelSplitter');

  // List only — dedicated full list page
  if(viewShowList&&!viewShowGantt){
    mainView='list';
    if(gv){ gv.hidden=true; gv.style.display='none'; gv.classList.remove('timeline-only','list-only-panel'); }
      if(lv){ lv.hidden=false; lv.style.display='block'; }
      renderListView();
    updateCpBanner();
      return;
    }

  // Chart container (timeline ± left list panel)
  mainView='gantt';
    if(lv){ lv.hidden=true; lv.style.display='none'; }
  if(gv){
    gv.hidden=false;
    gv.style.display='flex';
    gv.classList.toggle('timeline-only',viewShowGantt&&!viewShowList);
    gv.classList.remove('list-only-panel');
  }
  if(taskPanel){
    taskPanel.hidden=!viewShowList;
    taskPanel.style.display=viewShowList?'':'none';
  }
  if(splitter){
    splitter.hidden=!viewShowList;
    splitter.style.display=viewShowList?'':'none';
  }
    renderAll();
}

/** Click Gantt or List to toggle that pane on/off (at least one stays on). */
function toggleViewPane(which){
  try{
    if(which==='list'){
      if(viewShowList&&!viewShowGantt){
        showToast('Turn on Gantt to hide the list','info',1800);
        return;
      }
      viewShowList=!viewShowList;
    } else if(which==='gantt'){
      if(viewShowGantt&&!viewShowList){
        showToast('Turn on List to hide the chart','info',1800);
        return;
      }
      viewShowGantt=!viewShowGantt;
    } else return;

    const label=
      viewShowList&&viewShowGantt?'Both panes':
      viewShowGantt?'Gantt chart only':'List only';
    applyViewPanes();
    showToast(label,'ok',1400);
  }catch(err){
    console.error('toggleViewPane failed',err);
  }
}

/** Legacy single-mode API (keeps older callers working). */
function setView(v,el){
  try{
    if(v==='list'){
      viewShowList=true;
      viewShowGantt=false;
    } else if(v==='gantt'||v==='both'||v==='combined'){
      viewShowList=true;
      viewShowGantt=true;
    } else if(v==='timeline'||v==='chart'){
      viewShowList=false;
      viewShowGantt=true;
    } else return;
    applyViewPanes();
  }catch(err){
    console.error('setView failed',err);
  }
}
window.toggleViewPane=toggleViewPane;
window.setView=setView;

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════
function captureGanttScroll(){
  const ts=document.getElementById('taskScroll');
  const tw=document.getElementById('tlWrap');
  const gx=document.getElementById('tpGridX');
  return {
    top:ts?ts.scrollTop:0,
    left:tw?tw.scrollLeft:0,
    gridLeft:gx?gx.scrollLeft:0,
  };
}
function restoreGanttScroll(s){
  if(!s) return;
  const ts=document.getElementById('taskScroll');
  const tw=document.getElementById('tlWrap');
  const gx=document.getElementById('tpGridX');
  const th=document.getElementById('tlHeader');
  if(ts) ts.scrollTop=s.top;
  if(tw){ tw.scrollTop=s.top; tw.scrollLeft=s.left; }
  if(gx) gx.scrollLeft=s.gridLeft;
  if(th&&tw) th.style.transform='translateX('+(-tw.scrollLeft)+'px)';
}
function focusNoScroll(el,doSelect){
  if(!el) return;
  try{ el.focus({preventScroll:true}); }
  catch(e){ try{ el.focus(); }catch(e2){} }
  if(doSelect&&typeof el.select==='function'){
    try{ el.select(); }catch(e){}
  }
}
function renderAll(){
  ensureTaskIndex();
  calcWBS();
  // Drop illegal folder/project predecessors (mouse used to allow these)
  tasks.forEach(t=>{
    if(!t.predId) return;
    if(!canHavePredecessor(t)){
      t.predId=null; t.depType='FS';
      return;
    }
    const p=getTaskById(t.predId);
    if(!p||!canBePredecessor(p)){ t.predId=null; t.depType='FS'; }
  });
  computeCriticalPath();
  if(mainView==='list'){
    renderListView();
    updateCpBanner();
    return;
  }
  const gv=document.getElementById('ganttView');
  const lv=document.getElementById('listView');
  if(gv){ gv.hidden=false; gv.style.display='flex'; }
  if(lv){ lv.hidden=true; lv.style.display='none'; }
  const ts=document.getElementById('taskScroll');
  const tw=document.getElementById('tlWrap');
  if(!ts||!tw){ updateCpBanner(); return; }
  const snap=captureGanttScroll();
  const {start,end}=getRange();
  const totalDays=daysBetween(start,end);
  const totalW=totalDays*colW;
  renderTaskPanel();
  renderCustomHeaders();
  renderTimeline(start,end,totalW);
  positionTodayLine(start);
  syncHeaderHeights();
  if(selectedTaskId!=null) selectTask(selectedTaskId);
  restoreGanttScroll(snap);
  if(!scrollSyncing){
    scrollSyncing=true;
    requestAnimationFrame(()=>{
      restoreGanttScroll(snap);
      requestAnimationFrame(()=>{
        restoreGanttScroll(snap);
        scrollSyncing=false;
      });
    });
  }
  updateCpBanner();
  flushPendingCellEdit();
  // Focusing an input must not jump the timeline/panel
  restoreGanttScroll(snap);
  requestAnimationFrame(()=>restoreGanttScroll(snap));
}

/** Soft UI update after linking/unlinking deps — no full chart rebuild (avoids flash / “reload”). */
function softRefreshAfterDepChange(focusId){
  const snap=captureGanttScroll();
  computeCriticalPath();
  const updatePredCell=(id)=>{
    const t=tasks.find(x=>x.id===id);
    if(!t) return;
    const predTxt=formatPred(t);
    const cell=document.querySelector('#tr-'+id+' .pred-val');
    if(cell) cell.textContent=predTxt;
    const listPred=document.querySelector('.list-tr[data-id="'+id+'"] [data-field="pred"]');
    if(listPred) listPred.textContent=predTxt;
  };
  if(focusId!=null) updatePredCell(focusId);
  else tasks.forEach(t=>updatePredCell(t.id));

  const visible=getVisible();
  visible.forEach(t=>{
    const hasKids=getChildren(t.id).length>0;
    const isCrit=showCP&&criticalIds.has(t.id);
    const bar=document.getElementById('bar-'+t.id);
    if(bar) bar.className='gantt-bar '+getTaskBarClass(t,hasKids,isCrit);
    const ms=document.querySelector('.milestone-diamond[data-id="'+t.id+'"]');
    if(ms) ms.classList.toggle('critical',isCrit);
    const row=document.getElementById('tr-'+t.id);
    if(row) row.classList.toggle('critical',isCrit);
    const gr=document.getElementById('gr-'+t.id);
    if(gr) gr.classList.toggle('critical',isCrit);
  });
  const {start}=getRange();
  renderDeps(visible,start);
  updateCpBanner();
  if(focusId!=null) selectTask(focusId);
  restoreGanttScroll(snap);
}

// ── TASK PANEL ───────────────────────────────────────────────
function renderTaskPanel(){
  const scroll=document.getElementById('taskScroll');
  if(!scroll) return;
  const visible=getVisible();
  if(!visible.length){
    const hasFilters=!!(
      hasLevelFilter()||
      hasOwnerFilter()||
      hasRagFilter()||
      ((document.getElementById('f-search')?.value||'').trim())
    );
    const msg=tasks.length
      ?(hasFilters
        ?'No rows match the current filters. Clear type / owner / RAG / search to see items.'
        :'All rows are collapsed. Expand folders or turn off “Collapse all rows”.')
      :'No work items yet. Hover the + below to add a row.';
    scroll.innerHTML='<div class="gantt-empty">'+esc(msg)+'</div>'+
      '<div class="row-insert-gap is-empty"><button type="button" class="row-insert-btn" onclick="event.stopPropagation();addNewItem()" title="Add a new item" aria-label="Add row">+</button></div>';
  } else {
  scroll.innerHTML=visible.map((t,i)=>buildTaskRowHTML(t,i)+buildRowInsertBetween(t.id)).join('');
    bindCustomCellClicks();
  bindRowInsertClicks(scroll);
  }
  if(selectedTaskId!=null){
    const r=document.getElementById('tr-'+selectedTaskId);
    if(r) r.classList.add('selected');
  }
  // Grow if columns overflow; shrink if panel is wider than columns (e.g. after delete)
  syncTaskPanelToContent(false);
  applyFieldVisibility();
  flushPendingCellEdit();
  updateSelectionBar();
}

function getDepth(t){
  let d=0,cur=t;
  const seen=new Set();
  const filteringTypes=hasLevelFilter();
  while(cur.parent!==null){
    if(seen.has(cur.id)) break;
    seen.add(cur.id);
    const p=tasks.find(x=>x.id===cur.parent);
    if(!p||p.id===cur.id) break;
    // When type filter is on, only count ancestors that are also visible in the filter
    // so indent doesn't leave huge gaps for hidden parents
    if(!filteringTypes||levelFilterTypes.has(Number(p.type))) d++;
    cur=p;
    if(d>20) break;
  }
  return d;
}

// Build inline-editable task row HTML
function buildTaskRowHTML(t,index){
  const depth=getDepth(t);
  const indentPx=depth*18;
  const hasKids=tasks.some(c=>c.parent===t.id);
  const isCollapsed=collapsed[t.id];
  const progC=t.prog>=70?'#059669':t.prog>=40?'#d97706':'#dc2626';
  const ragC=RAG_COL[t.rag]||'#94a3b8';
  const isCrit=showCP&&criticalIds.has(t.id);
  const oddClass=((index||0)%2===0)?' is-odd':'';
  const customCells=customCols.map(col=>{
    const raw=t.customData?.[col.id];
    let display='—';
    if(col.type==='checkbox'){
      display=(raw==='1'||raw===true||raw==='true'||raw==='yes')?'✓':'';
    } else if(raw!=null&&String(raw).trim()!==''){
      display=String(raw);
    }
    const w=getColumnWidth('custom:'+col.id);
    const hidden=isFieldVisible('custom:'+col.id)?'':' is-field-hidden';
    return '<div class="task-custom-col ie-cell'+hidden+'" data-ie-field="custom:'+col.id+'" data-col="'+col.id+'" style="width:'+w+'px;min-width:'+w+'px;max-width:'+w+'px;" data-id="'+t.id+'" title="Click to edit · Tab to next">'+esc(display||'—')+'</div>';
  }).join('');
  const typeName=typeLabel(t);
  const typeColor=typeColorOf(t);
  const typeHint=hasKids?'Folder · dates roll up from children · drag bar to move group':'Click to change type';
  const isChecked=checkedRowIds.has(t.id);
  const canCheck=!(t.type===1||t.id===1);
  return '<div class="task-row'+oddClass+(isCrit?' critical':'')+(hasKids?' is-folder':'')+(isChecked?' is-checked':'')+'" data-id="'+t.id+'" data-level="'+effectiveType(t)+'" id="tr-'+t.id+'" onclick="selectTask('+t.id+')">'+
    '<div class="task-sel-col" onclick="event.stopPropagation()">'+
      (canCheck
        ?'<input type="checkbox" class="task-sel-cb" '+(isChecked?'checked ':'')+'onclick="event.stopPropagation();toggleRowCheck('+t.id+',this.checked)" aria-label="Select row">'
        :'<span class="task-sel-spacer" aria-hidden="true"></span>')+
    '</div>'+
    '<div class="task-wbs" title="'+esc(typeName)+'">'+esc(t.wbs||'')+'</div>'+
    '<div class="task-name-col">'+
      '<div class="task-indent" style="width:'+indentPx+'px;"></div>'+
      '<div class="task-toggle '+(hasKids?(isCollapsed?'collapsed':'expanded'):'leaf')+'" onclick="event.stopPropagation();toggleCollapse('+t.id+')"></div>'+
      '<div class="task-name ie-cell" data-ie-field="name" data-level="'+effectiveType(t)+'" id="tn-'+t.id+'" onclick="event.stopPropagation();beginCellEdit('+t.id+',\'name\')" title="Click to edit · Tab to next">'+esc(t.name)+'</div>'+
    '</div>'+
    '<div class="task-type-col ie-cell" data-ie-field="type" onclick="event.stopPropagation();beginCellEdit('+t.id+',\'type\')" title="'+esc(typeHint)+'">'+
      '<span class="task-type-badge" style="background:'+typeColor+'22;color:'+typeColor+';">'+esc(typeName)+(hasKids?' · folder':'')+'</span>'+
    '</div>'+
    '<div class="task-owner-col ie-cell" data-ie-field="owner" onclick="event.stopPropagation();beginCellEdit('+t.id+',\'owner\')" title="Click to change owner · Tab to next">'+
      '<div class="av" style="background:'+avC(t.owner)+';">'+avInits(t.owner)+'</div>'+
    '</div>'+
    '<div class="task-date-col ie-cell" data-ie-field="start" onclick="event.stopPropagation();beginCellEdit('+t.id+',\'start\')" title="Click to edit start · Tab to next">'+
      '<span class="date-val">'+((getChildren(t.id).length?getEffectiveDates(t).start:t.start))+'</span>'+
    '</div>'+
    '<div class="task-date-col ie-cell" data-ie-field="end" onclick="event.stopPropagation();beginCellEdit('+t.id+',\'end\')" title="Click to edit end · Tab to next">'+
      '<span class="date-val">'+((getChildren(t.id).length?getEffectiveDates(t).end:t.end))+'</span>'+
    '</div>'+
    '<div class="task-dur-col ie-cell" data-ie-field="duration" onclick="event.stopPropagation();beginCellEdit('+t.id+',\'duration\')" title="Click to edit duration · Tab to next">'+
      '<span class="dur-val">'+formatDuration(t)+'</span>'+
    '</div>'+
    '<div class="task-pred-col ie-cell" data-ie-field="pred" onclick="event.stopPropagation();beginCellEdit('+t.id+',\'pred\')" title="Click to set predecessor · Tab to next">'+
      '<span class="pred-val">'+esc(formatPred(t))+'</span>'+
    '</div>'+
    '<div class="task-prog-col ie-cell ie-prog-cell" data-ie-field="prog" title="Drag the bar to set % · Click the number to type">'+
      '<div class="prog-track" data-prog-drag="'+t.id+'" onpointerdown="event.stopPropagation();startProgBarDrag(event,'+t.id+')">'+
        '<div class="prog-fill" style="width:'+(Number(t.prog)||0)+'%;background:'+progC+';"></div>'+
      '</div>'+
      '<button type="button" class="prog-pct" onclick="event.stopPropagation();beginCellEdit('+t.id+',\'prog\')">'+(Number(t.prog)||0)+'%</button>'+
    '</div>'+
    buildRagPillCell(t,t.id,'bgt')+
    buildRagPillCell(t,t.id,'sch')+
    buildRagPillCell(t,t.id,'scp')+
    customCells+
    '<div class="task-row-add-col" aria-hidden="true"></div>'+
    '<div class="grid-filler"></div>'+
  '</div>';
}

/** Between-row insert band (sibling — next row cannot steal clicks). */
function buildRowInsertBetween(afterId){
  return '<div class="row-insert-between" data-after-id="'+afterId+'">'+
    '<div class="row-insert-hit">'+
      '<button type="button" class="row-insert-btn" data-insert-after="'+afterId+'" title="Insert row below" aria-label="Insert row">+</button>'+
    '</div>'+
  '</div>';
}

function bindRowInsertClicks(scroll){
  if(!scroll||scroll._rowInsertBound) return;
  scroll._rowInsertBound=true;
  scroll.addEventListener('pointerdown',function(e){
    const btn=e.target&&e.target.closest?e.target.closest('[data-insert-after]'):null;
    if(!btn||!scroll.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    const id=Number(btn.getAttribute('data-insert-after'));
    if(Number.isFinite(id)) insertRowAfter(id);
  },true);
}

/** Insert a new sibling row after the given task (same parent). */
function insertRowAfter(afterId){
  const after=tasks.find(x=>x.id===Number(afterId));
  if(!after){ addNewItem(); return; }
  quickAddTask(after.parent, after.id);
}
window.insertRowAfter=insertRowAfter;

function editName(id){ beginCellEdit(id,'name'); }
function saveName(id,el){ /* legacy no-op — handled by beginCellEdit */ }
function nameKey(e,id,el){ /* legacy no-op */ }
function selectTask(id){
  selectedTaskId=id;
  document.querySelectorAll('.task-row').forEach(r=>r.classList.remove('selected'));
  document.querySelectorAll('.tl-grid-row').forEach(r=>r.classList.remove('selected'));
  document.querySelectorAll('.list-tr').forEach(r=>r.classList.remove('selected'));
  const r=document.getElementById('tr-'+id);
  if(r) r.classList.add('selected');
  const gr=document.getElementById('gr-'+id);
  if(gr) gr.classList.add('selected');
  const lr=document.querySelector('.list-tr[data-id="'+id+'"]');
  if(lr) lr.classList.add('selected');
}
function getSelectedTask(){
  return selectedTaskId?tasks.find(t=>t.id===selectedTaskId)||null:null;
}
function toggleCollapse(id){
  if(collapsed[id]) collapsed[id]=false;
  else collapsed[id]=true;
  refreshVisibleStructure();
}
function collapseSubtree(id){
  const kids=tasks.filter(c=>c.parent===id);
  if(!kids.length) return false;
  // Collapse this folder — hides all descendants via ancestor check in getVisible()
  collapsed[id]=true;
  // Also collapse every nested folder so re-expanding this node keeps subfolders collapsed
  kids.forEach(c=>{
    if(tasks.some(x=>x.parent===c.id)) collapseSubtree(c.id);
  });
  return true;
}
function expandSubtree(id){
  delete collapsed[id];
  tasks.filter(c=>c.parent===id).forEach(c=>expandSubtree(c.id));
}
/**
 * Toolbar Collapse:
 * - Selected folder (row with children) → collapse that folder + all nested folders
 * - No selection → collapse entire structure
 * @param {boolean} [forceAll] when true (bottom switch), always collapse everything
 */
function collapseAll(forceAll){
    const selected=!forceAll?getSelectedTask():null;
    if(selected){
      const hasKids=tasks.some(c=>c.parent===selected.id);
      if(!hasKids){
        showToast('Select a folder (row with children), or clear selection to collapse all','info',2800);
        return;
      }
      collapseSubtree(selected.id);
      selectTask(selected.id);
      showToast('Collapsed "'+selected.name+'" and subfolders','ok',2000);
    } else {
      collapsed={};
    tasks.forEach(t=>{ if(getChildren(t.id).length) collapsed[t.id]=true; });
      const sw=document.getElementById('switchCollapse');
      if(sw) sw.checked=true;
      showToast('Collapsed all folders','ok',1800);
    }
  refreshVisibleStructure();
}
/**
 * Toolbar Expand:
 * - Selected folder → expand that folder + all nested folders
 * - No selection → expand entire structure
 */
function expandAll(forceAll){
    const selected=!forceAll?getSelectedTask():null;
    if(selected){
      expandSubtree(selected.id);
      selectTask(selected.id);
      showToast('Expanded "'+selected.name+'" and subfolders','ok',1800);
    } else {
      collapsed={};
      const sw=document.getElementById('switchCollapse');
      if(sw) sw.checked=false;
      showToast('Expanded all','ok',1600);
    }
  refreshVisibleStructure();
}
function indentTask(){
  const t=getSelectedTask();
  if(!t){ showToast('Select a row first, then Indent','info',2500); return; }
  if(t.type===1){ showToast('Cannot indent the project row','info',2200); return; }
  const visible=getVisible();
  const vIdx=visible.findIndex(x=>x.id===t.id);
  if(vIdx<=0){ showToast('Nothing above to nest under','info',2200); return; }
  // Nest under the nearest preceding visible row that is not a descendant of t
  let newParent=null;
  for(let i=vIdx-1;i>=0;i--){
    const cand=visible[i];
    // skip if cand is inside t's subtree
    let p=cand.parent,inside=false;
    while(p!==null){
      if(p===t.id){ inside=true; break; }
      const pt=tasks.find(x=>x.id===p);
      p=pt?pt.parent:null;
    }
    if(inside) continue;
    newParent=cand;
    break;
  }
  if(!newParent){ showToast('Nothing above to nest under','info',2200); return; }
  if(t.parent===newParent.id){ showToast('Already nested under "'+newParent.name+'"','info',2200); return; }
  pushHistory();
  t.parent=newParent.id;
  if(collapsed[newParent.id]) collapsed[newParent.id]=false;
  moveTaskAfterParent(t);
  const promoted=promoteToContainerIfNeeded(newParent);
  calcWBS();
  pushHistory(); // after-state so Redo works
  renderAll();
  selectTask(t.id);
  flashTaskRow(t.id);
  if(promoted){
    showToast('"'+newParent.name+'" is now a '+typeLabel(newParent)+' (folder)','ok',2800);
    if(!isUnsavedLocal(newParent)) void persistSave(newParent);
  } else {
  showToast('Indented under "'+newParent.name+'"','ok',2200);
  }
  void persistSave(t);
}
function outdentTask(){
  const t=getSelectedTask();
  if(!t){ showToast('Select a row first, then Outdent','info',2500); return; }
  if(t.parent===null){ showToast('Already at top level','info',2200); return; }
  const parent=tasks.find(x=>x.id===t.parent);
  if(!parent){ showToast('Already at top level','info',2200); return; }
  pushHistory();
  t.parent=parent.parent;
  moveTaskAfterParent(t);
  calcWBS();
  pushHistory();
  renderAll();
  selectTask(t.id);
  flashTaskRow(t.id);
  const under=t.parent===null?'top level':('"'+((tasks.find(x=>x.id===t.parent)||{}).name||'parent')+'"');
  showToast('Moved to '+under,'ok',2200);
  void persistSave(t);
}
function calcTaskGridContentWidth(){
  let w=36+36; // select-col + add-col
  BUILTIN_FIELDS.forEach(f=>{
    if(!isFieldVisible(f.id)) return;
    w+=getColumnWidth(f.id);
  });
  (customCols||[]).forEach(c=>{
    if(!isFieldVisible('custom:'+c.id)) return;
    w+=getColumnWidth('custom:'+c.id);
  });
  return Math.ceil(w);
}
function measureTaskGridContentWidth(){
  // Do NOT use header/row scrollWidth — they stretch to the panel (min-width:100% + grid-filler)
  // and keep a stale wide size after columns are deleted.
  return calcTaskGridContentWidth();
}
function clampTaskPanelWidth(px){
  const vw=window.innerWidth||1200;
  const minW=280;
  const contentW=Math.max(minW, calcTaskGridContentWidth());
  // Fit all columns; only shrink if the window is too narrow for a usable Gantt
  const maxW=Math.max(minW, Math.min(contentW, vw-280));
  const n=Number(px);
  if(!Number.isFinite(n)) return maxW;
  return Math.max(minW, Math.min(maxW, Math.round(n)));
}
function applyTaskPanelWidth(px){
  const contentW=calcTaskGridContentWidth();
  const w=clampTaskPanelWidth(px);
  document.documentElement.style.setProperty('--task-col',w+'px');
  const grid=document.querySelector('.tp-grid-x');
  if(grid){
    grid.classList.toggle('is-cols-fit',w>=contentW-2);
  }
  return w;
}
/** Resize left panel to match current columns (grow on add, shrink on delete). */
function syncTaskPanelToContent(force){
  const contentW=calcTaskGridContentWidth();
  const cur=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--task-col'),10)||0;
  let next=cur;
  if(force||!cur){
    next=contentW;
  } else if(cur<contentW-4){
    // Too narrow — expand so all columns show
    next=contentW;
  } else if(cur>contentW+4){
    // Too wide (stale after deleting columns) — shrink to fit
    next=contentW;
  }
  const applied=applyTaskPanelWidth(next);
  if(force||applied!==cur){
    try{ localStorage.setItem('gantt-task-col-width',String(applied)); }catch(e){}
  }
  const grid=document.querySelector('.tp-grid-x');
  if(grid){
    grid.classList.toggle('is-cols-fit',applied>=contentW-2);
    grid.style.overflowX='';
  }
}
function setupPanelSplitter(){
  if(splitterBound) return;
  // Always start from real column sum (ignore stale wide localStorage after column deletes)
  const contentW=calcTaskGridContentWidth();
  applyTaskPanelWidth(contentW);
  try{ localStorage.setItem('gantt-task-col-width',String(clampTaskPanelWidth(contentW))); }catch(e){}
  const splitter=document.getElementById('panelSplitter');
  if(!splitter) return;
  splitterBound=true;
  splitter.addEventListener('mousedown',e=>{
    e.preventDefault();
    const startX=e.clientX;
    const panel=document.getElementById('taskPanel');
    const startW=panel?panel.offsetWidth:contentW;
    splitter.classList.add('dragging');
    const move=e2=>{
      applyTaskPanelWidth(startW+(e2.clientX-startX));
    };
    const up=()=>{
      document.removeEventListener('mousemove',move);
      document.removeEventListener('mouseup',up);
      splitter.classList.remove('dragging');
      const val=getComputedStyle(document.documentElement).getPropertyValue('--task-col').trim();
      const w=clampTaskPanelWidth(parseInt(val,10)||calcTaskGridContentWidth());
      localStorage.setItem('gantt-task-col-width',String(w));
    };
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseup',up);
  });
  window.addEventListener('resize',()=>{
    syncTaskPanelToContent(true);
  });
}
function setupScrollSync(){
  if(scrollSyncBound) return;
  const ts=document.getElementById('taskScroll');
  const tw=document.getElementById('tlWrap');
  const th=document.getElementById('tlHeader');
  if(!ts||!tw) return;
  scrollSyncBound=true;
  const syncHeaderX=()=>{
    if(th) th.style.transform='translateX('+(-tw.scrollLeft)+'px)';
  };
  ts.addEventListener('scroll',()=>{
    if(scrollSyncing) return;
    scrollSyncing=true;
    tw.scrollTop=ts.scrollTop;
    requestAnimationFrame(()=>{scrollSyncing=false;});
  });
  tw.addEventListener('scroll',()=>{
    if(scrollSyncing) return;
    scrollSyncing=true;
    ts.scrollTop=tw.scrollTop;
    syncHeaderX();
    requestAnimationFrame(()=>{scrollSyncing=false;});
  });
  syncHeaderX();
}
function syncHeaderHeights(){
  const tlh=document.getElementById('tlHeader');
  const tph=document.querySelector('.tp-header');
  if(!tlh||!tph) return;
  // Match list header to timeline scale header so row 0 lines up
  tph.style.height='';
  tph.style.minHeight='';
  const h=Math.max(tlh.offsetHeight, tph.offsetHeight, 48);
  if(h>0){
    tph.style.height=h+'px';
    tph.style.minHeight=h+'px';
    tph.style.maxHeight=h+'px';
    const wrap=document.getElementById('tlHeaderWrap');
    if(wrap){
      wrap.style.height=h+'px';
      wrap.style.minHeight=h+'px';
    }
  }
}

// ── TIMELINE ─────────────────────────────────────────────────
function buildTimelineHeader(start,end,totalW){
  const totalDays=daysBetween(start,end);
  const days=[];
  for(let i=0;i<totalDays;i++) days.push(addDays(start,i));
  const today=new Date();today.setHours(0,0,0,0);

  let html='';
  if(zoom==='quarter'||zoom==='month'||zoom==='year'){
    let yHTML='<div class="tl-years">';
    let curY='',yDays=0;
    days.forEach(dt=>{
      const y=String(dt.getFullYear());
      if(y!==curY){
        if(curY) yHTML+='<div class="tl-year-cell" style="width:'+yDays*colW+'px;">'+curY+'</div>';
        curY=y;yDays=1;
      } else yDays++;
    });
    if(curY) yHTML+='<div class="tl-year-cell" style="width:'+yDays*colW+'px;">'+curY+'</div>';
    yHTML+='</div>';
    html+=yHTML;
  }

  if(zoom==='quarter'){
    let qHTML='<div class="tl-quarters">';
    let curQ='',qDays=0;
    days.forEach(dt=>{
      const q='Q'+Math.floor(dt.getMonth()/3+1)+' '+dt.getFullYear();
      if(q!==curQ){
        if(curQ) qHTML+='<div class="tl-quarter-cell" style="width:'+qDays*colW+'px;">'+curQ+'</div>';
        curQ=q;qDays=1;
      } else qDays++;
    });
    if(curQ) qHTML+='<div class="tl-quarter-cell" style="width:'+qDays*colW+'px;">'+curQ+'</div>';
    qHTML+='</div>';
    html+=qHTML;
  }

  let mHTML='<div class="tl-months">';
  let curM='',mDays=0;
  days.forEach(dt=>{
    const m=dt.toLocaleDateString('en-GB',{month:'short',year:'numeric'});
    if(m!==curM){
      if(curM) mHTML+='<div class="tl-month-cell" style="width:'+mDays*colW+'px;">'+curM+'</div>';
      curM=m;mDays=1;
    } else mDays++;
  });
  if(curM) mHTML+='<div class="tl-month-cell" style="width:'+mDays*colW+'px;">'+curM+'</div>';
  mHTML+='</div>';
  html+=mHTML;

  if(zoom==='week'||zoom==='month'){
    let wHTML='<div class="tl-weeks">';
    let wStart=null,wDays=0;
    days.forEach((dt,i)=>{
      const isMon=dt.getDay()===1||i===0;
      if(isMon&&wStart!==null){
        wHTML+='<div class="tl-week-cell" style="width:'+wDays*colW+'px;">'+fmtShort(wStart)+' – '+fmtShort(addDays(wStart,wDays-1))+'</div>';
        wDays=0;
      }
      if(wDays===0) wStart=dt;
      wDays++;
    });
    if(wDays>0&&wStart) wHTML+='<div class="tl-week-cell" style="width:'+wDays*colW+'px;">'+fmtShort(wStart)+' – '+fmtShort(addDays(wStart,wDays-1))+'</div>';
    wHTML+='</div>';
    html+=wHTML;
  }

  let dHTML='<div class="tl-days">';
  days.forEach(dt=>{
    const isWE=dt.getDay()===0||dt.getDay()===6;
    const isT=dt.getTime()===today.getTime();
    let lbl='';
    if(zoom==='day') lbl=dt.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit'});
    else if(zoom==='week') lbl=dt.toLocaleDateString('en-GB',{weekday:'short'}).toUpperCase().slice(0,3);
    else if(zoom==='month'&&dt.getDate()%5===0) lbl=String(dt.getDate());
    else if(zoom==='quarter'&&dt.getDate()===1) lbl=dt.toLocaleDateString('en-GB',{month:'short'});
  dHTML+='<div class="tl-day-cell '+(isWE?'weekend':'')+' '+(isT?'today-col':'')+'" style="width:'+colW+'px;">'+lbl+'</div>';
  });
  dHTML+='</div>';
  html+=dHTML;
  return html;
}

function buildTimelineStripeBg(rangeStart){
  // Repeating 7-day weekend pattern — O(1) vs O(days) gradient stops
  const startDow=rangeStart.getDay();
  const parts=[];
  for(let d=0;d<7;d++){
    const dow=(startDow+d)%7;
    const isWE=dow===0||dow===6;
    const color=isWE?'var(--dhx-weekend)':'transparent';
    parts.push(color+' '+(d*colW)+'px, '+color+' '+((d+1)*colW)+'px');
  }
  return 'repeating-linear-gradient(to right, '+parts.join(', ')+')';
}

function renderTimeline(start,end,totalW){
  const header=document.getElementById('tlHeader');
  const rows=document.getElementById('tlRows');
  const barsLayer=document.getElementById('tlBars')||rows;
  if(!header||!rows) return;
  const totalDays=daysBetween(start,end);

  header.innerHTML=buildTimelineHeader(start,end,totalW);
  header.style.width=totalW+'px';

  const visible=getVisible();
  const stripeBg=buildTimelineStripeBg(start);
  let rHTML='';
  for(let i=0;i<visible.length;i++){
    const t=visible[i];
    rHTML+='<div class="tl-grid-row" id="gr-'+t.id+'" data-level="'+t.type+'" data-task-id="'+t.id+'" style="width:'+totalW+'px;height:'+ROW_H+'px;min-height:'+ROW_H+'px;max-height:'+ROW_H+'px;" title="Click empty area to add a task on that date"></div>';
  }
  rows.innerHTML=rHTML;
  if(barsLayer&&barsLayer!==rows) barsLayer.innerHTML='';

  Object.keys(barPos).forEach(k=>delete barPos[k]);

  // Draw bars at deterministic Y = index * ROW_H (avoids offsetTop drift after undo/create)
  void rows.offsetHeight;
  visible.forEach((t,i)=>{ drawTaskBar(t,start,barsLayer,i*ROW_H); });
    const totalH=visible.length*ROW_H;
  const tlInner=document.getElementById('tlInner');
  if(tlInner){
    tlInner.style.width=totalW+'px';
    tlInner.style.minHeight=totalH+'px';
    tlInner.style.backgroundImage=stripeBg;
    tlInner.style.backgroundRepeat='repeat';
    tlInner.style.backgroundSize=(7*colW)+'px 100%';
  }
  if(barsLayer){
    barsLayer.style.width=totalW+'px';
    barsLayer.style.height=totalH+'px';
  }
  const depSvg=document.getElementById('depSvg');
  if(depSvg){
    depSvg.setAttribute('width',totalW);
    depSvg.setAttribute('height',totalH+'px');
  }
    renderDeps(visible,start);
    syncHeaderHeights();
    const tw=document.getElementById('tlWrap');
    const th=document.getElementById('tlHeader');
    if(tw&&th) th.style.transform='translateX('+(-tw.scrollLeft)+'px)';
    bindTimelineClicks(start);
}

function drawTaskBar(t,rangeStart,rows,rowTop){
  const row=document.getElementById('gr-'+t.id);
  if(!row) return;
  // Prefer deterministic Y from caller; never trust offsetTop after DOM mutations
  if(rowTop==null||!Number.isFinite(rowTop)) rowTop=row.offsetTop||0;
  const hasKids=getChildren(t.id).length>0;
  const eff=getEffectiveDates(t);
  const isCrit=showCP&&criticalIds.has(t.id);

  if(t.type===6){
    const offsetDays=daysBetween(rangeStart,D(eff.start));
    const left=offsetDays*colW;
    const el=document.createElement('div');
    el.className='milestone-diamond'+(isCrit?' critical':'');
    el.dataset.id=String(t.id);
    const msTop=rowTop+(ROW_H-12)/2;
    el.style.cssText='left:'+(left-6)+'px;top:'+msTop+'px;width:12px;height:12px;';
    el.title=t.name+' · '+fmtDisp(D(eff.start))+(isCrit?' · Critical':'');
    el.onclick=(e)=>{ e.stopPropagation(); openEdit(t.id); };
    rows.appendChild(el);
    const msLbl=document.createElement('div');
    msLbl.className='bar-label-outside bar-label-milestone';
    msLbl.textContent=t.name;
    msLbl.style.cssText='left:'+(left+10)+'px;top:'+(rowTop+(ROW_H-14)/2)+'px;';
    rows.appendChild(msLbl);
    // Center of diamond — required for dependency routing
    registerBar(t.id,left-6,msTop,12,12);
  } else {
    const s=D(eff.start),e=D(eff.end);
    const left=daysBetween(rangeStart,s)*colW;
    const width=Math.max((taskDurationDays(eff.start,eff.end)+1)*colW,colW);
    const barH=Math.max(22,Math.round(ROW_H*0.7));
    const barTop=rowTop+(ROW_H-barH)/2;
    const el=document.createElement('div');
    el.className='gantt-bar '+getTaskBarClass(t,hasKids,isCrit);
    el.id='bar-'+t.id;
    el.style.cssText='left:'+left+'px;top:'+barTop+'px;width:'+width+'px;height:'+barH+'px;';
    const typeNm=typeLabel(t);
    el.title=hasKids
      ?(t.name+'\n'+fmtDisp(s)+' → '+fmtDisp(e)+'\n'+typeNm+' (folder) · Drag to move this group and all children')
      :(t.name+'\n'+fmtDisp(s)+' → '+fmtDisp(e)+'\n'+t.prog+'% · '+typeNm);
    const pf=document.createElement('div');
    pf.className='bar-prog-fill';
    pf.style.width=t.prog+'%';
    el.appendChild(pf);
    const labelFitsInside=width>=80;
    if(hasKids||labelFitsInside){
      const lbl=document.createElement('div');
      lbl.className='bar-label';
      lbl.textContent=t.name;
      el.appendChild(lbl);
    }
    const rl=document.createElement('div');rl.className='bar-resize-l';
    const rr=document.createElement('div');rr.className='bar-resize-r';
    if(!hasKids){ el.appendChild(rl); el.appendChild(rr); }
    if(!hasKids&&t.type!==1&&t.id!==1){
      const connL=document.createElement('div');
      connL.className='bar-dep-handle bar-dep-handle-l';
      connL.title='Drag from start → drop on another bar’s start (SS) or end (SF)';
      connL.setAttribute('aria-label','Link dependency from start');
      const connR=document.createElement('div');
      connR.className='bar-dep-handle bar-dep-handle-r';
      connR.title='Drag from end → drop on another bar’s start (FS) or end (FF)';
      connR.setAttribute('aria-label','Link dependency from end');
      el.appendChild(connL);el.appendChild(connR);
      connR.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();startConnectorDrag(t.id,'end',e);});
      connL.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();startConnectorDrag(t.id,'start',e);});
    }
    registerBar(t.id,left,barTop,width,barH);
    el.onclick=(e2)=>{
      e2.stopPropagation();
      if(e2.target.closest('.bar-dep-handle')) return;
      selectTask(t.id);
    };
    el.ondblclick=(e2)=>{e2.stopPropagation();if(!depLinkDragging)openEdit(t.id);};
    if(hasKids) setupSummaryMove(el,t,rangeStart);
    else setupDrag(el,t,rangeStart,rl,rr);
    rows.appendChild(el);
    if(!hasKids&&!labelFitsInside){
      const extLbl=document.createElement('div');
      extLbl.className='bar-label-outside';
      extLbl.textContent=t.name;
      extLbl.style.cssText='left:'+(left+width+6)+'px;top:'+(barTop+(barH-14)/2)+'px;';
      rows.appendChild(extLbl);
    }
  }
}

function bindTimelineClicks(rangeStart){
  document.querySelectorAll('.tl-grid-row').forEach(row=>{
    row.onclick=(e)=>{
      if(depDrawMode||e.target.closest('.gantt-bar')||e.target.closest('.milestone-diamond')||e.target.closest('.bar-label-outside')) return;
        e.stopPropagation();
      const rect=row.getBoundingClientRect();
      const x=e.clientX-rect.left;
      const dayIndex=Math.max(0,Math.floor(x/colW));
      const dateStr=fmt(addDays(rangeStart,dayIndex));
        const taskId=parseInt(row.dataset.taskId,10);
      const rowTask=getTaskById(taskId);
      addTaskOnTimeline(dateStr,rowTask||null);
      };
  });
}
function addTaskOnTimeline(dateStr,rowTask){
  pushHistory();
  const newTask={
    id:nextId++,name:'New task',type:5,owner:'',
    start:dateStr,end:fmt(addDays(D(dateStr),7)),
    prog:0,rag:'g',ragBgt:'g',ragSch:'g',ragScp:'g',notes:'',
    parent:rowTask?rowTask.id:null,
    predId:null,depType:'FS',
    color:LEVEL_COLORS[5],wbs:''
  };
  tasks.push(newTask);
  invalidateTaskIndex();
  if(rowTask&&promoteToContainerIfNeeded(rowTask)&&!isUnsavedLocal(rowTask)) void persistSave(rowTask);
  selectedTaskId=newTask.id;
  queueCellEdit(newTask.id,'name');
  renderAll();
  void persistCreate(newTask,{silent:true});
}

// ── DEPENDENCY ARROWS (DHTMLX / monday-style) ────────────────
/** Filled triangle: tip flush on bar edge, path stops at arrow base */
function appendDepArrow(svg,tipX,tipY,dirX,dirY,color,size){
  const len=Math.hypot(dirX,dirY)||1;
  const ux=dirX/len, uy=dirY/len;
  const s=Math.max(size||7, 6);
  const bx=tipX-ux*s, by=tipY-uy*s;
  const px=-uy, py=ux;
  const w=s*0.5;
  const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  poly.setAttribute('points',
    tipX.toFixed(1)+','+tipY.toFixed(1)+' '+
    (bx+px*w).toFixed(1)+','+(by+py*w).toFixed(1)+' '+
    (bx-px*w).toFixed(1)+','+(by-py*w).toFixed(1)
  );
  poly.setAttribute('fill',color);
  poly.setAttribute('stroke','none');
  poly.style.pointerEvents='none';
  svg.appendChild(poly);
  return {baseX:bx, baseY:by, size:s, ux, uy};
}

/**
 * DHTMLX-style orthogonal links (see reference):
 * - Solid thin grey stroke (not dashed)
 * - FS/SS tip on target LEFT; FF tip on target RIGHT
 * - Clear gap: right stub → vertical → into left
 * - Overlap: drop from pred end → left into succ start (no wrap past succ right)
 */
function renderDeps(visible,start){
  const svg=document.getElementById('depSvg');
  if(!svg) return;
  svg.innerHTML='';
  const stub=10;
  visible.forEach(t=>{
    if(!t.predId) return;
    if(!canHavePredecessor(t)) return;
    const fromT=getTaskById(t.predId)||tasks.find(x=>x.id===t.predId);
    if(!fromT||!canBePredecessor(fromT)) return;
    const fp=barPos[fromT.id];
    const tp=barPos[t.id];
    if(!fp||!tp) return;
    const raw=t.depType||'FS';
    const depType=raw==='EE'?'FF':raw;
    const isCrit=showCP&&criticalIds.has(t.id)&&criticalIds.has(fromT.id);
    const color=isCrit?'#e53935':'#78909c';
    const arrowSize=isCrit?8:7;
    const strokeW=isCrit?2:1.35;

    let x1,y1,tipX,tipY,dirX,dirY;
    if(depType==='SS'){
      x1=fp.left; y1=fp.midY;
      tipX=tp.left; tipY=tp.midY;
      dirX=1; dirY=0;
    } else if(depType==='FF'){
      x1=fp.left+fp.width; y1=fp.midY;
      tipX=tp.left+tp.width; tipY=tp.midY;
      dirX=-1; dirY=0;
      } else {
      // FS: leave RIGHT of pred → enter LEFT of succ
      x1=fp.left+fp.width; y1=fp.midY;
      tipX=tp.left; tipY=tp.midY;
      dirX=1; dirY=0;
    }

    const pathEndX=tipX-dirX*arrowSize;
    const pathEndY=tipY;
    let d,labelX,labelY;
    const sameRow=Math.abs(tipY-y1)<2;

    if(sameRow){
      d='M'+x1+','+y1+' H'+pathEndX;
      labelX=(x1+tipX)/2; labelY=y1-10;
    } else if(depType==='FF'){
      const elbowX=Math.max(x1,tipX)+stub;
      d='M'+x1.toFixed(1)+','+y1.toFixed(1)+
        ' H'+elbowX.toFixed(1)+
        ' V'+pathEndY.toFixed(1)+
        ' H'+pathEndX.toFixed(1);
      labelX=elbowX; labelY=(y1+tipY)/2;
    } else if(depType==='SS'){
      // Prefer short paths — never drag a long horizontal across empty chart to the left
      // and never run through the target bar at midY.
      const approachX=tipX-stub;
      if(tipX>=x1-stub){
        const elbowX=x1-stub;
        d='M'+x1.toFixed(1)+','+y1.toFixed(1)+
          ' H'+elbowX.toFixed(1)+
          ' V'+pathEndY.toFixed(1)+
          ' H'+pathEndX.toFixed(1);
        labelX=elbowX; labelY=(y1+tipY)/2;
    } else {
        const railY=y1+(tipY>y1?1:-1)*(ROW_H*0.5);
        d='M'+x1.toFixed(1)+','+y1.toFixed(1)+
          ' V'+railY.toFixed(1)+
          ' H'+approachX.toFixed(1)+
          ' V'+pathEndY.toFixed(1)+
          ' H'+pathEndX.toFixed(1);
        labelX=approachX; labelY=railY;
      }
    } else {
      // FS — leave pred RIGHT, enter succ LEFT. Final approach must be from the left
      // so the line never strikethroughs the target bar.
      const approachX=tipX-stub;
      if(tipX>=x1+stub*2){
        // Clear gap between bars: mid-lane drop
        const laneX=Math.max(x1+stub, Math.min((x1+tipX)/2, approachX));
        d='M'+x1.toFixed(1)+','+y1.toFixed(1)+
          ' H'+laneX.toFixed(1)+
          ' V'+pathEndY.toFixed(1)+
          ' H'+pathEndX.toFixed(1);
        labelX=laneX; labelY=(y1+tipY)/2;
      } else {
        // Overlap / succ under or left of pred end: stub → between-row rail → left of tip → in
        const exitX=x1+stub;
        const railY=y1+(tipY>y1?1:-1)*(ROW_H*0.5);
        d='M'+x1.toFixed(1)+','+y1.toFixed(1)+
          ' H'+exitX.toFixed(1)+
          ' V'+railY.toFixed(1)+
          ' H'+approachX.toFixed(1)+
          ' V'+pathEndY.toFixed(1)+
          ' H'+pathEndX.toFixed(1);
        labelX=approachX; labelY=railY;
      }
    }

    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',d);
    path.setAttribute('fill','none');
    path.setAttribute('stroke',color);
    path.setAttribute('stroke-width',String(strokeW));
    path.setAttribute('stroke-linejoin','round');
    path.setAttribute('stroke-linecap','butt');
    // Solid like DHTMLX reference — dashed looked unfinished
    path.style.pointerEvents='stroke';
    path.style.cursor='pointer';
    path.setAttribute('data-succ-id',String(t.id));
    path.onclick=()=>openEdit(t.id);
    path.ondblclick=(e)=>{
      e.stopPropagation();
      e.preventDefault();
      if(confirm('Remove this dependency link?')) removeDepLink(t.id);
    };
    path.setAttribute('title','Double-click to remove dependency');
    svg.appendChild(path);
    appendDepArrow(svg,tipX,tipY,dirX,dirY,color,arrowSize);

    if(depType!=='FS'){
      const tag=depType;
      const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
      bg.setAttribute('x',labelX-10); bg.setAttribute('y',labelY-7);
      bg.setAttribute('width',20); bg.setAttribute('height',14);
      bg.setAttribute('rx',3); bg.setAttribute('fill','var(--dhx-surface)');
      bg.setAttribute('stroke',color); bg.setAttribute('stroke-width','0.8');
      const lbl=document.createElementNS('http://www.w3.org/2000/svg','text');
      lbl.setAttribute('x',labelX); lbl.setAttribute('y',labelY+1);
      lbl.setAttribute('text-anchor','middle');
      lbl.setAttribute('dominant-baseline','middle');
      lbl.setAttribute('font-size','8');
      lbl.setAttribute('font-family','Inter,sans-serif');
      lbl.setAttribute('fill',color); lbl.setAttribute('font-weight','600');
      lbl.textContent=tag;
      svg.appendChild(bg); svg.appendChild(lbl);
    }
  });
}

// ── TODAY LINE ───────────────────────────────────────────────
function positionTodayLine(start){
  const today=new Date();today.setHours(0,0,0,0);
  const {start:rs}=getRange();
  const offset=daysBetween(rs,today);
  const left=offset*colW;
  const line=document.getElementById('todayLine');
  if(!line) return;
  if(offset>=0){line.style.left=left+'px';line.style.display='block';}
  else line.style.display='none';
}
function jumpToToday(){
  const wrap=document.getElementById('tlWrap');
  if(!wrap||mainView==='list'){
    showToast('Switch to Gantt view to jump to today','info',2200);
    return;
  }
  const {start}=getRange();
  const today=new Date();today.setHours(0,0,0,0);
  const offset=daysBetween(start,today);
  const left=Math.max(0,offset*colW-220);
  wrap.scrollLeft=left;
}

// ── DRAG & DROP ──────────────────────────────────────────────
/** Move a folder/summary bar — shifts the whole subtree by the same day delta. */
function setupSummaryMove(el,task,rangeStart){
  let startX=0,dragging=false,lastDelta=0;
  el.addEventListener('mousedown',e=>{
    if(depDrawMode) return;
    if(e.target.closest('.bar-dep-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    const subtree=getSubtreeTasks(task.id);
    const snaps=subtree.map(t=>({
      t,
      start:t.start,
      end:t.end,
      bar:document.getElementById('bar-'+t.id),
      diamond:document.querySelector('.milestone-diamond[data-id="'+t.id+'"]'),
      barLeft:0,
      diaLeft:0
    }));
    snaps.forEach(s=>{
      if(s.bar) s.barLeft=parseInt(s.bar.style.left)||0;
      if(s.diamond) s.diaLeft=parseInt(s.diamond.style.left)||0;
    });
    if(!dragging){ pushHistory(); dragging=true; }
    startX=e.clientX;
    lastDelta=0;
    const move=e2=>{
      const snap=Math.round((e2.clientX-startX)/colW)*colW;
      lastDelta=Math.round(snap/colW);
      snaps.forEach(s=>{
        if(s.bar) s.bar.style.left=(s.barLeft+snap)+'px';
        if(s.diamond) s.diamond.style.left=(s.diaLeft+snap)+'px';
        if(s.start) s.t.start=fmt(addDays(D(s.start),lastDelta));
        if(s.end) s.t.end=fmt(addDays(D(s.end),lastDelta));
        updateTaskDateCells(s.t.id,s.t.start,s.t.end);
      });
      const eff=getEffectiveDates(task);
      el.title=task.name+'\n'+fmtDisp(D(eff.start))+' → '+fmtDisp(D(eff.end))+'\n'+typeLabel(task)+' (folder) · Drag moves all children';
    };
    const up=()=>{
      document.removeEventListener('mousemove',move);
      document.removeEventListener('mouseup',up);
      dragging=false;
      if(!lastDelta){
        updateUndoRedoButtons();
        return;
      }
      rollupParentDates();
      if(autoSchedule) applyAutoSchedule();
      pushHistory();
      renderAll();
      selectTask(task.id);
      updateUndoRedoButtons();
      snaps.forEach(s=>{
        if(!isUnsavedLocal(s.t)) void persistSave(s.t);
      });
      if(autoSchedule) void persistScheduleChanges(task);
      showToast('Moved folder + '+Math.max(0,subtree.length-1)+' child item(s)','ok',2200);
    };
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseup',up);
  });
}
function setupDrag(el,task,rangeStart,rl,rr){
  let startX=0,origL=0,origW=0,mode=null,dragging=false;
  function applyDates(newL,newW){
    const dOffset=Math.round(newL/colW);
    const dur=Math.max(0,Math.round(newW/colW)-1);
    const ns=addDays(rangeStart,dOffset);
    const ne=addDays(ns,dur);
    task.start=fmt(ns);
    task.end=fmt(ne);
    updateTaskDateCells(task.id,task.start,task.end);
    el.title=task.name+'\n'+fmtDisp(ns)+' → '+fmtDisp(ne)+'\n'+task.prog+'% · '+typeLabel(task);
  }
  function down(e,m){
    if(depDrawMode) return;
    e.preventDefault();
    const startSnapshot=task.start;
    const endSnapshot=task.end;
    if(!dragging){ pushHistory(); dragging=true; }
    mode=m;startX=e.clientX;
    origL=parseInt(el.style.left)||0;
    origW=parseInt(el.style.width)||colW;
    const move=e2=>{
      const dx=e2.clientX-startX;
      const snap=Math.round(dx/colW)*colW;
      let newL=origL,newW=origW;
      if(mode==='move'){ newL=origL+snap; el.style.left=newL+'px'; }
      else if(mode==='r'){ newW=Math.max(colW,origW+snap); el.style.width=newW+'px'; }
      else if(mode==='l'){ newW=Math.max(colW,origW-snap); newL=origL+snap; el.style.width=newW+'px'; el.style.left=newL+'px'; }
      applyDates(newL,newW);
    };
    const up=()=>{
      document.removeEventListener('mousemove',move);
      document.removeEventListener('mouseup',up);
      dragging=false;
      const newL=parseInt(el.style.left)||0;
      const newW=parseInt(el.style.width)||colW;
      applyDates(newL,newW);
      const changed=task.start!==startSnapshot||task.end!==endSnapshot;
      if(!changed){
        updateUndoRedoButtons();
        return;
      }
      if(autoSchedule) applyAutoSchedule();
      pushHistory(); // record after-drag state so Redo works
      renderAll();
      selectTask(task.id);
      updateUndoRedoButtons();
      if(!isUnsavedLocal(task)){
        persistSave(task);
        if(autoSchedule) void persistScheduleChanges(task);
      }
    };
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseup',up);
  }
  el.addEventListener('mousedown',e=>{if(e.target===rl||e.target===rr)return;down(e,'move');});
  rl.addEventListener('mousedown',e=>{e.stopPropagation();down(e,'l');});
  rr.addEventListener('mousedown',e=>{e.stopPropagation();down(e,'r');});
}

// ── LIST VIEW ────────────────────────────────────────────────
function renderListView(){
  calcWBS();
  computeCriticalPath();
  const lv=document.getElementById('listView')||document.getElementById('ganttBody');
  if(!lv) return;
  const rows=getVisible().map(t=>{
    try{
      const progC=t.prog>=70?'#059669':t.prog>=40?'#d97706':'#dc2626';
      const rag=t.rag||'g';
      const ragLbl=rag==='r'?'Off Track':rag==='a'?'At Risk':'On Track';
      const isCrit=showCP&&criticalIds.has(t.id);
      return '<tr class="list-tr'+(isCrit?' critical':'')+'" data-id="'+t.id+'" onclick="selectTask('+t.id+')">'+
        '<td class="list-td mono">'+esc(t.wbs||'')+'</td>'+
        '<td class="list-td list-td-edit" data-field="name" data-id="'+t.id+'" title="Click to edit name">'+
          '<div class="list-name" style="padding-left:'+(getDepth(t)*18)+'px;">'+
            '<span class="list-type">'+(TYPE_ICONS[effectiveType(t)]||'☑')+'</span>'+
            '<span class="list-title'+(effectiveType(t)<=2?' bold':'')+'">'+esc(t.name)+'</span>'+
            '<span class="list-badge" style="background:'+typeColorOf(t)+'22;color:'+typeColorOf(t)+';">'+typeLabel(t)+(getChildren(t.id).length?' · folder':'')+'</span>'+
          '</div>'+
        '</td>'+
        '<td class="list-td list-td-edit" data-field="owner" data-id="'+t.id+'" title="Click to edit owner">'+esc(t.owner||'—')+'</td>'+
        '<td class="list-td mono list-td-edit" data-field="start" data-id="'+t.id+'" title="Click to edit start">'+esc(t.start)+'</td>'+
        '<td class="list-td mono list-td-edit" data-field="end" data-id="'+t.id+'" title="Click to edit end">'+esc(t.end)+'</td>'+
        '<td class="list-td list-td-edit" data-field="prog" data-id="'+t.id+'" title="Click to edit progress">'+
          '<div class="list-prog"><div class="prog-track"><div class="prog-fill" style="width:'+(t.prog||0)+'%;background:'+progC+';"></div></div><span>'+(t.prog||0)+'%</span></div>'+
        '</td>'+
        '<td class="list-td center list-td-edit" data-field="rag" data-id="'+t.id+'" title="Click to cycle RAG">'+
          '<span class="rag-pill rag-pill-'+rag+'"><span class="rag-pill-dot"></span><span class="rag-pill-lbl">'+ragLbl+'</span></span>'+
        '</td>'+
        '<td class="list-td center"><button type="button" class="btn btn-ghost list-edit-btn" data-id="'+t.id+'" title="Open full edit window">Edit</button></td>'+
      '</tr>';
    }catch(e){ return ''; }
  }).join('');
  const emptyMsg=tasks.length
    ? 'No rows match the current filters. Clear type / owner / RAG / search to see items.'
    : 'No tasks';
  lv.innerHTML='<div class="list-wrap">'+
    '<table class="list-table">'+
      '<thead><tr>'+
        '<th>WBS</th><th>Name</th><th>Owner</th><th>Start</th><th>End</th><th>Progress</th><th>RAG</th><th></th>'+
      '</tr></thead>'+
      '<tbody>'+(rows||'<tr><td colspan="8" class="list-empty">'+emptyMsg+'</td></tr>')+'</tbody>'+
    '</table>'+
  '</div>';
  bindListViewClicks(lv);
}
function bindListViewClicks(root){
  if(!root) return;
  if(root._listBound) return;
  root._listBound=true;
  root.addEventListener('click',e=>{
    const btn=e.target.closest('.list-edit-btn');
    if(btn){
      e.preventDefault();
      e.stopPropagation();
      openEdit(Number(btn.dataset.id));
      return;
    }
    const cell=e.target.closest('.list-td-edit');
    if(!cell||!root.contains(cell)||cell.classList.contains('editing')) return;
    e.preventDefault();
    e.stopPropagation();
    const id=Number(cell.dataset.id);
    const field=cell.dataset.field;
    if(!id||!field) return;
    selectTask(id);
    listBeginInlineEdit(id,field,cell);
  });
}
function listBeginInlineEdit(id,field,cell){
  const t=tasks.find(x=>x.id===id);
  if(!t||!cell||cell.classList.contains('editing')) return;
  cell.classList.add('editing');
  let done=false;
  const commitOnce=(fn)=>{
    if(done) return;
    done=true;
    cell.classList.remove('editing');
    try{ fn(); } finally { renderAll(); }
  };

  if(field==='name'){
    const inp=document.createElement('input');
    inp.type='text';
    inp.className='ie-input list-ie-input';
    inp.value=t.name||'';
    cell.innerHTML='';
    cell.appendChild(inp);
    inp.focus();
    inp.select();
    const save=()=>{
      const next=inp.value.trim()||t.name;
      commitOnce(()=>{
        if(next!==t.name){ pushHistory(); t.name=next; void persistSave(t); }
      });
    };
    inp.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ e.preventDefault(); inp.blur(); }
      if(e.key==='Escape'){ e.preventDefault(); done=true; cell.classList.remove('editing'); renderAll(); }
    });
    inp.addEventListener('blur',save);
    return;
  }

  if(field==='owner'){
    const sel=document.createElement('select');
    sel.className='ie-select list-ie-input';
    const choices=OWNERS.length?['',...OWNERS]:[''];
    choices.forEach(o=>{
      const opt=document.createElement('option');
      opt.value=o;
      opt.textContent=o||'— Unassigned';
      if((t.owner||'')===o) opt.selected=true;
      sel.appendChild(opt);
    });
    cell.innerHTML='';
    cell.appendChild(sel);
    sel.focus();
    const save=()=>{
      const next=sel.value;
      commitOnce(()=>{
        if(next!==(t.owner||'')){ pushHistory(); t.owner=next; void persistSave(t); }
      });
    };
    sel.addEventListener('change',save);
    sel.addEventListener('blur',save);
    return;
  }

  if(field==='start'||field==='end'){
    const inp=document.createElement('input');
    inp.type='date';
    inp.className='ie-input list-ie-input';
    inp.value=t[field]||'';
    cell.innerHTML='';
    cell.appendChild(inp);
    inp.focus();
    const save=()=>{
      const next=inp.value;
      commitOnce(()=>{
        if(!next||next===t[field]) return;
        pushHistory();
        t[field]=next;
        if(field==='start'&&D(t.end)<D(t.start)) t.end=t.start;
        if(field==='end'&&D(t.end)<D(t.start)) t.start=t.end;
        if(autoSchedule) applyAutoSchedule();
        void persistSave(t); if(autoSchedule) void persistScheduleChanges(t);
      });
    };
    inp.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ e.preventDefault(); inp.blur(); }
      if(e.key==='Escape'){ e.preventDefault(); done=true; cell.classList.remove('editing'); renderAll(); }
    });
    inp.addEventListener('change',save);
    inp.addEventListener('blur',save);
    return;
  }

  if(field==='prog'){
    const wrap=document.createElement('div');
    wrap.className='list-ie-prog';
    const inp=document.createElement('input');
    inp.type='number';
    inp.className='ie-input list-ie-input';
    inp.min='0';
    inp.max='100';
    inp.step='5';
    inp.value=String(t.prog||0);
    const suffix=document.createElement('span');
    suffix.textContent='%';
    wrap.appendChild(inp);
    wrap.appendChild(suffix);
    cell.innerHTML='';
    cell.appendChild(wrap);
    inp.focus();
    inp.select();
    const save=()=>{
      const next=Math.max(0,Math.min(100,parseInt(inp.value,10)||0));
      commitOnce(()=>{
        if(next!==(t.prog||0)){ pushHistory(); t.prog=next; void persistSave(t); }
      });
    };
    inp.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ e.preventDefault(); inp.blur(); }
      if(e.key==='Escape'){ e.preventDefault(); done=true; cell.classList.remove('editing'); renderAll(); }
    });
    inp.addEventListener('blur',save);
    return;
  }

  if(field==='rag'){
    // Immediate cycle — no input widget
    done=true;
    cell.classList.remove('editing');
    const cycle={g:'a',a:'r',r:'g'};
    const next=cycle[t.rag||'g']||'g';
    pushHistory();
    t.rag=next;
    t.ragScp=next;
    void persistSave(t);
    renderAll();
    showToast(next==='g'?'RAG: On Track':next==='a'?'RAG: At Risk':'RAG: Off Track','ok',1600);
    return;
  }

  cell.classList.remove('editing');
}
window.renderListView=renderListView;

// ── MODAL: EDIT / ADD ────────────────────────────────────────
function populatePredDropdown(excludeId){
  const sel=document.getElementById('m-pred');
  if(!sel) return;
  sel.innerHTML='<option value="">None</option>';
  sel.disabled=false;
  persistablePredOptions(excludeId).forEach(t=>{
    const o=document.createElement('option');
    o.value=t.id;
    o.textContent=(t.wbs||t.id)+' — '+(t.name||'').substring(0,30);
    sel.appendChild(o);
  });
}
function populateExtraPredDropdown(excludeId){
  const sel=document.getElementById('m-pred-extra');
  if(!sel) return;
  sel.innerHTML='';
  const primaryVal=document.getElementById('m-pred')?.value;
  const primaryId=primaryVal?parseInt(primaryVal):null;
  const taken=new Set([primaryId,...editingExtraPredIds]);
  const opts=persistablePredOptions(excludeId).filter(t=>!taken.has(t.id));
  if(!opts.length){
    sel.innerHTML='<option value="">No more available</option>';
    sel.disabled=true;
    return;
  }
  sel.disabled=false;
  opts.forEach(t=>{
    const o=document.createElement('option');
    o.value=t.id;
    o.textContent=(t.wbs||t.id)+' — '+(t.name||'').substring(0,30);
    sel.appendChild(o);
  });
}
function renderExtraPredList(){
  const list=document.getElementById('extraPredList');
  if(!list) return;
  list.innerHTML=editingExtraPredIds.map(id=>{
    const t=tasks.find(x=>x.id===id);
    const label=t?((t.wbs||t.id)+' — '+(t.name||'').substring(0,24)):('#'+id);
    return '<span class="extra-pred-chip">'+esc(label)+'<button type="button" onclick="removeExtraPred('+id+')" aria-label="Remove predecessor" title="Remove">×</button></span>';
  }).join('');
}
function syncExtraPredUI(){
  // Scoped to just the add-row (select + button), not the whole .fg — the
  // already-added chips above it must stay removable even with no primary
  // predecessor selected.
  const row=document.getElementById('extraPredAddRow');
  const primaryVal=document.getElementById('m-pred')?.value;
  const hasPrimary=!!primaryVal;
  if(row) row.classList.toggle('is-disabled',!hasPrimary);
  const addBtn=document.getElementById('extraPredAddBtn');
  if(addBtn) addBtn.disabled=!hasPrimary;
  const sel=document.getElementById('m-pred-extra');
  if(sel) sel.disabled=!hasPrimary;
  if(hasPrimary) populateExtraPredDropdown(editingId);
}
function addExtraPred(){
  const sel=document.getElementById('m-pred-extra');
  if(!sel||!sel.value) return;
  const id=parseInt(sel.value);
  if(!id||editingExtraPredIds.includes(id)) return;
  editingExtraPredIds.push(id);
  renderExtraPredList();
  populateExtraPredDropdown(editingId);
}
function removeExtraPred(id){
  editingExtraPredIds=editingExtraPredIds.filter(x=>x!==id);
  renderExtraPredList();
  populateExtraPredDropdown(editingId);
}
function populateParentDropdown(excludeId){
  const sel=document.getElementById('m-parent');
  if(!sel) return;
  sel.innerHTML='<option value="">None (top level)</option>';
  tasks.filter(t=>t.id!==excludeId&&t.type!==6&&!isLocalOnly(t)).forEach(t=>{
    const o=document.createElement('option');
    o.value=t.id;
    o.textContent=(t.wbs||'')+' — '+(LEVELS[t.type]||'')+': '+(t.name||'').substring(0,25);
    sel.appendChild(o);
  });
}

function openEdit(id){
  const t=tasks.find(x=>x.id===id);
  if(!t) return;
  editingId=id;
  calcWBS();
  document.getElementById('editTitle').textContent='Edit — '+(t.name||'').substring(0,28);
  document.getElementById('m-name').value=t.name;
  const typeSel=document.getElementById('m-type');
  if(typeSel){
    [...typeSel.options].forEach(o=>{ o.hidden=false; o.disabled=false; });
    typeSel.value=String(t.type);
  }
  document.getElementById('m-start').value=t.start;
  document.getElementById('m-end').value=t.end;
  const mo=document.getElementById('m-owner');
  if(mo) mo.value=t.owner||'';
  document.getElementById('m-prog').value=t.prog;
  document.getElementById('m-prog-lbl').textContent=t.prog+'%';
  document.getElementById('m-notes').value=t.notes||'';
  document.getElementById('delBtn').style.display='block';
  currentRag=t.rag||'g';
  document.querySelectorAll('.rag-opt').forEach(o=>{
    o.classList.remove('sel-g','sel-a','sel-r');
    if(o.dataset.rag===currentRag) o.classList.add('sel-'+currentRag);
  });
  currentDep=t.depType||'FS';
  document.querySelectorAll('.dep-opt').forEach(o=>{
    o.classList.remove('sel');
    if(o.dataset.dep===currentDep) o.classList.add('sel');
  });
  populatePredDropdown(id);
  populateParentDropdown(id);
  document.getElementById('m-pred').value=t.predId||'';
  document.getElementById('m-parent').value=t.parent||'';
  editingExtraPredIds=Array.isArray(t.extraPredIds)?[...t.extraPredIds]:[];
  renderExtraPredList();
  syncDepTypeUI();
  syncExtraPredUI();
  document.getElementById('modalEdit').classList.add('open');
}

function addItem(parentId,afterId){
  editingId=null;
  insertAfterId=afterId??null;
  calcWBS();
  document.getElementById('editTitle').textContent='Add Work Item';
  document.getElementById('m-name').value='';
  const today=fmt(new Date());
  document.getElementById('m-start').value=today;
  document.getElementById('m-end').value=fmt(addDays(new Date(),7));
  const typeSel=document.getElementById('m-type');
  if(typeSel){
    [...typeSel.options].forEach(o=>{ o.hidden=false; o.disabled=false; });
    typeSel.value='5';
  }
  const mo=document.getElementById('m-owner');
  if(mo && OWNERS.length) mo.value=OWNERS[0];
  document.getElementById('m-prog').value=0;
  document.getElementById('m-prog-lbl').textContent='0%';
  document.getElementById('m-notes').value='';
  document.getElementById('delBtn').style.display='none';
  currentRag='g';
  document.querySelectorAll('.rag-opt').forEach(o=>o.classList.remove('sel-g','sel-a','sel-r'));
  const gOpt=document.querySelector('.rag-opt[data-rag="g"]');
  if(gOpt) gOpt.classList.add('sel-g');
  currentDep='FS';
  document.querySelectorAll('.dep-opt').forEach(o=>o.classList.remove('sel'));
  const fsOpt=document.querySelector('.dep-opt[data-dep="FS"]');
  if(fsOpt) fsOpt.classList.add('sel');
  populatePredDropdown(null);
  populateParentDropdown(null);
  editingExtraPredIds=[];
  renderExtraPredList();
  syncExtraPredUI();
  const sel=getSelectedTask();
  const defaultParent=parentId??(sel?sel.parent:null);
  if(defaultParent) document.getElementById('m-parent').value=defaultParent;
  document.getElementById('modalEdit').classList.add('open');
}

function addItemAfterSelected(){
  const sel=getSelectedTask();
  addItem(sel?sel.parent:null,sel?sel.id:null);
}
function addItemOfType(type){
  const typeMap={phase:2,milestone:6,task:5};
  addItemAfterSelected();
  document.getElementById('m-type').value=String(typeMap[type]||5);
  if(type==='milestone'){
    const today=fmt(new Date());
    document.getElementById('m-end').value=today;
  }
}
function addItemOfTypeAfterSelected(type){
  addItemOfType(type);
}
/** DHTMLX-style: immediate add without modal (footer "+ Add a New Item") */
function addNewItem(){
  const sel=getSelectedTask();
  quickAddTask(sel?sel.parent:null, sel?sel.id:null);
}
/** Per-row green "+" — add child under this task */
function quickAddChild(parentId){
  const parent=tasks.find(x=>x.id===parentId);
  if(!parent) return;
  if(collapsed[parentId]) collapsed[parentId]=false;
  quickAddTask(parentId, null);
}
function quickAddTask(parentId, afterId){
  pushHistory();
  const today=fmt(new Date());
  const parent=parentId!=null?tasks.find(x=>x.id===parentId):null;
  let type=5;
  if(parent){
    if(parent.type===0||parent.type===1||parent.type===7) type=2;
    else if(parent.type===2) type=4;
    else if(parent.type===3) type=5;
    else if(parent.type===4) type=5;
    else type=5;
  }
  const newTask={
    id:nextId++,
    name:type===2?'New phase':type===3?'New workstream':type===6?'New milestone':'New task',
    type,
    owner:OWNERS[0]||'',
    start:today,
    end:type===6?today:fmt(addDays(new Date(),7)),
    prog:0,
    rag:'g',ragBgt:'g',ragSch:'g',ragScp:'g',
    notes:'',
    parent:parentId??null,
    predId:null,depType:'FS',
    color:LEVEL_COLORS[type]||'#64748b',
    wbs:'',
    customData:{}
  };
  if(afterId!=null){
    const idx=tasks.findIndex(x=>x.id===afterId);
    if(idx>=0) tasks.splice(idx+1,0,newTask);
    else tasks.push(newTask);
  } else {
    const kids=tasks.filter(t=>t.parent===parentId);
    if(kids.length){
      const last=kids[kids.length-1];
      const idx=tasks.findIndex(x=>x.id===last.id);
      tasks.splice(idx+1,0,newTask);
    } else {
      const pIdx=parentId!=null?tasks.findIndex(x=>x.id===parentId):-1;
      if(pIdx>=0) tasks.splice(pIdx+1,0,newTask);
      else tasks.push(newTask);
    }
  }
  invalidateTaskIndex();
  selectedTaskId=newTask.id;
  const parentPromoted=parent&&promoteToContainerIfNeeded(parent);
  calcWBS();
  if(mainView==='list'){
    renderListView();
    openEdit(newTask.id);
  } else {
    // Instant row + name focus — do not wait on the API / loading overlay
    queueCellEdit(newTask.id,'name');
    renderAll();
  }
  void persistCreate(newTask,{silent:true});
  if(parentPromoted&&!isUnsavedLocal(parent)) void persistSave(parent);
}

function saveItem(){
  const name=document.getElementById('m-name').value.trim();
  if(!name){alert('Please enter a name');return;}
  const start=document.getElementById('m-start').value;
  const end=document.getElementById('m-end').value;
  if(!start||!end){alert('Start and end dates are required');return;}
  const typeVal=parseInt(document.getElementById('m-type').value)||5;
  const parentVal=document.getElementById('m-parent').value;
  const predVal=document.getElementById('m-pred').value;

  if(editingId){
    const t=tasks.find(x=>x.id===editingId);
    if(t){
      pushHistory();
      t.name=name;t.start=start;t.end=(typeVal===6?start:end);
      t.type=typeVal;
      t.owner=document.getElementById('m-owner').value||'';
      t.prog=parseInt(document.getElementById('m-prog').value)||0;
      t.rag=currentRag;t.ragScp=currentRag;
      if(t.type===1){ t.ragBgt=currentRag; t.ragSch=currentRag; }
      t.notes=document.getElementById('m-notes').value;
      t.parent=parentVal?parseInt(parentVal):null;
      t.predId=predVal?parseInt(predVal):null;
      if(t.predId&&predecessorIdsForSave(t.predId)===null){ showToast('Invalid predecessor','err',3000); t.predId=null; }
      t.depType=t.predId?(currentDep||'FS'):'FS';
      // Extras only mean anything alongside a primary predecessor — see
      // predecessorIdsForSave's own "no primary ⇒ drop extras" rule.
      t.extraPredIds=t.predId?editingExtraPredIds.slice():[];
      if(t.parent!=null){
        const p=tasks.find(x=>x.id===t.parent);
        if(p&&promoteToContainerIfNeeded(p)&&!isUnsavedLocal(p)) void persistSave(p);
      }
      promoteToContainerIfNeeded(t);
      closeModal('modalEdit');
      if(t.predId||autoSchedule) applyAutoSchedule();
      renderAll();
      void persistSave(t).then(ok=>{
        if(ok&&t.predId) showToast('Dependency '+(t.depType==='EE'?'FF':t.depType)+' saved','ok',2000);
      });
      if(autoSchedule||t.predId) void persistScheduleChanges(t);
    }
  } else {
    pushHistory();
    const newTask={
      id:nextId++,name,type:typeVal,
      owner:document.getElementById('m-owner').value||'',
      start,end:(typeVal===6?start:end),
      prog:parseInt(document.getElementById('m-prog').value)||0,
      rag:currentRag,ragBgt:currentRag,ragSch:currentRag,ragScp:currentRag,
      notes:document.getElementById('m-notes').value,
      parent:parentVal?parseInt(parentVal):null,
      predId:predVal?parseInt(predVal):null,
      extraPredIds:predVal?editingExtraPredIds.slice():[],
      depType:currentDep,
      color:LEVEL_COLORS[typeVal]||'#64748b',
      wbs:''
    };
    if(insertAfterId!==null){
      const idx=tasks.findIndex(t=>t.id===insertAfterId);
      if(idx>=0) tasks.splice(idx+1,0,newTask);
      else tasks.push(newTask);
    } else {
      tasks.push(newTask);
    }
    invalidateTaskIndex();
    insertAfterId=null;
    closeModal('modalEdit');
    renderAll();
    persistCreate(newTask);
  }
}

function collectDescendantIds(rootId){
  const out=[];
  const stack=[rootId];
  const seen=new Set();
  while(stack.length){
    const id=stack.pop();
    if(seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    tasks.filter(t=>t.parent===id).forEach(c=>stack.push(c.id));
  }
  return out;
}

function removeTasksByIds(ids){
  const kill=new Set(ids);
  // Capture depth before removal — getDepth walks live parents
  const removed=tasks
    .filter(t=>kill.has(t.id))
    .map(t=>({t, depth:getDepth(t)}))
    .sort((a,b)=>b.depth-a.depth)
    .map(x=>x.t);
  const predCleared=[];
  tasks.forEach(t=>{
    if(kill.has(t.id)) return;
    if(t.predId!=null&&kill.has(t.predId)){
      t.predId=null;
      t.depType='FS';
      predCleared.push(t);
    }
  });
  tasks=tasks.filter(t=>!kill.has(t.id));
  invalidateTaskIndex();
  ids.forEach(id=>{
    checkedRowIds.delete(id);
    delete collapsed[id];
    if(selectedTaskId===id) selectedTaskId=null;
    if(editingId===id) editingId=null;
  });
  return {removed, predCleared};
}

function deleteItem(){
  if(!editingId) return;
  if(editingId===1){ showToast('Cannot delete the project row','info',2200); return; }
  if(!confirm('Delete this item and all its children?')) return;
  pushHistory();
  const ids=collectDescendantIds(editingId);
  const {removed, predCleared}=removeTasksByIds(ids);
  closeModal('modalEdit');
  renderAll();
  void persistDeletes(removed,predCleared);
}

function updateSelectionBar(){
  const bar=document.getElementById('ganttSelBar');
  const countEl=document.getElementById('ganttSelCount');
  const selAll=document.getElementById('selAllCb');
  // Drop ids that no longer exist
  Array.from(checkedRowIds).forEach(id=>{
    if(!tasks.some(t=>t.id===id)) checkedRowIds.delete(id);
  });
  const n=checkedRowIds.size;
  if(bar) bar.classList.toggle('is-on',n>0);
  if(countEl) countEl.textContent=n+' selected';
  const visible=getVisible().filter(t=>!(t.type===1||t.id===1));
  const visChecked=visible.filter(t=>checkedRowIds.has(t.id)).length;
  if(selAll){
    selAll.checked=visible.length>0&&visChecked===visible.length;
    selAll.indeterminate=visChecked>0&&visChecked<visible.length;
  }
}

function toggleRowCheck(id,checked){
  const t=tasks.find(x=>x.id===id);
  if(!t||t.type===1||t.id===1) return;
  if(checked) checkedRowIds.add(id);
  else checkedRowIds.delete(id);
  const row=document.getElementById('tr-'+id);
  if(row){
    row.classList.toggle('is-checked',checked);
    const cb=row.querySelector('.task-sel-cb');
    if(cb) cb.checked=!!checked;
  }
  updateSelectionBar();
}

function toggleSelectAllVisible(checked){
  getVisible().forEach(t=>{
    if(t.type===1||t.id===1) return;
    if(checked) checkedRowIds.add(t.id);
    else checkedRowIds.delete(t.id);
  });
  document.querySelectorAll('.task-row').forEach(row=>{
    const id=Number(row.dataset.id);
    if(!Number.isFinite(id)||id===1) return;
    const on=checkedRowIds.has(id);
    row.classList.toggle('is-checked',on);
    const cb=row.querySelector('.task-sel-cb');
    if(cb) cb.checked=on;
  });
  updateSelectionBar();
}

function clearRowSelection(){
  checkedRowIds.clear();
  document.querySelectorAll('.task-row.is-checked').forEach(row=>{
    row.classList.remove('is-checked');
    const cb=row.querySelector('.task-sel-cb');
    if(cb) cb.checked=false;
  });
  updateSelectionBar();
}

function deleteSelectedRows(){
  if(!checkedRowIds.size) return;
  const roots=Array.from(checkedRowIds).filter(id=>{
    const t=tasks.find(x=>x.id===id);
    return t&&t.type!==1&&t.id!==1;
  });
  if(!roots.length){
    showToast('Cannot delete the project row','info',2200);
    clearRowSelection();
    return;
  }
  const kill=new Set();
  roots.forEach(id=>collectDescendantIds(id).forEach(x=>kill.add(x)));
  kill.delete(1);
  const n=kill.size;
  const msg=n===1
    ?'Delete this line and any children under it?'
    :'Delete '+n+' lines (including any children under selected folders)?';
  if(!confirm(msg)) return;
  pushHistory();
  const {removed, predCleared}=removeTasksByIds(Array.from(kill));
  checkedRowIds.clear();
  renderAll();
  void persistDeletes(removed,predCleared);
}

function closeModal(id){
  const el=document.getElementById(id);
  if(el) el.classList.remove('open');
  if(id==='modalVersionName') versionNameModalCb=null;
  if(id==='modalVersionConfirm') versionConfirmModalCb=null;
}
function selRag(el,r){
  currentRag=r;
  document.querySelectorAll('.rag-opt').forEach(o=>o.classList.remove('sel-g','sel-a','sel-r'));
  el.classList.add('sel-'+r);
}
function syncDepTypeUI(){
  const dep=currentDep||'FS';
  document.querySelectorAll('.dep-opt').forEach(o=>{
    o.classList.toggle('sel', o.dataset.dep===dep);
  });
  const pred=document.getElementById('m-pred');
  const group=document.getElementById('depTypeGroup');
  const hint=document.getElementById('depTypeHint');
  const modalOpen=!!document.getElementById('modalEdit')?.classList.contains('open');
  const hasPred=!!(pred&&pred.value);
  if(group) group.classList.toggle('is-disabled', modalOpen && !hasPred);
  if(hint){
    hint.textContent=(modalOpen && !hasPred)?'— set a Predecessor first':'';
  }
}
function selDep(el,d){
  if(!d) return;
  currentDep=d;
  syncDepTypeUI();
  // Keep draw-mode chips in sync even when clicking modal buttons
  document.querySelectorAll('#depDrawTypes .dep-opt').forEach(o=>o.classList.toggle('sel',o.dataset.dep===d));
}
function onPredChange(){
  syncDepTypeUI();
  const primaryVal=document.getElementById('m-pred')?.value;
  const primaryId=primaryVal?parseInt(primaryVal):null;
  if(primaryId&&editingExtraPredIds.includes(primaryId)){
    // Picking the same task as both primary and an already-added extra would
    // be a redundant duplicate link — drop it from extras, primary wins.
    editingExtraPredIds=editingExtraPredIds.filter(id=>id!==primaryId);
    renderExtraPredList();
  }
  syncExtraPredUI();
}
window.selRag=selRag;
window.selDep=selDep;
window.onPredChange=onPredChange;

// ─── IMPORT / EXPORT ────────────────────────────────────────
function openImportExport(mode){
  const body=document.getElementById('iebody');
  document.getElementById('ieTitle').textContent=mode==='export'?'Export Project Plan':'Import Project Plan';
  if(mode==='export'){
    body.innerHTML='<div class="ie-section">'+
      '<div class="ie-section-title">📥 Export project plan</div>'+
      '<p class="ie-hint">Download a sample template or export the live plan as Excel (.xlsx) / CSV for offline editing and re-import.</p>'+
      '<div class="ie-actions">'+
        '<button class="btn btn-excel" onclick="downloadSampleTemplate(event,\'xlsx\')">↓ Sample Excel template</button>'+
        '<button class="btn btn-ghost" onclick="downloadSampleTemplate(event,\'csv\')">↓ Sample CSV</button>'+
        '<button class="btn btn-excel" onclick="downloadCurrentPlan(event,\'xlsx\')">↓ Export current plan (Excel)</button>'+
        '<button class="btn btn-ghost" onclick="downloadCurrentPlan(event,\'csv\')">↓ Export current plan (CSV)</button>'+
        '<button class="btn btn-green" onclick="downloadMSProject(event)">↓ Export MS Project (XML)</button>'+
        '<button class="btn btn-ghost" onclick="exportGanttPNG(event)">↓ Export PNG</button>'+
        '<button class="btn btn-ghost" onclick="exportGanttPDF(event)">↓ Export PDF</button>'+
      '</div></div>'+
      '<div class="ie-section" style="margin-bottom:0;"><div class="ie-section-title">📋 Column reference (project plan template)</div>'+
      '<table class="ie-col-ref">'+
        [['WBS','Hierarchy code (e.g. 1, 1.1, 1.1.1, 1.1.1.M)'],
         ['Level*','Program, Project, Release, Phase, Workstream, Activity, Task, or Milestone'],
         ['Name*','Work item name'],
         ['Owner','Owner name'],
         ['RAG','Green, Amber, or Red'],
         ['DependsOn','WBS of predecessor'],
         ['Start*','Date (YYYY-MM-DD or 5-Jan-26)'],
         ['End','End date (or use DurationDays)'],
         ['DurationDays','Inclusive duration in days'],
         ['Notes','Free text']
        ].map(([col,desc])=>'<tr><td>'+col+'</td><td>'+desc+'</td></tr>').join('')+
      '</table>'+
      '<p class="ie-hint-sm">Legacy Jiganto columns (Type as 0–7, Parent_WBS, Predecessor_WBS) are still accepted on import.</p>'+
      '</div>';
  } else {
    body.innerHTML='<div class="ie-section">'+
      '<div class="ie-section-title">📥 Sample template</div>'+
      '<p class="ie-hint">Download a filled sample (Program → 2 Projects → Phases / Tasks / Milestones) in the standard column layout, then edit and re-upload.</p>'+
      '<div class="ie-actions">'+
        '<button class="btn btn-excel" onclick="downloadSampleTemplate(event,\'xlsx\')" title="Excel workbook matching the project plan template">↓ Sample Excel (.xlsx)</button>'+
        '<button class="btn btn-ghost" onclick="downloadSampleTemplate(event,\'csv\')" title="CSV version of the same template">↓ Sample CSV</button>'+
      '</div>'+
    '</div>'+
    '<div class="ie-section" style="margin-bottom:0;">'+
      '<div class="ie-section-title">📤 Import project plan</div>'+
      '<p class="ie-hint">Upload <strong>.xlsx</strong> / <strong>.csv</strong> (project plan template) or <strong>.xml</strong> (MS Project). Level names (Project, Phase, Milestone…) map automatically.</p>'+
      '<div class="ie-actions" style="margin-bottom:10px;">'+
        '<button class="btn '+(importMode==='append'?'btn-p':'btn-ghost')+'" onclick="setImportMode(\'append\')">⊕ Append</button>'+
        '<button class="btn '+(importMode==='overwrite'?'btn-p':'btn-ghost')+'" onclick="setImportMode(\'overwrite\')">↺ Overwrite</button>'+
      '</div>'+
      (importMode==='overwrite'?'<div style="font-size:11px;color:var(--amber);background:var(--amber-l);border:1px solid #fcd34d;border-radius:5px;padding:6px 10px;margin-bottom:10px;text-align:left;">⚠ Overwrite will replace your entire project plan.</div>':'')+
      '<div class="drop-zone" id="dropZone" onclick="document.getElementById(\'fileInput\').click()">'+
        '<div class="drop-zone-ico">📁</div>'+
        '<div class="drop-zone-text">Click or drag <strong>.xlsx</strong>, <strong>.csv</strong>, or <strong>.xml</strong> here</div>'+
      '</div>'+
      '<input type="file" id="fileInput" accept=".csv,.txt,.xlsx,.xls,.xml" style="display:none;" onchange="handleFileSelect(this)">'+
      '<div id="importResult" style="margin-top:8px;font-size:12px;text-align:left;"></div>'+
    '</div>';
    setupDropZone();
  }
  document.getElementById('modalIE').classList.add('open');
}
function setImportMode(m){importMode=m;openImportExport('import');}

/** Shared sample rows matching the client project-plan template */
function getSamplePlanAoA(){
  return [
    ['WBS','Level','Name','Owner','RAG','DependsOn','Start','End','DurationDays','Notes'],
    ['1','Program','Sample Transformation Program','Keith','Green','','5-Jan-26','30-Jun-26',177,'Program container — two projects below'],
    ['1.1','Project','SAP S/4HANA Transformation','Keith','Green','','5-Jan-26','30-Jun-26',177,'First project under the program'],
    ['1.1.1','Phase','Initiation','Janet','Green','','5-Jan-26','28-Feb-26',55,'Phase'],
    ['1.1.1.1','Activity','Planning','Peter','Green','','5-Jan-26','31-Jan-26',27,''],
    ['1.1.1.1.1','Task','Planning Task 1','Juliet','Green','','5-Jan-26','12-Jan-26',8,''],
    ['1.1.1.1.2','Task','Planning Task 2','John','Amber','1.1.1.1.1','13-Jan-26','20-Jan-26',8,''],
    ['1.1.1.M','Milestone','Planning Complete','Janet','Green','1.1.1.1.2','31-Jan-26','31-Jan-26',1,'Milestone'],
    ['1.1.2','Phase','Discovery','Janet','Green','','1-Feb-26','28-Feb-26',28,'Second phase'],
    ['1.1.2.1','Activity','Requirements','Peter','Green','1.1.1.M','1-Feb-26','20-Feb-26',20,''],
    ['1.1.2.1.1','Task','Requirements Workshop','Juliet','Green','','1-Feb-26','5-Feb-26',5,''],
    ['1.1.2.M','Milestone','Discovery Complete','Janet','Green','1.1.2.1','28-Feb-26','28-Feb-26',1,''],
    ['1.2','Project','Second Project','Keith','Green','','1-Feb-26','30-Jun-26',150,'Second project under the same program'],
    ['1.2.1','Phase','Kickoff','John','Green','','1-Feb-26','28-Feb-26',28,''],
    ['1.2.1.1','Task','Kickoff Meeting','John','Green','','1-Feb-26','3-Feb-26',3,''],
    ['1.2.1.M','Milestone','Kickoff Complete','Keith','Green','1.2.1.1','28-Feb-26','28-Feb-26',1,''],
  ];
}
function samplePlanToCsv(){
  return getSamplePlanAoA().map(row=>row.map(cell=>{
    const s=String(cell==null?'':cell);
    if(/[",\n\r]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
    return s;
  }).join(',')).join('\n')+'\n';
}
/** Convert AoA → sheet with all values as text so Excel left-aligns (numbers otherwise right-align). */
function aoaToLeftAlignedSheet(XLSX,aoa){
  const textAoa=(aoa||[]).map(row=>(row||[]).map(cell=>cell==null?'':String(cell)));
  const ws=XLSX.utils.aoa_to_sheet(textAoa);
  if(!ws||!ws['!ref']) return ws;
  const range=XLSX.utils.decode_range(ws['!ref']);
  for(let R=range.s.r;R<=range.e.r;R++){
    for(let C=range.s.c;C<=range.e.c;C++){
      const addr=XLSX.utils.encode_cell({r:R,c:C});
      const cell=ws[addr];
      if(!cell) continue;
      cell.t='s';
      cell.v=cell.v==null?'':String(cell.v);
      if(cell.w!=null) delete cell.w;
      // Best-effort style (honoured by styled SheetJS builds; ignored otherwise)
      cell.s={alignment:{horizontal:'left',vertical:'center',wrapText:false}};
    }
  }
  return ws;
}
function downloadTemplate(ev){
  downloadSampleTemplate(ev,'csv');
}
async function downloadSampleTemplate(ev,format){
  const btn=ev&&ev.currentTarget?ev.currentTarget:null;
  const kind=(format||'xlsx').toLowerCase();
  showLoading(kind==='xlsx'?'Preparing Excel template…':'Preparing CSV template…',btn);
  try{
    if(kind==='xlsx'){
      try{
        const XLSX=await loadSheetJS();
        const ws=aoaToLeftAlignedSheet(XLSX,getSamplePlanAoA());
        ws['!cols']=[{wch:10},{wch:12},{wch:36},{wch:12},{wch:8},{wch:14},{wch:12},{wch:12},{wch:12},{wch:40}];
        const wb=XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb,ws,'Project Plan');
        XLSX.writeFile(wb,'project_plan_template.xlsx');
        showToast('✓ Sample Excel template downloaded','ok');
        return;
      }catch(e){
        console.warn('xlsx template failed, falling back to CSV',e);
        downloadCSV('project_plan_template.csv',samplePlanToCsv());
        showToast('✓ Sample CSV downloaded (Excel helper unavailable)','ok',3200);
        return;
      }
    }
    downloadCSV('project_plan_template.csv',samplePlanToCsv());
    showToast('✓ Sample CSV template downloaded','ok');
  } finally {
    hideLoading();
  }
}
window.downloadSampleTemplate=downloadSampleTemplate;
window.downloadTemplate=downloadTemplate;

function getCurrentPlanAoA(){
    calcWBS();
  const ordered=getOrderedTasks().filter(t=>!isLocalOnly(t));
    const wbsMap={};
  tasks.forEach(t=>{ if(t.wbs) wbsMap[t.id]=t.wbs; });
  const ragLabel={g:'Green',a:'Amber',r:'Red'};
  const header=['WBS','Level','Name','Owner','RAG','DependsOn','Start','End','DurationDays','Notes'];
  const rows=ordered.map(t=>{
    const level=LEVELS[t.type]||'Task';
    const rag=ragLabel[t.rag]||ragLabel[t.ragScp]||'Green';
    return [
      t.wbs||'',
      level,
      t.name||'',
      t.owner||'',
      rag,
      t.predId? (wbsMap[t.predId]||'') : '',
      t.start||'',
      t.end||'',
      taskDuration(t),
      t.notes||'',
    ];
  });
  return [header,...rows];
}
function currentPlanToCsv(){
  return getCurrentPlanAoA().map(row=>row.map(cell=>{
    const s=String(cell==null?'':cell);
    if(/[",\n\r]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
    return s;
  }).join(',')).join('\n')+'\n';
}
function planExportBasename(){
  const d=window.GANTT_INIT_DATA||{};
  const raw=(d.projectName||'project_plan').replace(/[^a-z0-9_-]+/gi,'_').substring(0,40);
  return (raw||'project_plan')+'_export';
}
async function downloadCurrentPlan(ev,format){
  const btn=ev&&ev.currentTarget?ev.currentTarget:null;
  const kind=(format||'xlsx').toLowerCase();
  showLoading(kind==='xlsx'?'Exporting Excel…':'Exporting CSV…',btn);
  try{
    const base=planExportBasename();
    if(kind==='xlsx'){
      try{
        const XLSX=await loadSheetJS();
        const ws=aoaToLeftAlignedSheet(XLSX,getCurrentPlanAoA());
        ws['!cols']=[{wch:10},{wch:12},{wch:36},{wch:12},{wch:8},{wch:14},{wch:12},{wch:12},{wch:12},{wch:40}];
        const wb=XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb,ws,'Project Plan');
        XLSX.writeFile(wb,base+'.xlsx');
        showToast('✓ Excel plan downloaded','ok');
        return;
      }catch(e){
        console.warn('xlsx export failed, falling back to CSV',e);
        downloadCSV(base+'.csv',currentPlanToCsv());
        showToast('✓ CSV downloaded (Excel helper unavailable)','ok',3200);
        return;
      }
    }
    downloadCSV(base+'.csv',currentPlanToCsv());
    showToast('✓ CSV downloaded','ok');
  }catch(e){
    console.error(e);
    showToast('Export failed','err',2800);
  } finally {
    hideLoading();
  }
}
window.downloadCurrentPlan=downloadCurrentPlan;
function downloadCSV(filename,content){
  downloadFile(filename,content,'text/csv');
}
function downloadFile(filename,content,mime){
  const blob=new Blob([content],{type:mime||'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}
function xmlEsc(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function msDateTime(d){
  return fmt(D(d))+'T08:00:00';
}
function msDurationHours(start,end){
  const days=taskDurationDays(start,end)+1;
  return 'PT'+(days*8)+'H0M0S';
}
function downloadMSProject(ev){
  const btn=ev&&ev.currentTarget?ev.currentTarget:null;
  showLoading('Exporting to MS Project…',btn);
  try{
    calcWBS();
    const d=window.GANTT_INIT_DATA||{};
    const projectName=d.projectName||'Jiganto Project';
    const uidMap={};
    getOrderedTasks().filter(t=>!isLocalOnly(t)).forEach((t,i)=>{uidMap[t.id]=i+1;});
    const depTypeMap={FS:1,SS:2,EE:3};
    let tasksXml='';
    getOrderedTasks().filter(t=>!isLocalOnly(t)).forEach(t=>{
      const uid=uidMap[t.id];
      const eff=getChildren(t.id).length?getEffectiveDates(t):{start:t.start,end:t.end};
      const outline=(t.wbs||'1').split('.').length;
      const summary=getChildren(t.id).length?1:0;
      const milestone=t.type===6?1:0;
      let predXml='';
      if(t.predId&&uidMap[t.predId]){
        predXml='<PredecessorLink><PredecessorUID>'+uidMap[t.predId]+'</PredecessorUID><Type>'+(depTypeMap[t.depType]||1)+'</Type></PredecessorLink>';
      }
      tasksXml+='<Task>'+
        '<UID>'+uid+'</UID><ID>'+uid+'</ID>'+
        '<Name>'+xmlEsc(t.name)+'</Name>'+
        '<WBS>'+xmlEsc(t.wbs)+'</WBS>'+
        '<OutlineLevel>'+outline+'</OutlineLevel>'+
        '<Start>'+msDateTime(eff.start)+'</Start>'+
        '<Finish>'+msDateTime(eff.end)+'</Finish>'+
        '<Duration>'+msDurationHours(eff.start,eff.end)+'</Duration>'+
        '<PercentComplete>'+(t.prog||0)+'</PercentComplete>'+
        '<Summary>'+summary+'</Summary>'+
        '<Milestone>'+milestone+'</Milestone>'+
        predXml+
      '</Task>';
    });
    const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
      '<Project xmlns="http://schemas.microsoft.com/project">\n'+
      '<SaveVersion>14</SaveVersion><Name>'+xmlEsc(projectName)+'</Name>\n'+
      '<ScheduleFromStart>1</ScheduleFromStart>\n'+
      '<Tasks>\n'+tasksXml+'\n</Tasks>\n</Project>';
    const safeName=projectName.replace(/[^a-z0-9_-]+/gi,'_').substring(0,40)||'jiganto_project';
    downloadFile(safeName+'.xml',xml,'application/xml');
    showToast('✓ MS Project downloaded','ok');
  }catch(e){
    console.error(e);
    showToast('MS Project export failed','err',2800);
  } finally {
    hideLoading();
  }
}

// ─── GLOBAL LOADING / TOAST ───────────────────────────────────
let loadingDepth=0;
let busyBtnEl=null;
function ensureLoadingOverlay(){
  let ov=document.getElementById('ganttLoadingOverlay');
  if(ov) return ov;
  ov=document.createElement('div');
  ov.id='ganttLoadingOverlay';
  ov.className='gantt-loading-overlay';
  ov.innerHTML='<div class="gantt-loading-card"><div class="gantt-spinner"></div><span id="ganttLoadingMsg">Working…</span></div>';
  document.body.appendChild(ov);
  return ov;
}
function showLoading(msg,btnEl){
  loadingDepth++;
  const ov=ensureLoadingOverlay();
  const lbl=document.getElementById('ganttLoadingMsg');
  if(lbl) lbl.textContent=msg||'Working…';
  ov.classList.add('on');
  document.body.classList.add('gantt-busy');
  if(btnEl){
    busyBtnEl=btnEl;
    btnEl.classList.add('is-loading');
    btnEl.disabled=true;
  }
}
function hideLoading(){
  loadingDepth=Math.max(0,loadingDepth-1);
  if(loadingDepth>0) return;
  const ov=document.getElementById('ganttLoadingOverlay');
  if(ov) ov.classList.remove('on');
  document.body.classList.remove('gantt-busy');
  if(busyBtnEl){
    busyBtnEl.classList.remove('is-loading');
    busyBtnEl.disabled=false;
    busyBtnEl=null;
  }
}
function showToast(msg,type,ms){
  let toast=document.getElementById('ganttToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='ganttToast';
    toast.className='gantt-toast';
    document.body.appendChild(toast);
  }
  clearTimeout(toast._hideT);
  toast.className='gantt-toast '+(type||'info');
  toast.textContent=msg||'';
  toast.classList.add('on');
  toast._hideT=setTimeout(()=>toast.classList.remove('on'),ms||2200);
}
function showSaveIndicator(){
  showToast('✓ Saved','ok',1800);
}
async function withLoading(msg,fn,btnEl){
  showLoading(msg,btnEl);
  try{
    return await fn();
  } finally {
    hideLoading();
  }
}

function loadExportScript(src,timeoutMs){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-export-src="'+src+'"]');
    if(existing){ if(existing.dataset.loaded==='1') resolve(); else existing.addEventListener('load',()=>resolve()); return; }
    const s=document.createElement('script');
    s.src=src; s.dataset.exportSrc=src; s.dataset.loaded='0';
    const t=setTimeout(()=>{
      s.remove();
      reject(new Error('Timed out loading '+src));
    },timeoutMs||8000);
    s.onload=()=>{clearTimeout(t);s.dataset.loaded='1';resolve();};
    s.onerror=()=>{clearTimeout(t);s.remove();reject(new Error('Failed to load '+src));};
    document.head.appendChild(s);
  });
}
/** Loads a lib from same-origin /vendor first (instant, offline-safe); falls back to CDN with a hard timeout. */
async function loadLib(globalName,localSrc,cdnSrc){
  if(window[globalName]) return;
  try{
    await loadExportScript(localSrc,6000);
    if(window[globalName]) return;
  }catch(e){ console.warn('Local lib load failed, trying CDN:',localSrc,e); }
  await loadExportScript(cdnSrc,8000);
}
async function ensureCaptureLibs(){
  await loadLib('html2canvas','/vendor/html2canvas.min.js','https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  await loadLib('jspdf','/vendor/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
}
async function captureGanttCanvas(){
  const target=document.getElementById('ganttBody');
  if(!target) throw new Error('Gantt not ready');
  const tlWrap=document.getElementById('tlWrap');
  const taskScroll=document.getElementById('taskScroll');
  const prevTl=tlWrap?tlWrap.style.overflow:'';
  const prevTs=taskScroll?taskScroll.style.overflow:'';
  if(tlWrap) tlWrap.style.overflow='visible';
  if(taskScroll) taskScroll.style.overflow='visible';
  try{
    return await html2canvas(target,{
      scale:2,
      backgroundColor:'#ffffff',
      useCORS:true,
      logging:false,
      width:target.scrollWidth,
      height:target.scrollHeight,
      windowWidth:target.scrollWidth,
      windowHeight:target.scrollHeight,
    });
  }finally{
    if(tlWrap) tlWrap.style.overflow=prevTl;
    if(taskScroll) taskScroll.style.overflow=prevTs;
  }
}
async function exportGanttPNG(ev){
  const btn=ev&&ev.currentTarget?ev.currentTarget:null;
  return withLoading('Generating PNG…',async()=>{
    try{
      await ensureCaptureLibs();
      const canvas=await captureGanttCanvas();
      const d=window.GANTT_INIT_DATA||{};
      const name=(d.projectName||'gantt_chart').replace(/[^a-z0-9_-]+/gi,'_').substring(0,40);
      await new Promise((resolve,reject)=>{
        canvas.toBlob(blob=>{
          if(!blob){reject(new Error('PNG export failed'));return;}
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url; a.download=name+'.png'; a.click();
          URL.revokeObjectURL(url);
          resolve();
        },'image/png');
      });
      showToast('✓ PNG downloaded','ok');
    }catch(e){
      console.error('PNG export failed:',e);
      showToast('PNG export failed','err',2800);
    }
  },btn);
}
async function exportGanttPDF(ev){
  const btn=ev&&ev.currentTarget?ev.currentTarget:null;
  return withLoading('Generating PDF…',async()=>{
    try{
      await ensureCaptureLibs();
      const canvas=await captureGanttCanvas();
      const d=window.GANTT_INIT_DATA||{};
      const name=(d.projectName||'gantt_chart').replace(/[^a-z0-9_-]+/gi,'_').substring(0,40);
      const img=canvas.toDataURL('image/png');
      const landscape=canvas.width>=canvas.height;
      const pdf=new jspdf.jsPDF({orientation:landscape?'landscape':'portrait',unit:'px',format:[canvas.width,canvas.height]});
      pdf.addImage(img,'PNG',0,0,canvas.width,canvas.height);
      pdf.save(name+'.pdf');
      showToast('✓ PDF downloaded','ok');
    }catch(e){
      console.error('PDF export failed:',e);
      showToast('PDF export failed','err',2800);
    }
  },btn);
}
function setupDropZone(){
  const dz=document.getElementById('dropZone');
  if(!dz) return;
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
  dz.addEventListener('drop',e=>{
    e.preventDefault();dz.classList.remove('drag-over');
    const file=e.dataTransfer.files[0];
    if(file) handleImportFile(file);
  });
}
function handleFileSelect(input){
  const file=input.files[0];
  if(file) handleImportFile(file);
  input.value='';
}
function handleImportFile(file){
  const name=(file.name||'').toLowerCase();
  if(name.endsWith('.xml')) parseMSProjectFile(file);
  else if(name.endsWith('.xlsx')||name.endsWith('.xls')) parseExcelPlanFile(file);
  else parseCSV(file);
}
function xmlNodeText(el,tag){
  if(!el) return '';
  const ns=el.namespaceURI;
  const node=ns?el.getElementsByTagNameNS(ns,tag)[0]:el.getElementsByTagName(tag)[0];
  return node?(node.textContent||'').trim():'';
}
function parseMSDate(s){
  if(!s) return '';
  const m=String(s).match(/(\d{4}-\d{2}-\d{2})/);
  return m?m[1]:'';
}
function msDepTypeToGantt(type){
  const map={1:'FS',2:'SS',3:'EE',4:'FS'};
  return map[parseInt(type,10)]||'FS';
}
function msTypeToGantt(summary,milestone){
  if(String(milestone)==='1') return 6;
  if(String(summary)==='1') return 4;
  return 5;
}
function parseMSProjectXML(text){
  const doc=new DOMParser().parseFromString(text,'text/xml');
  if(doc.querySelector('parsererror')) throw new Error('Invalid XML file');
  const ns=doc.documentElement.namespaceURI;
  const taskEls=ns
    ?Array.from(doc.getElementsByTagNameNS(ns,'Task'))
    :Array.from(doc.getElementsByTagName('Task'));
  const parsed=[];
  taskEls.forEach(el=>{
    const name=xmlNodeText(el,'Name');
    const uid=xmlNodeText(el,'UID');
    if(!name||!uid) return;
    const start=parseMSDate(xmlNodeText(el,'Start'));
    if(!start) return;
    const finish=parseMSDate(xmlNodeText(el,'Finish'))||start;
    const outline=parseInt(xmlNodeText(el,'OutlineLevel'),10)||1;
    const summary=xmlNodeText(el,'Summary');
    const milestone=xmlNodeText(el,'Milestone');
    const wbs=xmlNodeText(el,'WBS')||String(outline);
    const prog=parseInt(xmlNodeText(el,'PercentComplete'),10)||0;
    const predEl=ns
      ?el.getElementsByTagNameNS(ns,'PredecessorLink')[0]
      :el.getElementsByTagName('PredecessorLink')[0];
  const predUid=predEl?xmlNodeText(predEl,'PredecessorUID'):'';
    const predType=predEl?xmlNodeText(predEl,'Type'):'1';
    parsed.push({
      uid, name, start, end:finish, outlineLevel:outline, wbs,
      type:msTypeToGantt(summary,milestone),
      progress:prog,
      predUid, depType:msDepTypeToGantt(predType),
      owner:'', rag:'g', notes:'',
    });
  });
  if(!parsed.length) throw new Error('No tasks found in MS Project file');
  const stack=[];
  const rows=[];
  parsed.forEach((pt,idx)=>{
    while(stack.length&&stack[stack.length-1].outlineLevel>=pt.outlineLevel) stack.pop();
    const parentWbs=stack.length?stack[stack.length-1].wbs:null;
    rows.push({
      wbs:pt.wbs||String(idx+1),
      name:pt.name,
      type:pt.type,
      parentWbs,
      predecessorWbs:null,
      predecessorUid:pt.predUid||null,
      owner:pt.owner,
      start:pt.start,
      end:pt.end,
      progress:pt.progress,
      rag:pt.rag,
      notes:pt.notes,
      depType:pt.depType,
      uid:pt.uid,
    });
    stack.push({outlineLevel:pt.outlineLevel,wbs:rows[rows.length-1].wbs,uid:pt.uid});
  });
  const uidToWbs={};
  rows.forEach(r=>{if(r.uid) uidToWbs[r.uid]=r.wbs;});
  rows.forEach(r=>{
    if(r.predecessorUid&&uidToWbs[r.predecessorUid]) r.predecessorWbs=uidToWbs[r.predecessorUid];
    delete r.predecessorUid;
    delete r.uid;
  });
  return rows;
}
function parseMSProjectFile(file){
  showLoading('Reading MS Project file…');
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const rows=parseMSProjectXML(e.target.result);
      hideLoading();
      await applyImportedRows(rows,'MS Project');
    }catch(err){
      hideLoading();
      showImportResult('error',err.message||'MS Project import failed');
      showToast('Import failed','err',2800);
    }
  };
  reader.onerror=()=>{hideLoading();showToast('Could not read file','err',2800);};
  reader.readAsText(file);
}
async function applyImportedRows(rows,sourceLabel){
  let errors=0;
  const {projectId}=ganttMeta();
  showLoading('Importing '+rows.length+' items…');
  try{
    if(projectId){
      showImportResult('success','⏳ Saving '+rows.length+' items to database…');
      const ok=await persistBulkImport(rows,importMode);
      if(ok){
        showImportResult('success','✅ Imported '+rows.length+' items from '+sourceLabel+'.'+(errors>0?' ('+errors+' rows skipped)':''));
        showToast('✓ Imported '+rows.length+' items','ok');
        notifyGanttRefresh();
        return;
      }
      showImportResult('error','Database import failed — loaded locally only.');
    }
    pushHistory();
    const imported=rows.map(r=>({
      id:nextId++,name:r.name,type:r.type,owner:r.owner||'',start:r.start,end:r.end,
      prog:r.progress,rag:r.rag,ragBgt:r.rag,ragSch:r.rag,ragScp:r.rag,notes:r.notes,parent:null,predId:null,depType:r.depType||'FS',color:'#4f46e5',wbs:r.wbs,
    }));
    imported.forEach(t=>{
      const row=rows.find(r=>r.wbs===t.wbs);
      if(!row) return;
      let parentWbs=row.parentWbs||null;
      if(!parentWbs) parentWbs=parentWbsFromWbs(row.wbs);
      if(parentWbs){
        const p=imported.find(x=>x.wbs===parentWbs)||tasks.find(x=>x.wbs===parentWbs);
        if(p) t.parent=p.id;
      }
      if(row.predecessorWbs){
        const p=imported.find(x=>x.wbs===row.predecessorWbs)||tasks.find(x=>x.wbs===row.predecessorWbs);
        if(p) t.predId=p.id;
      }
    });
    if(importMode==='overwrite') tasks=tasks.filter(t=>t.id===1);
    tasks=[...tasks,...imported];
    invalidateTaskIndex();
    calcWBS();
    if(autoSchedule) applyAutoSchedule();
    showImportResult('success','✅ Imported '+imported.length+' items from '+sourceLabel+'.'+(errors>0?' ('+errors+' rows skipped)':''));
    showToast('✓ Imported '+imported.length+' items','ok');
    renderAll();
  } finally {
    hideLoading();
  }
}
async function persistBulkImport(rows,mode){
  const {projectId}=ganttMeta();
  if(!projectId||!rows.length) return false;
  try{
    const res=await fetch('/api/pm/projects/'+projectId+'/gantt/import',{
      method:'POST',credentials:'include',
      headers:await apiAuthHeaders(true),
      body:JSON.stringify({mode:mode||'append',items:rows}),
    });
    if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.message||'Import failed');}
    return true;
  }catch(e){console.error('Gantt bulk import failed:',e);return false;}
}
function notifyGanttRefresh(){
  const {projectId}=ganttMeta();
  // Hard remount so iframe reloads real DB ids after bulk import
  try{window.parent.postMessage({type:'gantt-version-activated',projectId,reason:'import'},'*');}catch(e){}
}

/** Normalize spreadsheet header → canonical key */
function normalizePlanHeader(h){
  const raw=String(h||'').replace(/^\uFEFF/,'').trim().toLowerCase();
  const key=raw.replace(/[\s\-]+/g,'_').replace(/[^\w]/g,'');
  const aliases={
    wbs:'wbs', wbs_code:'wbs', code:'wbs', id:'wbs',
    level:'level', type:'level', line_type:'level', linetype:'level', item_type:'level', row_type:'level',
    name:'name', title:'name', task:'name', task_name:'name', work_item:'name',
    owner:'owner', assignee:'owner', resource:'owner', responsible:'owner',
    rag:'rag', status:'rag', rag_status:'rag',
    dependson:'depends_on', depends_on:'depends_on', depends:'depends_on', dependency:'depends_on',
    predecessor:'depends_on', predecessors:'depends_on', predecessor_wbs:'depends_on', pred:'depends_on', pred_wbs:'depends_on',
    start:'start', start_date:'start', planned_start:'start', begin:'start',
    end:'end', end_date:'end', finish:'end', planned_end:'end', finish_date:'end',
    durationdays:'duration', duration_days:'duration', duration:'duration', days:'duration', dur:'duration',
    notes:'notes', note:'notes', comment:'notes', comments:'notes', description:'notes',
    parent_wbs:'parent_wbs', parent:'parent_wbs', parentwbs:'parent_wbs',
    progress:'progress', pct:'progress', percent:'progress', percent_complete:'progress',
    dep_type:'dep_type', dependency_type:'dep_type', link_type:'dep_type',
  };
  return aliases[key]||key;
}
function parseLevelType(raw){
  if(raw==null||String(raw).trim()==='') return 5;
  const s=String(raw).trim().toLowerCase();
  if(/^\d+$/.test(s)){
    const n=parseInt(s,10);
    return (n>=0&&n<=7)?n:5;
  }
  const map={
    program:0, programme:0,
    project:1, proj:1,
    phase:2, phases:2,
    workstream:3, 'work stream':3, work_stream:3, stream:3,
    activity:4, activities:4, summary:4,
    task:5, tasks:5,
    milestone:6, milestones:6, ms:6, gate:6,
    release:7, releases:7,
  };
  return map[s]??map[s.replace(/\s+/g,'_')]??5;
}
function parseImportRag(raw){
  const s=String(raw==null?'':raw).trim().toLowerCase();
  if(!s) return 'g';
  if(s==='g'||s==='green'||s.startsWith('g')) return 'g';
  if(s==='a'||s==='amber'||s==='yellow'||s.startsWith('a')||s.startsWith('y')) return 'a';
  if(s==='r'||s==='red'||s.startsWith('r')) return 'r';
  return 'g';
}
function parseImportDate(raw){
  if(raw==null||raw==='') return '';
  if(raw instanceof Date&&!isNaN(raw.getTime())) return fmt(raw);
  const s=String(raw).trim();
  if(!s) return '';
  // ISO / YYYY-MM-DD
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  // Excel serial (when exported oddly as number text)
  if(/^\d+(\.\d+)?$/.test(s)){
    const n=parseFloat(s);
    if(n>20000&&n<80000){
      const epoch=new Date(Date.UTC(1899,11,30));
      const d=new Date(epoch.getTime()+Math.round(n)*86400000);
      return fmt(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
    }
  }
  // d-MMM-yy / d-MMM-yyyy / d MMM yy
  m=s.match(/^(\d{1,2})[-\/\s]+([A-Za-z]{3})[-\/\s]+(\d{2,4})$/);
  if(m){
    const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const mo=months[m[2].toLowerCase()];
    if(mo!=null){
      let y=parseInt(m[3],10);
      if(y<100) y+=2000;
      return fmt(new Date(y,mo,parseInt(m[1],10)));
    }
  }
  // d/m/yyyy or m/d/yyyy — prefer DMY when day>12
  m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){
    let a=parseInt(m[1],10),b=parseInt(m[2],10),y=parseInt(m[3],10);
    if(y<100) y+=2000;
    let day,month;
    if(a>12){ day=a; month=b; }
    else if(b>12){ day=b; month=a; }
    else { day=a; month=b; } // assume D/M when ambiguous (client template locale)
    if(month>=1&&month<=12&&day>=1&&day<=31) return fmt(new Date(y,month-1,day));
  }
  const d=new Date(s);
  if(!isNaN(d.getTime())) return fmt(d);
  return '';
}
function parentWbsFromWbs(wbs){
  const parts=String(wbs||'').split('.').map(p=>p.trim()).filter(Boolean);
  if(parts.length<=1) return null;
  parts.pop();
  return parts.join('.')||null;
}
function buildImportRowsFromMatrix(matrix){
  if(!matrix||matrix.length<2) throw new Error('File appears empty.');
  // Find header row (first non-empty with Name/Level/WBS)
  let headerIdx=0;
  for(let i=0;i<Math.min(matrix.length,10);i++){
    const cells=(matrix[i]||[]).map(c=>String(c==null?'':c).trim()).filter(Boolean);
    if(!cells.length) continue;
    const norms=cells.map(normalizePlanHeader);
    if(norms.includes('name')||norms.includes('level')||norms.includes('wbs')){ headerIdx=i; break; }
  }
  const headerCells=matrix[headerIdx]||[];
  const headers=headerCells.map(normalizePlanHeader);
  const colIndex=(key)=>{
    const i=headers.indexOf(key);
    return i;
  };
  const rows=[];
  let errors=0;
  for(let r=headerIdx+1;r<matrix.length;r++){
    const cols=matrix[r]||[];
    if(!cols.some(c=>String(c==null?'':c).trim())) continue;
    const get=(key)=>{
      const i=colIndex(key);
      if(i<0) return '';
      const v=cols[i];
      if(v instanceof Date) return v;
      return v==null?'':v;
    };
    const name=String(get('name')||'').trim();
    if(!name){ errors++; continue; }
    const type=parseLevelType(get('level'));
    let start=parseImportDate(get('start'));
    let end=parseImportDate(get('end'));
    const durRaw=get('duration');
    const duration=parseInt(String(durRaw==null?'':durRaw).replace(/[^\d]/g,''),10);
    if(!start&&end) start=end;
    if(start&&!end){
      if(type===6) end=start;
      else if(duration>0) end=fmt(addDays(D(start),Math.max(0,duration-1)));
      else end=start;
    }
    if(!start){ errors++; continue; }
    if(type===6) end=start;
    const wbs=String(get('wbs')||('IMP-'+(rows.length+1))).trim();
    let parentWbs=String(get('parent_wbs')||'').trim()||null;
    if(!parentWbs) parentWbs=parentWbsFromWbs(wbs);
    const pred=String(get('depends_on')||'').trim()||null;
    rows.push({
      wbs,
      name,
      type,
      parentWbs,
      predecessorWbs:pred,
      owner:String(get('owner')||'').trim(),
      start,
      end:end||start,
      progress:parseInt(String(get('progress')||'0'),10)||0,
      rag:parseImportRag(get('rag')),
      notes:String(get('notes')||'').trim(),
      depType:String(get('dep_type')||'FS').trim().toUpperCase()||'FS',
    });
  }
  if(!rows.length) throw new Error('No valid rows found. Need Name, Level/Type, and Start (or End).');
  return {rows,errors};
}
function parseCSV(file){
  showLoading('Reading CSV…');
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const text=String(e.target.result||'');
      const lines=text.split(/\r?\n/).filter(l=>l.trim().length);
      const matrix=lines.map(line=>parseCSVLine(line));
      const {rows,errors}=buildImportRowsFromMatrix(matrix);
      hideLoading();
      await applyImportedRows(rows,'CSV');
      if(errors>0) showImportResult('success','✅ Imported '+rows.length+' items from CSV ('+errors+' rows skipped).');
    }catch(err){
      hideLoading();
      showImportResult('error',err.message||'CSV import failed');
      showToast('Import failed','err',2800);
    }
  };
  reader.onerror=()=>{hideLoading();showToast('Could not read file','err',2800);};
  reader.readAsText(file);
}
function loadSheetJS(){
  return new Promise((resolve,reject)=>{
    if(window.XLSX){ resolve(window.XLSX); return; }
    const existing=document.querySelector('script[data-gantt-xlsx]');
    if(existing){
      if(existing.dataset.failed==='1'){
        existing.remove();
      } else {
        const onLoad=()=>{ cleanup(); window.XLSX?resolve(window.XLSX):reject(new Error('SheetJS failed to load')); };
        const onErr=()=>{ cleanup(); existing.dataset.failed='1'; existing.remove(); reject(new Error('SheetJS failed to load')); };
        const cleanup=()=>{ existing.removeEventListener('load',onLoad); existing.removeEventListener('error',onErr); };
        existing.addEventListener('load',onLoad);
        existing.addEventListener('error',onErr);
        return;
      }
    }
    const s=document.createElement('script');
    s.src='https://cdn.sheetjs.com/xlsx-0.18.5/package/dist/xlsx.full.min.js';
    s.async=true;
    s.dataset.ganttXlsx='1';
    s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('SheetJS failed to load'));
    s.onerror=()=>{ s.dataset.failed='1'; s.remove(); reject(new Error('Could not load Excel parser. Save as CSV and try again.')); };
    document.head.appendChild(s);
  });
}
function parseExcelPlanFile(file){
  showLoading('Reading Excel…');
  loadSheetJS().then(XLSX=>{
    const reader=new FileReader();
    reader.onload=async e=>{
      try{
        const data=new Uint8Array(e.target.result);
        const wb=XLSX.read(data,{type:'array',cellDates:true});
        const sheetName=wb.SheetNames[0];
        if(!sheetName) throw new Error('Workbook has no sheets.');
        const sheet=wb.Sheets[sheetName];
        const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:false});
        const {rows,errors}=buildImportRowsFromMatrix(matrix);
        hideLoading();
        await applyImportedRows(rows,'Excel');
        if(errors>0) showImportResult('success','✅ Imported '+rows.length+' items from Excel ('+errors+' rows skipped).');
      }catch(err){
        hideLoading();
        showImportResult('error',err.message||'Excel import failed');
        showToast('Import failed','err',2800);
      }
    };
    reader.onerror=()=>{hideLoading();showToast('Could not read file','err',2800);};
    reader.readAsArrayBuffer(file);
  }).catch(err=>{
    hideLoading();
    showImportResult('error',err.message||'Excel import failed');
    showToast('Import failed','err',2800);
  });
}
function parseCSVLine(line){
  const result=[];let cur='';let inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){result.push(cur);cur='';}
    else cur+=c;
  }
  result.push(cur);return result;
}
function showImportResult(type,msg){
  const el=document.getElementById('importResult');
  if(!el) return;
  el.style.cssText='padding:8px 12px;border-radius:5px;background:'+(type==='success'?'var(--green-l)':'var(--red-l)')+';color:'+(type==='success'?'var(--green)':'var(--red)')+';border:1px solid '+(type==='success'?'#86efac':'#fca5a5')+';';
  el.textContent=msg;
}

// ── SCROLL SYNC ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  setupScrollSync();
  setupPanelSplitter();
  document.querySelectorAll('.modal-bg').forEach(bg=>{
    bg.addEventListener('click',e=>{if(e.target===bg)bg.classList.remove('open');});
  });
});

// ══════════════════════════════════════════════════════════════
// INLINE CELL EDITING — fast click + Tab / Shift+Tab navigation
// ══════════════════════════════════════════════════════════════
const IE_BASE_FIELDS=['name','type','owner','start','end','duration','pred','prog'];

function getIeFields(){
  const fields=[];
  // name always in tab order when visible (locked on)
  if(isFieldVisible('name')) fields.push('name');
  ['type','owner','start','end','duration','pred','prog'].forEach(f=>{
    if(isFieldVisible(f)) fields.push(f);
  });
  customCols.forEach(c=>{
    const key='custom:'+c.id;
    if(isFieldVisible(key)) fields.push(key);
  });
  return fields;
}
function queueCellEdit(id,field,draftValue){
  pendingCellEdit={id,field};
  pendingCellEditValue=draftValue!=null?String(draftValue):null;
}
function flushPendingCellEdit(){
  if(!pendingCellEdit) return;
  const next=pendingCellEdit;
  const draft=pendingCellEditValue;
  pendingCellEdit=null;
  pendingCellEditValue=null;
  const snap=captureGanttScroll();
  requestAnimationFrame(()=>{
    beginCellEdit(next.id,next.field);
    if(draft!=null){
      const inp=document.querySelector('#tr-'+next.id+' .ie-cell.editing input, #tr-'+next.id+' .ie-cell.editing select');
      if(inp&&inp.tagName==='INPUT'){
        inp.value=draft;
        focusNoScroll(inp,true);
      }
    }
    restoreGanttScroll(snap);
    requestAnimationFrame(()=>restoreGanttScroll(snap));
  });
}
function resolveNextIeCell(id,field,dir){
  const visible=getVisible();
  let rowIdx=visible.findIndex(t=>t.id===id);
  if(rowIdx<0) return null;
  const fields=getIeFields();
  let fIdx=fields.indexOf(field);
  if(fIdx<0) fIdx=dir>0?-1:fields.length;
  let r=rowIdx, f=fIdx+dir;
  while(r>=0&&r<visible.length){
    if(f>=0&&f<fields.length) return {id:visible[r].id, field:fields[f]};
    if(dir>0){ r++; f=0; }
    else { r--; f=fields.length-1; }
  }
  return null;
}
function findIeCell(id,field){
  const row=document.getElementById('tr-'+id);
  if(!row) return null;
  return row.querySelector('[data-ie-field="'+field+'"]');
}
/** Finish edit: optional navigate via Tab; avoids double-commit races */
function finishInlineEdit(opts){
  const navigate=opts&&opts.navigate;
  // Default to light panel-only refresh unless caller opts into a full chart rebuild
  const light=!(opts&&opts.light===false);
  if(navigate) queueCellEdit(navigate.id,navigate.field);
  const snap=captureGanttScroll();
  if(light){
    renderTaskPanel();
  } else {
    renderAll();
  }
  restoreGanttScroll(snap);
  requestAnimationFrame(()=>restoreGanttScroll(snap));
}
function bindIeKeys(el,id,field,commit,cancel){
  el.addEventListener('keydown',e=>{
    if(e.key==='Tab'){
      e.preventDefault();
      e.stopPropagation();
      const next=resolveNextIeCell(id,field,e.shiftKey?-1:1);
      commit(next);
      return;
    }
    if(e.key==='Enter'){
      e.preventDefault();
      // Enter = save and move down same column (spreadsheet feel)
      const visible=getVisible();
      const rowIdx=visible.findIndex(t=>t.id===id);
      const nextRow=rowIdx>=0&&rowIdx<visible.length-1?visible[rowIdx+1]:null;
      commit(nextRow?{id:nextRow.id,field}:null);
      return;
    }
    if(e.key==='Escape'){
      e.preventDefault();
      cancel();
    }
  });
}
function beginCellEdit(id,field){
  const t=tasks.find(x=>x.id===id);
  if(!t) return;
  selectTask(id);
  const cell=findIeCell(id,field);
  if(!cell) return;
  if(cell.classList.contains('editing')) return;

  if(field==='name') return ieEditName(id,cell);
  if(field==='type') return ieEditType(id,cell);
  if(field==='owner') return ieEditOwner(id,cell);
  if(field==='start'||field==='end') return ieEditDate(id,field,cell);
  if(field==='duration') return ieEditDuration(id,cell);
  if(field==='pred') return ieEditPred(id,cell);
  if(field==='prog') return ieEditProg(id,cell);
  if(field.startsWith('custom:')) return ieEditCustom(id,field.slice(7),cell);
}

function ieEditName(id,cell){
  const t=tasks.find(x=>x.id===id); if(!t) return;
  cell.classList.add('editing');
  const original=t.name||'';
  const inp=document.createElement('input');
  inp.type='text';
  inp.className='ie-input';
  inp.value=original;
  cell.textContent='';
  cell.appendChild(inp);
  focusNoScroll(inp,true);
  let done=false;
  const cancel=()=>{
    if(done) return;
    done=true;
    finishInlineEdit({light:true});
  };
  const commit=(navigate)=>{
    if(done) return;
    done=true;
    const next=(inp.value||'').trim()||original;
    if(next!==original){
      pushHistory();
      t.name=next;
      void persistSave(t);
      const barLbl=document.querySelector('#bar-'+id+' .bar-label');
      if(barLbl) barLbl.textContent=next;
    }
    finishInlineEdit({navigate, light:true});
  };
  bindIeKeys(inp,id,'name',commit,cancel);
  inp.addEventListener('blur',()=>{ if(!done) commit(null); });
}

function ieEditType(id,cell){
  const t=tasks.find(x=>x.id===id); if(!t) return;
  if(t.type===1||t.id===1){ showToast('Project type is fixed','info',2200); return; }
  cell.classList.add('editing');
  const hasKids=getChildren(t.id).length>0;
  const original=t.type;
    const sel=document.createElement('select');
    sel.className='ie-select';
  // Folders: Task/Milestone are not valid — offer container types
  const opts=hasKids
    ?[[2,'Phase'],[3,'Workstream'],[4,'Activity'],[0,'Program'],[7,'Release']]
    :[[2,'Phase'],[3,'Workstream'],[4,'Activity'],[5,'Task'],[6,'Milestone'],[0,'Program'],[7,'Release']];
  const cur=effectiveType(t);
  opts.forEach(([val,label])=>{
    const opt=document.createElement('option');
    opt.value=String(val); opt.textContent=label;
    if(val===cur) opt.selected=true;
    sel.appendChild(opt);
  });
  cell.innerHTML=''; cell.appendChild(sel); sel.focus();
  let done=false;
  const commit=(navigate)=>{
    if(done) return;
    done=true;
    let next=parseInt(sel.value,10);
    if(hasKids&&(next===5||next===6)) next=suggestedContainerType(t);
    if(next!==original){
      pushHistory();
      t.type=next;
      t.color=LEVEL_COLORS[next]||t.color;
      void persistSave(t);
    }
    finishInlineEdit({navigate, light:false});
  };
  const cancel=()=>{ if(done) return; done=true; finishInlineEdit({light:true}); };
  bindIeKeys(sel,id,'type',commit,cancel);
  sel.addEventListener('change',()=>{ if(!done) commit(null); });
  sel.addEventListener('blur',()=>{ if(!done) commit(null); });
}

function ieEditOwner(id,cell){
  const t=tasks.find(x=>x.id===id); if(!t) return;
  cell.classList.add('editing');
  const original=t.owner||'';
  const sel=document.createElement('select');
  sel.className='ie-select';
  const choices=OWNERS.length?['',...OWNERS]:[''];
  choices.forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o; opt.textContent=o||'— Unassigned';
    if(o===original) opt.selected=true;
    sel.appendChild(opt);
  });
  cell.innerHTML=''; cell.appendChild(sel); sel.focus();
  let done=false;
  const commit=(navigate)=>{
    if(done) return;
    done=true;
    const next=sel.value;
    if(next!==original){ pushHistory(); t.owner=next; void persistSave(t); }
    finishInlineEdit({navigate, light:true});
  };
  const cancel=()=>{ if(done) return; done=true; finishInlineEdit({light:true}); };
  bindIeKeys(sel,id,'owner',commit,cancel);
  sel.addEventListener('blur',()=>{ if(!done) commit(null); });
}

function ieEditDate(id,field,cell){
  const t=tasks.find(x=>x.id===id); if(!t) return;
  if(getChildren(t.id).length) return;
  cell.classList.add('editing');
  const original=t[field]||'';
    const inp=document.createElement('input');
  inp.type='date';
    inp.className='ie-input';
    inp.value=original;
  cell.innerHTML=''; cell.appendChild(inp); inp.focus();
  let done=false;
  const commit=(navigate)=>{
    if(done) return;
    done=true;
    const next=inp.value;
    if(next&&next!==original){
      pushHistory();
      t[field]=next;
      if(field==='start'&&D(t.end)<D(t.start)) t.end=t.start;
      if(field==='end'&&D(t.end)<D(t.start)) t.start=t.end;
      if(autoSchedule) applyAutoSchedule();
      void persistSave(t);
      if(autoSchedule) void persistScheduleChanges(t);
      finishInlineEdit({navigate, light:false});
      return;
    }
    finishInlineEdit({navigate, light:true});
  };
  const cancel=()=>{ if(done) return; done=true; finishInlineEdit({light:true}); };
  bindIeKeys(inp,id,field,commit,cancel);
  inp.addEventListener('change',()=>{ /* wait for blur/tab */ });
  inp.addEventListener('blur',()=>{ if(!done) commit(null); });
}

function ieEditDuration(id,cell){
  const t=tasks.find(x=>x.id===id);
  if(!t||getChildren(t.id).length||t.type===6) return;
  cell.classList.add('editing');
  const original=taskDuration(t);
  const inp=document.createElement('input');
  inp.className='ie-input'; inp.type='number'; inp.min=0; inp.step=1; inp.value=original;
  cell.innerHTML=''; cell.appendChild(inp); inp.focus(); inp.select();
  let done=false;
  const commit=(navigate)=>{
    if(done) return;
    done=true;
    const days=Math.max(0,parseInt(inp.value,10)||0);
    if(days!==original){
      pushHistory();
      setTaskDuration(t,days);
      afterTaskDateChange(t);
      return; // afterTaskDateChange likely renderAll — queue nav first
    }
    finishInlineEdit({navigate});
  };
  const commitSafe=(navigate)=>{
    if(done) return;
    done=true;
    const days=Math.max(0,parseInt(inp.value,10)||0);
    if(days!==original){
      pushHistory();
      setTaskDuration(t,days);
      if(navigate) queueCellEdit(navigate.id,navigate.field);
      afterTaskDateChange(t);
      flushPendingCellEdit();
      return;
    }
    finishInlineEdit({navigate});
  };
  const cancel=()=>{ if(done) return; done=true; finishInlineEdit({light:true}); };
  bindIeKeys(inp,id,'duration',commitSafe,cancel);
  inp.addEventListener('blur',()=>{ if(!done) commitSafe(null); });
}

function ieEditPred(id,cell){
  const t=tasks.find(x=>x.id===id);
  if(!t) return;
  if(getChildren(t.id).length){
    showToast('Folder rows can’t have predecessors — pick a Task or Activity','info',3200);
    return;
  }
  if(t.type===1||t.id===1){ showToast('Project row cannot have a predecessor','info',2800); return; }
  cell.classList.add('editing');
  const sel=document.createElement('select');
  sel.className='ie-select';
  const none=document.createElement('option');
  none.value=''; none.textContent='— None'; sel.appendChild(none);
  const opts=persistablePredOptions(id);
  if(!opts.length){
    const o=document.createElement('option');
    o.disabled=true;
    o.textContent='(No other tasks to link)';
    sel.appendChild(o);
  }
  opts.forEach(x=>{
    const o=document.createElement('option');
    o.value=String(x.id);
    o.textContent=(x.wbs?x.wbs+' · ':'')+x.name;
    if(t.predId===x.id) o.selected=true;
    sel.appendChild(o);
  });
  cell.innerHTML=''; cell.appendChild(sel); sel.focus();
  let done=false;
  const commit=(navigate)=>{
    if(done) return;
    done=true;
    const v=sel.value?parseInt(sel.value,10):null;
    const changed=v!==t.predId;
    let datesMoved=false;
    if(changed){
      pushHistory();
      t.predId=v;
      if(v&&!t.depType) t.depType='FS';
      if(!v) t.depType='FS';
      if(autoSchedule) datesMoved=!!applyAutoSchedule();
      void persistSave(t);
      if(autoSchedule) void persistScheduleChanges(t);
    }
    if(navigate) queueCellEdit(navigate.id,navigate.field);
    if(!changed){
      finishInlineEdit({navigate, light:true});
      return;
    }
    if(datesMoved){
    renderAll();
    } else {
      cell.classList.remove('editing');
      cell.innerHTML='<span class="pred-val">'+esc(formatPred(t))+'</span>';
      softRefreshAfterDepChange(id);
      flushPendingCellEdit();
    }
    if(showCP){
      if(v&&criticalIds.size) showToast('Critical path updated ('+criticalIds.size+')','ok',2000);
      else if(v) showToast('Predecessor saved','ok',1800);
      else showToast('Predecessor cleared','info',1800);
    }
  };
  const cancel=()=>{ if(done) return; done=true; finishInlineEdit({}); };
  bindIeKeys(sel,id,'pred',commit,cancel);
  sel.addEventListener('blur',()=>{ if(!done) commit(null); });
}

function ieEditProg(id,cell){
  const t=tasks.find(x=>x.id===id); if(!t) return;
  cell.classList.add('editing','editing-prog');
  const original=Number(t.prog)||0;
  const wrap=document.createElement('div');
  wrap.className='ie-prog-editor';
  const range=document.createElement('input');
  range.type='range'; range.min='0'; range.max='100'; range.step='1';
  range.className='ie-prog-range';
  range.value=String(original);
  range.title='Drag to set progress';
  const inp=document.createElement('input');
  inp.type='number'; inp.min='0'; inp.max='100'; inp.step='1';
  inp.className='ie-input ie-prog-num';
  inp.value=String(original);
  inp.setAttribute('aria-label','Progress percent');
  const suffix=document.createElement('span');
  suffix.className='ie-prog-suffix';
  suffix.textContent='%';
  wrap.appendChild(range);
  wrap.appendChild(inp);
  wrap.appendChild(suffix);
  cell.innerHTML='';
  cell.appendChild(wrap);
  const syncUi=(v)=>{
    range.value=String(v);
    inp.value=String(v);
    paintProgVisuals(id,v);
  };
  range.addEventListener('input',()=>{
    const v=Math.max(0,Math.min(100,parseInt(range.value,10)||0));
    syncUi(v);
  });
  inp.addEventListener('input',()=>{
    const raw=inp.value;
    if(raw===''||raw==='-') return;
    const v=Math.max(0,Math.min(100,parseInt(raw,10)||0));
    syncUi(v);
  });
  inp.focus();
  inp.select();
  let done=false;
  const commit=(navigate)=>{
    if(done) return;
    done=true;
    const next=Math.max(0,Math.min(100,parseInt(inp.value,10)||0));
    if(next!==original){
      pushHistory();
      t.prog=next;
      void persistSave(t);
    } else {
      paintProgVisuals(id,next);
    }
    finishInlineEdit({navigate, light:true});
  };
  const cancel=()=>{
    if(done) return;
    done=true;
    t.prog=original;
    paintProgVisuals(id,original);
    finishInlineEdit({light:true});
  };
  bindIeKeys(inp,id,'prog',commit,cancel);
  bindIeKeys(range,id,'prog',commit,cancel);
  const onBlur=(e)=>{
    if(done) return;
    const next=e&&e.relatedTarget;
    if(next&&wrap.contains(next)) return;
    // Defer so a click on another cell can start first
    setTimeout(()=>{ if(!done) commit(null); },0);
  };
  inp.addEventListener('blur',onBlur);
  range.addEventListener('blur',onBlur);
}

function progColor(p){
  const v=Number(p)||0;
  return v>=70?'#059669':v>=40?'#d97706':'#dc2626';
}

function paintProgVisuals(id,pct){
  const v=Math.max(0,Math.min(100,Math.round(Number(pct)||0)));
  const cell=findIeCell(id,'prog');
  if(cell&&!cell.classList.contains('editing')){
    const fill=cell.querySelector('.prog-fill');
    const label=cell.querySelector('.prog-pct');
    if(fill){
      fill.style.width=v+'%';
      fill.style.background=progColor(v);
    }
    if(label) label.textContent=v+'%';
  }
  const barFill=document.querySelector('#bar-'+id+' .bar-prog-fill');
  if(barFill) barFill.style.width=v+'%';
}

function startProgBarDrag(e,id){
  if(!e||e.button!=null&&e.button!==0) return;
  const t=tasks.find(x=>x.id===id);
  if(!t) return;
  const cell=findIeCell(id,'prog');
  if(!cell||cell.classList.contains('editing')) return;
  e.preventDefault();
  selectTask(id);
  const track=cell.querySelector('.prog-track')||cell;
  const original=Number(t.prog)||0;
  let latest=original;
  let moved=false;
  let historyPushed=false;
  const startX=e.clientX;
  const apply=(clientX)=>{
    const r=track.getBoundingClientRect();
    const pct=((clientX-r.left)/Math.max(1,r.width))*100;
    const next=Math.max(0,Math.min(100,Math.round(pct)));
    if(next===latest&&moved) return;
    if(next!==original){
      if(!historyPushed){ pushHistory(); historyPushed=true; }
      moved=true;
    }
    latest=next;
    t.prog=latest;
    paintProgVisuals(id,latest);
  };
  apply(e.clientX);
  const onMove=(ev)=>{
    if(Math.abs(ev.clientX-startX)>3) moved=true;
    apply(ev.clientX);
  };
  const onUp=()=>{
    document.removeEventListener('pointermove',onMove,true);
    document.removeEventListener('pointerup',onUp,true);
    document.removeEventListener('pointercancel',onUp,true);
    if(!moved||latest===original){
      t.prog=original;
      paintProgVisuals(id,original);
      beginCellEdit(id,'prog');
      return;
    }
    void persistSave(t);
    showToast('Progress '+latest+'%','ok',1400);
  };
  document.addEventListener('pointermove',onMove,true);
  document.addEventListener('pointerup',onUp,true);
  document.addEventListener('pointercancel',onUp,true);
}
window.startProgBarDrag=startProgBarDrag;

function ieEditCustom(id,colId,cell){
  const t=tasks.find(x=>x.id===id); if(!t) return;
  if(!t.customData) t.customData={};
  const col=customCols.find(c=>String(c.id)===String(colId)); if(!col) return;
  const field='custom:'+colId;
  const key=col.id;
  cell.classList.add('editing');
  const original=t.customData[key]!=null?String(t.customData[key]):'';
  let done=false;
  const finish=(navigate,next)=>{
    if(done) return;
    done=true;
    if(String(next)!==String(original)){
      pushHistory();
      t.customData[key]=next;
      void persistSave(t);
    }
    finishInlineEdit({navigate, light:true});
  };
  const cancel=()=>{ if(done) return; done=true; finishInlineEdit({light:true}); };
  const type=col.type||'text';

  if(type==='checkbox'){
    const wrap=document.createElement('label');
    wrap.style.cssText='display:flex;align-items:center;justify-content:center;width:100%;height:100%;cursor:pointer;';
  const inp=document.createElement('input');
    inp.type='checkbox';
    inp.checked=original==='1'||original==='true'||original==='yes';
    wrap.appendChild(inp);
    cell.innerHTML=''; cell.appendChild(wrap);
    inp.focus();
    const read=()=>inp.checked?'1':'';
    bindIeKeys(inp,id,field,nav=>finish(nav,read()),cancel);
    inp.addEventListener('change',()=>{});
    inp.addEventListener('blur',()=>{ if(!done) finish(null,read()); });
    return;
  }

  if(type==='select'){
    const sel=document.createElement('select');
    sel.className='ie-select';
    const blank=document.createElement('option');
    blank.value=''; blank.textContent='—';
    sel.appendChild(blank);
    (col.opts||[]).forEach(o=>{
      const opt=document.createElement('option');
      opt.value=o; opt.textContent=o;
      if(o===original) opt.selected=true;
      sel.appendChild(opt);
    });
    cell.innerHTML=''; cell.appendChild(sel); sel.focus();
    bindIeKeys(sel,id,field,nav=>finish(nav,sel.value),cancel);
    sel.addEventListener('blur',()=>{ if(!done) finish(null,sel.value); });
    return;
  }

  const inp=document.createElement('input');
  inp.className='ie-input';
  if(type==='date') inp.type='date';
  else if(type==='number'){ inp.type='number'; inp.step='any'; }
  else inp.type='text';
  inp.value=original;
  cell.innerHTML=''; cell.appendChild(inp); inp.focus();
  if(type!=='date') try{ inp.select(); }catch(e){}
  bindIeKeys(inp,id,field,nav=>finish(nav,inp.value.trim()),cancel);
  inp.addEventListener('blur',()=>{ if(!done) finish(null,inp.value.trim()); });
}

function makeEditable(td, task, field, options=null){
  // Legacy helper kept for any remaining callers — prefer beginCellEdit
  if(td.classList.contains('editing')) return;
  td.classList.add('editing');
  const original=String(task[field]||'');
  if(options?.type==='select'){
    const sel=document.createElement('select');
    sel.className='ie-select';
    options.choices.forEach(([val,label])=>{
      const o=document.createElement('option');
      o.value=val;o.textContent=label||val;
      if(String(val)===original) o.selected=true;
      sel.appendChild(o);
    });
    td.innerHTML='';td.appendChild(sel);sel.focus();
    let done=false;
  const commit=()=>{
      if(done) return; done=true;
      const val=sel.value;
      if(String(val)!==original) pushHistory();
      task[field]=val;
      td.classList.remove('editing');
      renderAll();
      if(!isUnsavedLocal(task)) persistSave(task);
      if(options?.onCommit) options.onCommit();
    };
    sel.onchange=commit;sel.onblur=()=>{ if(!done) commit(); };
  } else if(options?.type==='range'){
    const wrap=document.createElement('div');
    wrap.style.cssText='display:flex;align-items:center;gap:3px;width:100%;';
    const inp=document.createElement('input');
    inp.type='range';inp.min=0;inp.max=100;inp.step=5;inp.value=task[field];
    inp.style.cssText='flex:1;height:3px;cursor:pointer;';
    const lbl=document.createElement('span');
    lbl.style.cssText='font-size:9px;font-family:var(--mono);color:var(--g600);min-width:24px;';
    lbl.textContent=task[field]+'%';
    inp.oninput=()=>{lbl.textContent=inp.value+'%';};
    let done=false;
    inp.onchange=()=>{if(Number(inp.value)!==Number(original)) pushHistory();task[field]=Number(inp.value);if(!isUnsavedLocal(task)) persistSave(task);};
    inp.onblur=()=>{if(done) return; done=true; task[field]=Number(inp.value);td.classList.remove('editing');renderAll();};
    wrap.appendChild(inp);wrap.appendChild(lbl);
    td.innerHTML='';td.appendChild(wrap);inp.focus();
  } else {
    const inp=document.createElement('input');
    inp.className='ie-input';
    inp.type=options?.type||'text';
    inp.value=original;
    td.innerHTML='';td.appendChild(inp);inp.focus();inp.select();
    let done=false;
    const commit=()=>{
      if(done) return; done=true;
      const v=inp.value.trim();
      if(v&&v!==original) pushHistory();
      if(v) task[field]=v;
      td.classList.remove('editing');
      renderAll();
      if(!isUnsavedLocal(task)) persistSave(task);
      if(options?.onCommit) options.onCommit();
    };
    inp.onblur=()=>{ if(!done) commit(); };
  inp.onkeydown=(e)=>{
    if(e.key==='Enter'){e.preventDefault();commit();}
      if(e.key==='Escape'){done=true;td.classList.remove('editing');renderAll();}
    };
  }
}

function inlineEditPred(id,cell){ beginCellEdit(id,'pred'); }
function inlineEditOwner(id,cell){ beginCellEdit(id,'owner'); }
function inlineEditDate(id,field,cell){ beginCellEdit(id,field); }
function inlineEditDuration(id,cell){ beginCellEdit(id,'duration'); }
function inlineEditProg(id,cell){ beginCellEdit(id,'prog'); }
function cycleRagDim(id,dim){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  const field=dim==='bgt'?'ragBgt':dim==='sch'?'ragSch':'ragScp';
  const cycle={g:'a',a:'r',r:'g'};
  pushHistory();
  t[field]=cycle[ragField(t,dim)]||'g';
  if(field==='ragScp') t.rag=t.ragScp;
  renderAll();
  void persistSave(t);
}
function cycleRag(id){ cycleRagDim(id,'scp'); }

function bindCustomCellClicks(){
  // Clicks handled via data-ie-field + beginCellEdit in row HTML; keep for safety
  document.querySelectorAll('.task-custom-col[data-col]').forEach(cell=>{
    if(cell._ieBound) return;
    cell._ieBound=true;
    cell.addEventListener('click',e=>{
      e.stopPropagation();
      const id=Number(cell.dataset.id);
      const colId=cell.dataset.col;
      beginCellEdit(id,'custom:'+colId);
    });
  });
}

window.beginCellEdit=beginCellEdit;

// ══════════════════════════════════════════════════════════════
// INTERACTIVE DEPENDENCY DRAWING — ClickUp / Kendo style
// Hover bar → connector dots on ends → drag to another bar to link
// ══════════════════════════════════════════════════════════════
let depLinkDragging=false;

function clearDepDragLine(){
  const line=document.getElementById('depDragLine');
  if(line) line.remove();
  document.querySelectorAll('.gantt-bar.dep-drop-ok,.gantt-bar.dep-drop-bad,.gantt-bar.dep-source').forEach(b=>{
    b.classList.remove('dep-drop-ok','dep-drop-bad','dep-source');
  });
}
function ensureDepDragLine(){
  let line=document.getElementById('depDragLine');
  if(line) return line;
  line=document.createElement('div');
  line.id='depDragLine';
  line.className='dep-drag-line';
  document.body.appendChild(line);
  return line;
}
function updateDepDragLine(x1,y1,x2,y2,ok){
  const line=ensureDepDragLine();
  const dx=x2-x1, dy=y2-y1;
  const len=Math.sqrt(dx*dx+dy*dy);
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  line.style.left=x1+'px';
  line.style.top=(y1-1.5)+'px';
  line.style.width=Math.max(0,len)+'px';
  line.style.transform='rotate('+angle+'deg)';
  line.classList.toggle('is-invalid',!ok);
}
function showDepToast(msg){
  let toast=document.getElementById('depToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='depToast';
    toast.className='dep-toast';
    document.body.appendChild(toast);
  }
  clearTimeout(toast._hideT);
  if(msg){
    toast.textContent=msg;
    toast.classList.add('show');
    toast._hideT=setTimeout(()=>toast.classList.remove('show'),3500);
  } else {
    toast.classList.remove('show');
  }
}
function wouldCreateCycle(fromId,toId){
  let walk=fromId,guard=0;
  while(walk&&guard++<500){
    const node=tasks.find(x=>x.id===walk);
    if(!node||!node.predId) break;
    if(node.predId===toId) return true;
    walk=node.predId;
  }
  return false;
}
/** Leaf work items only — matches Pred column rules (no folders / project row) */
function canHavePredecessor(t){
  if(!t) return false;
  if(t.type===1||t.id===1) return false;
  if(getChildren(t.id).length) return false;
    return true;
  }
function canBePredecessor(t){
  return canHavePredecessor(t);
}
function depLinkRejectReason(fromId,toId){
  const from=tasks.find(x=>x.id===fromId);
  const to=tasks.find(x=>x.id===toId);
  if(!from||!to) return 'Task not found';
  if(fromId===toId) return 'Cannot link a task to itself';
  if(!canBePredecessor(from)) return 'Folder / project rows can’t be predecessors';
  if(!canHavePredecessor(to)) return 'Folder / project rows can’t have a predecessor';
  if(wouldCreateCycle(fromId,toId)) return 'That link would create a cycle';
  return null;
}
function resolveDropTarget(clientX,clientY,excludeId){
  const el=document.elementFromPoint(clientX,clientY);
  if(!el||!el.closest) return null;
  const handle=el.closest('.bar-dep-handle');
  const bar=el.closest('.gantt-bar');
  if(!bar||!bar.id||!bar.id.startsWith('bar-')) return null;
  const id=parseInt(bar.id.slice(4),10);
  if(!Number.isFinite(id)||id===excludeId) return null;
  // Default: enter the LEFT (start) of the target — standard Finish-to-Start.
  // Only treat as RIGHT (end) when the cursor is on the target’s end connector •
  let side='start';
  if(handle&&handle.classList.contains('bar-dep-handle-r')&&bar.contains(handle)){
    side='end';
  } else if(handle&&handle.classList.contains('bar-dep-handle-l')&&bar.contains(handle)){
    side='start';
  }
  return {id,el:bar,side,onHandle:!!handle};
}
/**
 * Connector drag → dependency type (monday.com defaults).
 * End handle → always Finish-to-Start (leave right, enter left).
 * Start handle → Start-to-Start.
 * Finish-to-Finish is set via the edit modal, not by dropping on a bar half.
 */
function depTypeFromHandles(fromSide,toSide){
  if(fromSide==='start') return 'SS';
  return 'FS';
}
/**
 * Drag from a connector handle on the predecessor onto another bar.
 * Dropping on the bar body always creates FS (arrow into the left).
 * Drop on the target end • for FF; drag from start • onto bar for SS.
 */
function startConnectorDrag(taskId,fromSide,e){
  if(!canBePredecessor(tasks.find(x=>x.id===taskId))){
    showDepToast('Folder / project rows can’t link dependencies');
    return;
  }
  depLinkDragging=true;
  depDrawMode=true;
  const srcEl=document.getElementById('bar-'+taskId);
  if(srcEl) srcEl.classList.add('dep-source');
  const startX=e.clientX, startY=e.clientY;
  showDepToast(fromSide==='end'
    ? 'Drop on a bar to link Finish→Start (arrow into the left)'
    : 'Drop on a bar to link Start→Start');

  const onMove=(ev)=>{
    const hit=resolveDropTarget(ev.clientX,ev.clientY,taskId);
    document.querySelectorAll('.gantt-bar.dep-drop-ok,.gantt-bar.dep-drop-bad').forEach(b=>{
      b.classList.remove('dep-drop-ok','dep-drop-bad');
    });
    let ok=false;
    if(hit){
      ok=!depLinkRejectReason(taskId,hit.id);
      hit.el.classList.add(ok?'dep-drop-ok':'dep-drop-bad');
    }
    updateDepDragLine(startX,startY,ev.clientX,ev.clientY,!!hit&&ok);
  };
  const onUp=(ev)=>{
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    const hit=resolveDropTarget(ev.clientX,ev.clientY,taskId);
    clearDepDragLine();
    depLinkDragging=false;
    depDrawMode=false;
    if(!hit){
      showDepToast('Link cancelled');
      return;
    }
    const reason=depLinkRejectReason(taskId,hit.id);
    if(reason){
      showDepToast(reason);
      return;
    }
    const type=depTypeFromHandles(fromSide,hit.side);
    createDepLink(taskId,hit.id,type);
  };
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
}
function createDepLink(fromId,toId,depType){
  const reason=depLinkRejectReason(fromId,toId);
  if(reason){
    showDepToast(reason);
    return false;
  }
  const targetTask=tasks.find(x=>x.id===toId);
  if(!targetTask) return false;
  // Connector links: FS (leave right → enter left) or SS only — never FF from drag
  let type=(depType||'FS').toUpperCase();
  if(type==='FF'||type==='EE') type='FS';
  if(type!=='SS') type='FS';
    pushHistory();
  targetTask.predId=fromId;
  targetTask.depType=type;
  let datesMoved=false;
  if(autoSchedule) datesMoved=!!applyAutoSchedule();
    pushHistory();
  const fromName=(tasks.find(x=>x.id===fromId)||{}).name||('#'+fromId);
  showDepToast('Linked ('+type+'): “'+fromName+'” → “'+targetTask.name+'”');
    if(!isUnsavedLocal(targetTask)){
    void persistSave(targetTask);
      if(autoSchedule) void persistScheduleChanges(targetTask);
    }
  if(datesMoved) renderAll();
  else softRefreshAfterDepChange(toId);
  return true;
}
function removeDepLink(succId){
  const t=tasks.find(x=>x.id===succId);
  if(!t||!t.predId) return;
  pushHistory();
  t.predId=null;
  t.depType='FS';
  pushHistory();
  showDepToast('Dependency removed');
  if(!isUnsavedLocal(t)) void persistSave(t);
  softRefreshAfterDepChange(succId);
}
// Legacy stubs (toolbar Link bars removed — connectors are always available)
function toggleDepDraw(){ showDepToast('Hover a bar and drag the • dots on either end to link tasks'); }
function handleBarClickForDep(){ return false; }
function beginDepDrag(){}
window.toggleDepDraw=toggleDepDraw;
window.removeDepLink=removeDepLink;

// API PERSISTENCE — all schedule rows are pm_tasks (unified)
// Project root is synthetic id 1; local unsaved rows use id >= 100000
// ══════════════════════════════════════════════════════════════
const RAG_TO_RAGSTATUS={g:'green',a:'amber',r:'red'};
const LOCAL_ID_BASE=100000;
function taskStatusFromGantt(t){
  if((t.prog||0)>=100) return 'done';
  if((t.prog||0)>0) return 'in_progress';
  return 'todo';
}
function notifyGanttParent(){
  const projectId=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||null;
  try{ window.parent.postMessage({type:'gantt-saved',projectId,soft:true},'*'); }catch(e){}
}

/** Update DOM ids after server assigns a real task id — avoids full chart rebuild mid-edit. */
function remapTaskDomIds(oldId,newId){
  if(oldId==null||newId==null||oldId===newId) return;
  if(checkedRowIds.has(oldId)){
    checkedRowIds.delete(oldId);
    checkedRowIds.add(newId);
  }
  ['tr-','tn-','bar-','gr-'].forEach(prefix=>{
    const el=document.getElementById(prefix+oldId);
    if(el) el.id=prefix+newId;
  });
  document.querySelectorAll('[data-id="'+oldId+'"]').forEach(el=>{
    el.setAttribute('data-id',String(newId));
  });
  document.querySelectorAll('[data-task-id="'+oldId+'"]').forEach(el=>{
    el.setAttribute('data-task-id',String(newId));
  });
  document.querySelectorAll('[data-prog-drag="'+oldId+'"]').forEach(el=>{
    el.setAttribute('data-prog-drag',String(newId));
  });
  // Inline onclick handlers embed the numeric id — refresh checkbox handler
  const row=document.getElementById('tr-'+newId);
  if(row){
    const cb=row.querySelector('.task-sel-cb');
    if(cb) cb.setAttribute('onclick',"event.stopPropagation();toggleRowCheck("+newId+",this.checked)");
  }
  if(barPos[oldId]){
    barPos[newId]=barPos[oldId];
    delete barPos[oldId];
  }
}

function ganttMeta(){
  const d=window.GANTT_INIT_DATA||{};
  return {projectId:d.projectId,tenantId:d.tenantId};
}

/** Ask parent React app for a fresh Supabase token (baked srcdoc token can expire). */
var _ganttAuthTokenCache={token:'',at:0};
function requestAuthTokenFromParent(){
  return new Promise(function(resolve){
    var cached=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.authToken)||'';
    var now=Date.now();
    if(_ganttAuthTokenCache.token&&(now-_ganttAuthTokenCache.at)<45000){
      resolve(_ganttAuthTokenCache.token);
      return;
    }
    if(!window.parent||window.parent===window){
      resolve(cached);
      return;
    }
    var requestId='gauth-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
    var done=false;
    var finish=function(token){
      if(done) return;
      done=true;
      window.removeEventListener('message',onMsg);
      clearTimeout(timer);
      var next=(token!=null&&token!=='')?String(token):cached;
      if(next){
        _ganttAuthTokenCache={token:next,at:Date.now()};
        if(window.GANTT_INIT_DATA) window.GANTT_INIT_DATA.authToken=next;
      }
      resolve(next||'');
    };
    var onMsg=function(e){
      if(!e.data||e.data.type!=='gantt-auth-token'||e.data.requestId!==requestId) return;
      finish(e.data.token||'');
    };
    window.addEventListener('message',onMsg);
    try{
      window.parent.postMessage({type:'gantt-auth-token-request',requestId:requestId},'*');
    }catch(err){
      finish(cached);
      return;
    }
    var timer=setTimeout(function(){ finish(cached); },2500);
  });
}

async function apiAuthHeaders(json){
  const h={};
  if(json) h['Content-Type']='application/json';
  let token=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.authToken)||'';
  try{
    const fresh=await requestAuthTokenFromParent();
    if(fresh) token=fresh;
  }catch(e){ /* keep baked token */ }
  if(token) h['Authorization']='Bearer '+token;
  return h;
}

function isUnsavedLocal(t){
  return !t || t.id>=LOCAL_ID_BASE;
}
function isLocalOnly(t){
  if(!t) return true;
  return t.id>=LOCAL_ID_BASE || t.id===1;
}
function engineTypeToGanttFields(type,hasKids){
  if(type===0) return {ganttType:'program',isSummary:true};
  if(type===1) return {ganttType:'project',isSummary:true};
  if(type===2) return {ganttType:'phase',isSummary:true};
  if(type===3) return {ganttType:'workstream',isSummary:true};
  if(type===4) return {ganttType:'activity',isSummary:true};
  if(type===6) return {ganttType:'milestone',isSummary:!!hasKids};
  if(type===7) return {ganttType:'release',isSummary:true};
  // Task with children is treated as a summary until type is promoted
  if(hasKids) return {ganttType:'activity',isSummary:true};
  return {ganttType:'task',isSummary:false};
}
function ganttIdToDbTaskId(ganttId){
  if(ganttId==null||ganttId===''||Number.isNaN(Number(ganttId))) return null;
  const id=Number(ganttId);
  if(id===1||id>=LOCAL_ID_BASE) return null;
  return id;
}
function predecessorIdsForSave(predId,extraPredIds){
  if(!predId){
    // No primary predecessor ⇒ extras alone aren't representable (primary is
    // what depType/the edge-back-to-this-task's type applies to); drop them
    // rather than save a predecessor set with no defined relationship type.
    return [];
  }
  const dbId=ganttIdToDbTaskId(predId);
  if(dbId==null) return null;
  const extraDbIds=Array.isArray(extraPredIds)
    ? extraPredIds.map(ganttIdToDbTaskId).filter(id=>id!=null&&id!==dbId)
    : [];
  return [dbId,...new Set(extraDbIds)];
}
function persistablePredOptions(excludeId){
  return tasks.filter(x=>x.id!==excludeId&&x.type!==1&&x.id!==1&&getChildren(x.id).length===0&&!isLocalOnly(x));
}

async function persistCreate(t,opts){
  const silent=!!(opts&&opts.silent);
  const {projectId,tenantId}=ganttMeta();
  if(!projectId||!tenantId) return;
  if(!t||!isLocalOnly(t)) return;
  if(createInFlight.has(t)) return createInFlight.get(t);
  const run=(async()=>{
  // No full-screen hourglass — row is already on screen; save in the background
  const h=await apiAuthHeaders(true);
  const post=async (url,body)=>{
    const res=await fetch(url,{method:'POST',credentials:'include',headers:h,body:JSON.stringify(body)});
    if(!res.ok) throw new Error((await res.text().catch(()=>''))||('HTTP '+res.status));
    return res.json();
  };
  const ownerMap=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.ownerIdMap)||{};
  const assigneeId=t.owner?ownerMap[t.owner]||null:null;
  const gt=engineTypeToGanttFields(t.type,getChildren(t.id).length>0);
  try{
    const parentTaskId=(t.parent&&t.parent!==1)?ganttIdToDbTaskId(t.parent):null;
    const predIds=predecessorIdsForSave(t.predId,t.extraPredIds)||[];
    const created=await post('/api/pm/tasks',{
      tenantId,projectId,
      name:t.name,
      plannedStartDate:t.start,
      plannedEndDate:t.type===6?t.start:t.end,
      progress:t.prog||0,
      status:taskStatusFromGantt(t),
      isSummary:gt.isSummary,
      ganttType:gt.ganttType,
      ragStatus:RAG_TO_RAGSTATUS[t.ragScp||t.rag]||'green',
      description:t.notes||null,
      parentTaskId,
      predecessorIds:predIds,
      depType:t.depType||'FS',
      assigneeId:assigneeId||null,
      order:tasks.filter(x=>x.type!==1).length,
    });
    if(created?.id){
      const oldId=t.id;
        let draft=null;
        const nameInp=document.querySelector('#tn-'+oldId+' input, #tr-'+oldId+' .task-name.editing input');
        if(nameInp) draft=nameInp.value;
        const wasEditing=draft!=null||!!document.querySelector('#tr-'+oldId+' .ie-cell.editing');
      t.id=created.id;
      // Remap children/preds that pointed at the temp local id — never rewrite this row onto itself
      tasks.filter(x=>x.id!==t.id&&(x.parent===oldId||x.predId===oldId)).forEach(c=>{
        if(c.parent===oldId) c.parent=t.id;
        if(c.predId===oldId) c.predId=t.id;
      });
      if(t.parent===oldId||t.parent===t.id) t.parent=null;
      if(selectedTaskId===oldId) selectedTaskId=t.id;
        if(checkedRowIds.has(oldId)){
          checkedRowIds.delete(oldId);
          checkedRowIds.add(t.id);
    }
        invalidateTaskIndex();
    calcWBS();
        if(wasEditing){
          // Keep typing — surgical id remap, no full chart rebuild
          if(draft!=null) t.name=(draft.trim()||t.name);
          remapTaskDomIds(oldId,t.id);
          updateUndoRedoButtons();
          updateSelectionBar();
        } else {
    renderAll();
        }
      }
    if(!silent) showSaveIndicator();
    notifyGanttParent();
  } catch(e){
    console.error('Gantt create failed:',e);
    showToast('Save failed: '+(e&&e.message?String(e.message).slice(0,100):'error'),'err',4000);
  }
  })();
  createInFlight.set(t,run);
  try{ await run; } finally { createInFlight.delete(t); }
}

async function persistDelete(t,silent){
  if(!t||t.type===1||t.id===1) return false;
  if(isLocalOnly(t)) return true;
  const h=await apiAuthHeaders();
  try{
    const res=await fetch('/api/pm/tasks/'+t.id,{method:'DELETE',credentials:'include',headers:h});
    if(!res.ok) throw new Error('HTTP '+res.status);
    if(!silent){
    showToast('✓ Deleted','ok');
    notifyGanttParent();
    }
    return true;
  } catch(e){
    console.error('Gantt delete failed:',e);
    if(!silent) showToast('Delete failed','err',2800);
    return false;
  }
}

async function persistDeletes(removed,predCleared){
  // `removed` is already deepest-first from removeTasksByIds
  const list=(removed||[]).filter(t=>t&&t.type!==1&&t.id!==1&&!isLocalOnly(t));
  let ok=0,fail=0;
  for(const t of list){
    const r=await persistDelete(t,true);
    if(r) ok++; else fail++;
  }
  const predList=(predCleared||[]).filter(t=>t&&!isUnsavedLocal(t));
  for(const t of predList){
    try{ await persistSave(t); }catch(e){ console.error('Gantt pred clear save failed:',e); }
  }
  if(!list.length&&!predList.length){
    notifyGanttParent();
    return;
  }
  if(list.length){
    if(fail&&!ok) showToast('Delete failed','err',2800);
    else if(fail) showToast('Deleted '+ok+', '+fail+' failed','err',3200);
    else showToast(ok===1?'✓ Deleted':'✓ Deleted '+ok+' lines','ok');
  }
  notifyGanttParent();
}

async function persistSave(t){
  if(!t||t.type===1||t.id===1){
    const projectId=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||null;
    if(!projectId) return false;
  const h=await apiAuthHeaders(true);
    try{
      const res=await fetch('/api/pm/projects/'+projectId,{
        method:'PUT',credentials:'include',headers:h,
        body:JSON.stringify({
          startDate:t.start||null,endDate:t.end||null,progress:t.prog||0,
          ragStatus:RAG_TO_RAGSTATUS[t.ragScp||t.rag]||'green',
          financialRag:RAG_TO_RAGSTATUS[t.ragBgt||t.rag]||'green',
          scheduleRag:RAG_TO_RAGSTATUS[t.ragSch||t.rag]||'green',
          description:t.notes||null,
        }),
      });
      if(!res.ok) throw new Error('HTTP '+res.status);
      showSaveIndicator();
      try{ window.parent.postMessage({type:'gantt-saved',projectId,soft:true},'*'); }catch(e){}
      return true;
    }catch(e){
      showToast('Save failed','err',3500);
      return false;
    }
  }
  if(isLocalOnly(t)){
    await persistCreate(t);
    return true;
  }
  const h=await apiAuthHeaders(true);
  const put=async (url,body)=>{
    const res=await fetch(url,{method:'PUT',credentials:'include',headers:h,body:JSON.stringify(body)});
    if(!res.ok){
      const text=await res.text().catch(()=>'');
      let msg=text;
      try{ const j=JSON.parse(text); msg=j.message||j.error||text; }catch(e){}
      throw new Error(msg||('HTTP '+res.status));
    }
    return res;
  };
  const ownerMap=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.ownerIdMap)||{};
  const projectId=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||null;
  const gt=engineTypeToGanttFields(t.type,getChildren(t.id).length>0);
  try{
    const parentTaskId=(t.parent&&t.parent!==1)?ganttIdToDbTaskId(t.parent):null;
    let predIds=predecessorIdsForSave(t.predId,t.extraPredIds);
    if(t.predId&&predIds===null){ t.predId=null; predIds=[]; }
    const assigneeId=t.owner?ownerMap[t.owner]||null:null;
    await put('/api/pm/tasks/'+t.id,{
      name:t.name,
      plannedStartDate:t.start||null,
      plannedEndDate:(t.type===6?t.start:t.end)||null,
      progress:t.prog||0,
      status:taskStatusFromGantt(t),
      description:t.notes||null,
      wbsCode:t.wbs||null,
      parentTaskId,
      predecessorIds:predIds||[],
      depType:t.depType||'FS',
      assigneeId,
      isSummary:gt.isSummary,
      ganttType:gt.ganttType,
      ragStatus:RAG_TO_RAGSTATUS[t.ragScp||t.rag]||'green',
    });
    showSaveIndicator();
    try{ window.parent.postMessage({type:'gantt-saved',projectId,soft:true},'*'); }catch(e){}
    return true;
  } catch(e){
    console.error('Gantt persist failed:',e);
    showToast('Save failed: '+(e&&e.message?String(e.message).slice(0,120):'server error'),'err',4500);
    return false;
  }
}


// ══════════════════════════════════════════════════════════════
// PLAN VERSIONS (named snapshots / save-as-copy)
// ══════════════════════════════════════════════════════════════
let activePlanVersion=null; // {id,name,versionNumber,isActive}
let versionNameModalCb=null; // async (name)=>void
let versionConfirmModalCb=null; // async ()=>void
/** Cached lightweight version list (no snapshots) — keeps Plan chip / modal snappy */
let versionsListCache=null;
let versionsListFetchInflight=null;
let versionsListCacheProjectId=null;

function escAttr(s){
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;')
    .replace(/'/g,'&#39;');
}

function serializeSnapshot(){
  calcWBS();
  return {
    tasks: JSON.parse(JSON.stringify(tasks)),
    customCols: JSON.parse(JSON.stringify(customCols||[])),
    savedAt: new Date().toISOString(),
    taskCount: tasks.filter(t=>(t.type||0)>=2).length,
  };
}

function restoreSnapshot(snapshot){
  if(!snapshot||!Array.isArray(snapshot.tasks)) return false;
  tasks=snapshot.tasks.map(t=>normalizeTaskRags(Object.assign({},t)));
  invalidateTaskIndex();
  const ids=tasks.map(t=>Number(t.id)||0);
  nextId=Math.max(100000,...ids)+1;
  if(Array.isArray(snapshot.customCols)){
    customCols=snapshot.customCols.map(c=>Object.assign({},c));
    ccNextId=customCols.length?Math.max(1,...customCols.map(c=>Number(c.id)||0))+1:1;
    saveCustomCols();
    renderCustomHeaders();
  }
  calcWBS();
  history.length=0;
  historyIdx=-1;
  pushHistory();
  renderAll();
  updateUndoRedoButtons();
  return true;
}

function updatePlanChip(){
  const nameEl=document.getElementById('planChipName');
  const verEl=document.getElementById('planChipVer');
  const chip=document.getElementById('planChip');
  if(!nameEl||!verEl) return;
  if(activePlanVersion&&activePlanVersion.id){
    nameEl.textContent=activePlanVersion.name||'Working';
    verEl.textContent=activePlanVersion.versionNumber!=null?('v'+activePlanVersion.versionNumber):'';
    if(chip) chip.title='Active: '+(activePlanVersion.name||'')+' — click to manage versions';
  } else {
    nameEl.textContent='Working';
    verEl.textContent='';
    if(chip) chip.title='No saved version yet — click to manage plan versions';
  }
}

async function loadActivePlanVersion(){
  const {projectId}=ganttMeta();
  if(!projectId) return;
  try{
    const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions/active',{credentials:'include',headers:await apiAuthHeaders(false)});
    if(!res.ok) return;
    const data=await res.json();
    activePlanVersion=data&&data.id?data:null;
    updatePlanChip();
  }catch(e){ /* ignore */ }
  // Warm the versions list so Plan chip / modal opens instantly
  void prefetchVersionsList();
}

async function fetchVersionsList(){
  const {projectId}=ganttMeta();
  if(!projectId) return {list:[]};
  if(versionsListFetchInflight&&versionsListCacheProjectId===projectId){
    return versionsListFetchInflight;
  }
  versionsListCacheProjectId=projectId;
  versionsListFetchInflight=(async()=>{
    try{
      const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions',{credentials:'include',headers:await apiAuthHeaders(false)});
      const ct=(res.headers.get('content-type')||'');
      if(!ct.includes('application/json')) return {error:'unavailable'};
      const list=await res.json();
      if(!res.ok) return {error:(list&&list.message)||'failed'};
      if(!Array.isArray(list)) return {error:'invalid'};
      versionsListCache=list;
      const active=list.find(v=>v.isActive);
      if(active){
        activePlanVersion=active;
        updatePlanChip();
      }
      return {list};
    }catch(e){
      return {error:'network'};
    }finally{
      versionsListFetchInflight=null;
    }
  })();
  return versionsListFetchInflight;
}

function prefetchVersionsList(){
  void fetchVersionsList();
}

async function nextVersionDefaultName(){
  let n=1;
  if(Array.isArray(versionsListCache)&&versionsListCache.length){
    n=Math.max(...versionsListCache.map(v=>Number(v.versionNumber)||0))+1;
  } else if(activePlanVersion&&activePlanVersion.versionNumber!=null){
    n=Number(activePlanVersion.versionNumber)+1;
  } else {
    const result=await fetchVersionsList();
    if(result&&Array.isArray(result.list)&&result.list.length){
      n=Math.max(...result.list.map(v=>Number(v.versionNumber)||0))+1;
    }
  }
  return n===1?'Baseline v1':('Version '+n);
}

function toggleVersionMenu(e){
  if(e){e.preventDefault();e.stopPropagation();}
  const menu=document.getElementById('versionMenu');
  const btn=document.getElementById('versionMenuBtn');
  if(!menu||!btn) return;
  const open=menu.hasAttribute('hidden');
  if(open){
    if(menu.parentElement!==document.body) document.body.appendChild(menu);
    const r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    menu.style.left=Math.max(8,Math.min(r.left,window.innerWidth-220))+'px';
    menu.removeAttribute('hidden');
    btn.classList.add('active');
    const close=(ev)=>{
      if(ev.target.closest&&(ev.target.closest('#versionMenuBtn')||ev.target.closest('#versionMenu'))) return;
      menu.setAttribute('hidden','');
      btn.classList.remove('active');
      document.removeEventListener('mousedown',close,true);
    };
    setTimeout(()=>document.addEventListener('mousedown',close,true),0);
  } else {
    menu.setAttribute('hidden','');
    btn.classList.remove('active');
  }
}

function closeVersionMenu(){
  const menu=document.getElementById('versionMenu');
  const btn=document.getElementById('versionMenuBtn');
  if(menu) menu.setAttribute('hidden','');
  if(btn) btn.classList.remove('active');
}

function formatVersionDate(iso){
  if(!iso) return '';
  try{
    const d=new Date(iso);
    if(isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }catch(e){ return ''; }
}

/**
 * mode: 'update' | 'new' | 'copy'
 * update = overwrite active snapshot with live schedule (or create first)
 * new    = create new active version
 * copy   = create inactive named copy
 */
async function promptSaveVersion(mode){
  closeVersionMenu();
  const m=mode==='copy'?'copy':(mode==='new'?'new':'update');

  if(m==='update'&&activePlanVersion&&activePlanVersion.id){
    // Update = save live schedule into active version (name unchanged)
    await confirmUpdateActiveSnapshot();
    return;
  }

  if(m==='copy'){
    openVersionNameModal({
      title:'Save as copy',
      hint:'Creates a named backup. You stay on the current active plan.',
      defaultName:await nextVersionDefaultName(),
      confirmLabel:'Save copy',
      onConfirm:async(name)=>{
        await savePlanVersion(name,{activate:false});
      },
    });
    return;
  }

  // 'new' or first-time 'update'
  openVersionNameModal({
    title:m==='new'?'Save as new version':'Save version',
    hint:m==='new'
      ?'Creates a new active version from the live schedule. The previous active version is kept in the list.'
      :'Creates the first named snapshot of this plan and marks it active.',
    defaultName:await nextVersionDefaultName(),
    confirmLabel:m==='new'?'Save as new':'Save version',
    onConfirm:async(name)=>{
      await savePlanVersion(name,{activate:true});
    },
  });
}

async function confirmUpdateActiveSnapshot(){
  if(!activePlanVersion||!activePlanVersion.id){
    // No active version in memory — create first named snapshot
    openVersionNameModal({
      title:'Save version',
      hint:'Creates the first named snapshot of this plan and marks it active.',
      defaultName:await nextVersionDefaultName(),
      confirmLabel:'Save version',
      onConfirm:async(name)=>{
        await savePlanVersion(name,{activate:true});
      },
    });
    return;
  }
  const label=activePlanVersion.name||('v'+activePlanVersion.versionNumber);
  openVersionConfirmModal({
    title:'Update schedule',
    message:'Update "'+label+'" with the current live schedule?\n\nThe version name stays the same. Only the saved plan data is overwritten.',
    confirmLabel:'Update schedule',
    onConfirm:async()=>{
      await updateActivePlanVersion(null);
    },
  });
}

function openVersionConfirmModal(opts){
  versionConfirmModalCb=opts.onConfirm||null;
  const title=document.getElementById('vcTitle');
  const msg=document.getElementById('vcMessage');
  const btn=document.getElementById('vcConfirmBtn');
  if(title) title.textContent=opts.title||'Confirm';
  if(msg) msg.textContent=opts.message||'';
  if(btn){
    btn.textContent=opts.confirmLabel||'Confirm';
    btn.className=opts.danger?'btn btn-danger':'btn btn-p';
  }
  const el=document.getElementById('modalVersionConfirm');
  if(el) el.classList.add('open');
  setTimeout(()=>{ if(btn) btn.focus(); },40);
}

async function confirmVersionConfirmModal(){
  const cb=versionConfirmModalCb;
  versionConfirmModalCb=null;
  closeModal('modalVersionConfirm');
  if(typeof cb==='function') await cb();
}

function openVersionNameModal(opts){
  versionNameModalCb=opts.onConfirm||null;
  const title=document.getElementById('vnTitle');
  const hint=document.getElementById('vnHint');
  const input=document.getElementById('vnName');
  const err=document.getElementById('vnError');
  const btn=document.getElementById('vnConfirmBtn');
  if(title) title.textContent=opts.title||'Save version';
  if(hint) hint.innerHTML=opts.hint||'';
  if(err){ err.hidden=true; err.textContent=''; }
  if(btn) btn.textContent=opts.confirmLabel||'Save';
  if(input){
    input.value=opts.defaultName||'';
    input.onkeydown=(e)=>{
      if(e.key==='Enter'){e.preventDefault();confirmVersionNameModal();}
      if(e.key==='Escape'){e.preventDefault();closeModal('modalVersionName');}
    };
  }
  const el=document.getElementById('modalVersionName');
  if(el) el.classList.add('open');
  setTimeout(()=>{
    if(input){ input.focus(); input.select(); }
  },40);
}

async function confirmVersionNameModal(){
  const input=document.getElementById('vnName');
  const err=document.getElementById('vnError');
  const name=(input&&input.value||'').trim();
  if(!name){
    if(err){ err.hidden=false; err.textContent='Please enter a version name.'; }
    if(input) input.focus();
    return;
  }
  if(name.length>120){
    if(err){ err.hidden=false; err.textContent='Name must be 120 characters or fewer.'; }
    return;
  }
  const cb=versionNameModalCb;
  versionNameModalCb=null;
  closeModal('modalVersionName');
  if(typeof cb==='function') await cb(name);
}

async function updateActivePlanVersion(nameOrNull){
  const {projectId}=ganttMeta();
  if(!projectId||!activePlanVersion||!activePlanVersion.id){
    const name=(nameOrNull&&String(nameOrNull).trim())||await nextVersionDefaultName();
    await savePlanVersion(name,{activate:true});
    return;
  }
  const snapshot=serializeSnapshot();
  const body={snapshot};
  if(nameOrNull!=null&&String(nameOrNull).trim()){
    body.name=String(nameOrNull).trim();
  }
  showLoading('Updating version…');
  try{
    const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions/'+activePlanVersion.id,{
      method:'PATCH',credentials:'include',headers:await apiAuthHeaders(true),
      body:JSON.stringify(body),
    });
    const ct=(res.headers.get('content-type')||'');
    if(!ct.includes('application/json')){
      hideLoading();
      showToast('Versions API unavailable — refresh the page','err',3500);
      return;
    }
    const data=await res.json().catch(()=>({}));
    hideLoading();
    if(!res.ok){ showToast(data.message||'Update failed','err',2800); return; }
    activePlanVersion={...activePlanVersion,...data};
    updatePlanChip();
    showToast('✓ Updated schedule for v'+activePlanVersion.versionNumber,'ok');
    await refreshVersionsList();
    const modal=document.getElementById('modalVersions');
    if(modal&&!modal.classList.contains('open')) modal.classList.add('open');
  }catch(e){
    hideLoading();
    console.error('updateActivePlanVersion',e);
    showToast('Update failed','err',2800);
  }
}

async function savePlanVersion(name,opts){
  const {projectId}=ganttMeta();
  if(!projectId){ showToast('No project','err',2200); return; }
  const activate=!!(opts&&opts.activate);
  const snapshot=serializeSnapshot();
  if(!snapshot.tasks||snapshot.tasks.length===0){
    showToast('Nothing to save — plan is empty','err',2800);
    return;
  }
  showLoading(activate?'Saving version…':'Saving copy…');
  try{
    const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions',{
      method:'POST',credentials:'include',headers:await apiAuthHeaders(true),
      body:JSON.stringify({name,snapshot,activate}),
    });
    const ct=(res.headers.get('content-type')||'');
    if(!ct.includes('application/json')){
      hideLoading();
      showToast('Versions API unavailable — refresh the page','err',3500);
      return;
    }
    const data=await res.json().catch(()=>({}));
    hideLoading();
    if(!res.ok){ showToast(data.message||'Save failed','err',2800); return; }
    if(activate||data.isActive){
      activePlanVersion=data;
      updatePlanChip();
      showToast('✓ Saved version v'+data.versionNumber,'ok');
    } else {
      showToast('✓ Saved copy "'+data.name+'" (v'+data.versionNumber+')','ok');
    }
    await refreshVersionsList();
    const modal=document.getElementById('modalVersions');
    if(modal&&!modal.classList.contains('open')) modal.classList.add('open');
  }catch(e){
    hideLoading();
    console.error('savePlanVersion',e);
    showToast('Save failed','err',2800);
  }
}

async function openVersionsModal(){
  closeVersionMenu();
  const el=document.getElementById('modalVersions');
  // Open immediately — never wait on network before showing the dialog
  if(el) el.classList.add('open');
  if(Array.isArray(versionsListCache)){
    renderVersionsListHtml(versionsListCache);
  } else {
    const listEl=document.getElementById('versionsList');
    if(listEl) listEl.innerHTML='<div class="versions-empty">Loading…</div>';
  }
  await refreshVersionsList({soft:Array.isArray(versionsListCache)});
}

function renderVersionsListHtml(list){
  const el=document.getElementById('versionsList');
  if(!el) return;
    if(!list.length){
      el.innerHTML='<div class="versions-empty">'+
        '<div class="versions-empty-title">No saved versions yet</div>'+
        '<div>Save a snapshot of the current plan to compare baselines later.</div>'+
        '<button type="button" class="btn btn-p" style="margin-top:12px;" onclick="promptSaveVersion(\'update\')">Save first version</button>'+
      '</div>';
      return;
    }
    const active=list.find(v=>v.isActive);
    if(active){
      activePlanVersion=active;
      updatePlanChip();
    }
    el.innerHTML=list.map(v=>{
      const date=formatVersionDate(v.date||v.createdAt);
      const activeBadge=v.isActive?' <span class="ver-active-badge">Active</span>':'';
      return '<div class="ver-row'+(v.isActive?' is-active':'')+'" data-vid="'+v.id+'" data-name="'+escAttr(v.name)+'">'+
        '<div class="ver-main">'+
          '<div class="ver-title">'+esc(v.name)+activeBadge+'</div>'+
          '<div class="ver-meta">v'+v.versionNumber+(date?' · '+esc(date):'')+'</div>'+
        '</div>'+
        '<div class="ver-actions">'+
          (v.isActive
            ?'<button type="button" class="btn btn-ghost btn-xs" onclick="confirmUpdateActiveSnapshot()" title="Overwrite this snapshot with the live schedule (name stays the same)">Update schedule</button>'
            :'<button type="button" class="btn btn-p btn-xs" onclick="activatePlanVersion('+v.id+')">Activate</button>')+
          '<button type="button" class="btn btn-ghost btn-xs" onclick="copyPlanVersion('+v.id+')">Copy</button>'+
          '<button type="button" class="btn btn-ghost btn-xs" onclick="renamePlanVersion('+v.id+')" title="Change the display name only">Rename</button>'+
          (v.isActive?'':'<button type="button" class="btn btn-danger btn-xs" onclick="deletePlanVersion('+v.id+')">Delete</button>')+
        '</div>'+
      '</div>';
    }).join('');
}

async function refreshVersionsList(opts){
  const soft=!!(opts&&opts.soft);
  const el=document.getElementById('versionsList');
  if(!el) return;
  if(!soft) el.innerHTML='<div class="versions-empty">Loading…</div>';
  const result=await fetchVersionsList();
  if(result&&result.error==='unavailable'){
    el.innerHTML='<div class="versions-empty">'+
      '<div class="versions-empty-title">Versions API unavailable</div>'+
      '<div>Refresh the page (or restart the app server) and try again.</div>'+
    '</div>';
    return;
  }
  if(result&&result.error){
    if(!soft||!Array.isArray(versionsListCache)){
    el.innerHTML='<div class="versions-empty">'+
      '<div class="versions-empty-title">Could not load versions</div>'+
      '<div>Check your connection and refresh the page.</div>'+
    '</div>';
  }
    return;
  }
  const list=(result&&result.list)||versionsListCache||[];
  renderVersionsListHtml(list);
}

function versionRowName(vid){
  const row=document.querySelector('.ver-row[data-vid="'+vid+'"]');
  return row?row.getAttribute('data-name')||'':'';
}

async function activatePlanVersion(vid){
  if(activePlanVersion&&Number(activePlanVersion.id)===Number(vid)){
    showToast('Already the active version','info',2000);
    return;
  }
  const name=versionRowName(vid)||'this version';
  openVersionConfirmModal({
    title:'Activate version',
    message:'Activate "'+name+'"?\n\nThis replaces the live Gantt schedule with the saved snapshot and reloads the chart.',
    confirmLabel:'Activate',
    onConfirm:async()=>{
      const {projectId}=ganttMeta();
      showLoading('Restoring version…');
      try{
        const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions/'+vid+'/activate',{
          method:'POST',credentials:'include',headers:await apiAuthHeaders(true),body:'{}',
        });
        const data=await res.json().catch(()=>({}));
        hideLoading();
        if(!res.ok){ showToast(data.message||'Activate failed','err',3200); return; }
        activePlanVersion=data;
        updatePlanChip();
        closeModal('modalVersions');
        showToast('✓ Activated v'+data.versionNumber+' — reloading…','ok');
        try{ window.parent.postMessage({type:'gantt-version-activated',projectId,versionId:vid},'*'); }catch(e){}
      }catch(e){
        hideLoading();
        showToast('Activate failed','err',2800);
      }
    },
  });
}

async function copyPlanVersion(vid){
  const src=versionRowName(vid)||'version';
  openVersionNameModal({
    title:'Copy version',
    hint:'Creates an inactive copy of <strong>'+esc(src)+'</strong>.',
    defaultName:'Copy of '+src,
    confirmLabel:'Create copy',
    onConfirm:async(name)=>{
      const {projectId}=ganttMeta();
      showLoading('Copying…');
      try{
        const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions/'+vid+'/copy',{
          method:'POST',credentials:'include',headers:await apiAuthHeaders(true),
          body:JSON.stringify({name}),
        });
        const data=await res.json().catch(()=>({}));
        hideLoading();
        if(!res.ok){ showToast(data.message||'Copy failed','err',2800); return; }
        showToast('✓ Copied as v'+data.versionNumber,'ok');
        await refreshVersionsList();
      }catch(e){
        hideLoading();
        showToast('Copy failed','err',2800);
      }
    },
  });
}

async function renamePlanVersion(vid){
  const currentName=versionRowName(vid)||'';
  openVersionNameModal({
    title:'Rename version',
    hint:'Changes the label only. The saved schedule is not modified.',
    defaultName:currentName,
    confirmLabel:'Rename',
    onConfirm:async(name)=>{
      if(name===currentName) return;
      const {projectId}=ganttMeta();
      try{
        const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions/'+vid,{
          method:'PATCH',credentials:'include',headers:await apiAuthHeaders(true),
          body:JSON.stringify({name}),
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok){ showToast(data.message||'Rename failed','err',2800); return; }
        if(activePlanVersion&&Number(activePlanVersion.id)===Number(vid)){
          activePlanVersion.name=data.name;
          updatePlanChip();
        }
        showToast('✓ Renamed','ok',1600);
        await refreshVersionsList();
      }catch(e){
        showToast('Rename failed','err',2800);
      }
    },
  });
}

async function deletePlanVersion(vid){
  const name=versionRowName(vid)||'this version';
  openVersionConfirmModal({
    title:'Delete version',
    message:'Delete "'+name+'"?\n\nThis cannot be undone.',
    confirmLabel:'Delete',
    danger:true,
    onConfirm:async()=>{
      const {projectId}=ganttMeta();
      try{
        const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions/'+vid,{
          method:'DELETE',credentials:'include',headers:await apiAuthHeaders(false),
        });
        if(!res.ok){
          const data=await res.json().catch(()=>({}));
          showToast(data.message||'Delete failed','err',2800);
          return;
        }
        showToast('✓ Deleted','ok',1600);
        await refreshVersionsList();
      }catch(e){
        showToast('Delete failed','err',2800);
      }
    },
  });
}

// Parent may request a live snapshot (e.g. React bridge)
window.addEventListener('message',function(e){
  if(!e.data||e.data.type!=='gantt-request-snapshot') return;
  try{
    window.parent.postMessage({
      type:'gantt-snapshot',
      requestId:e.data.requestId||null,
      snapshot:serializeSnapshot(),
    },'*');
  }catch(err){}
});

// ══════════════════════════════════════════════════════════════
// DATA INIT — reads window.GANTT_INIT_DATA injected by React
// ══════════════════════════════════════════════════════════════
/** One-time: old drop logic saved Finish-to-Finish when dropping on the right half of a bar. */
function migrateLegacyRightRightDeps(){
  const pid=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||0;
  // v2: also fixes links that looked right→right due to wrap-around routing
  const key='gantt-dep-fs-migrate-v2-'+pid;
  try{ if(localStorage.getItem(key)) return; }catch(e){}
  const touched=[];
  tasks.forEach(t=>{
    if(!t.predId) return;
    if(t.depType!=='EE'&&t.depType!=='FF') return;
    t.depType='FS';
    touched.push(t);
  });
  try{ localStorage.setItem(key,'1'); }catch(e){}
  if(!touched.length) return;
  touched.forEach(t=>{ if(!isUnsavedLocal(t)) void persistSave(t); });
  setTimeout(()=>showToast('Updated '+touched.length+' link(s) to Finish→Start (into the left)','ok',3200),600);
}
function loadFromInitData(){
  const d=window.GANTT_INIT_DATA;
  if(!d||!Array.isArray(d.tasks)){tasks=[];nextId=100000;return;}
  tasks=d.tasks.map(t=>normalizeTaskRags(Object.assign({},t)));
  nextId=d.nextId||100000;
  invalidateTaskIndex();
  checkedRowIds.clear();
  selectedTaskId=null;
  normalizeContainerTypes();
  migrateLegacyRightRightDeps();
  // Populate OWNERS
  OWNERS.length=0;
  (d.owners||[]).forEach(o=>OWNERS.push(o));
  // Reset version list cache when init data reloads (project / version switch)
  versionsListCache=null;
  versionsListCacheProjectId=null;
  versionsListFetchInflight=null;
  // Drop owner filter picks that no longer exist
  if(ownerFilterOwners.size){
    const keep=new Set(OWNERS);
    ownerFilterOwners=new Set(Array.from(ownerFilterOwners).filter(o=>keep.has(o)));
  }
  syncOwnerFilterHidden();
  updateOwnerFilterBtn();
  // Update modal owner select
  const mo=document.getElementById('m-owner');
  if(mo&&OWNERS.length){
    mo.innerHTML='';
    OWNERS.forEach(o=>{const opt=document.createElement('option');opt.value=o;opt.textContent=o;mo.appendChild(opt);});
  }
  loadCustomCols();
  loadFieldVisibility();
  loadColumnWidths();
  renderCustomHeaders();
  applyFieldVisibility();
  ensureColumnResizeHandles();
  updateColumnsBtn();
}

// ── INIT ─────────────────────────────────────────────────────
loadFromInitData();
pushHistory();
setupScrollSync();
setupPanelSplitter();
ensureColumnResizeHandles();
ensureAddColumnModal();
updateColumnsBtn();
renderAll();
updateUndoRedoButtons();
updatePlanChip();
loadActivePlanVersion();
setTimeout(()=>jumpToToday(),200);
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();redo();}
  if(e.key==='Escape'){
    if(depLinkDragging||depDrawMode){
      clearDepDragLine();
      depLinkDragging=false;
      depDrawMode=false;
      showDepToast(null);
      return;
    }
    const confirmModal=document.getElementById('modalVersionConfirm');
    if(confirmModal&&confirmModal.classList.contains('open')){closeModal('modalVersionConfirm');return;}
    const nameModal=document.getElementById('modalVersionName');
    if(nameModal&&nameModal.classList.contains('open')){closeModal('modalVersionName');return;}
    const verModal=document.getElementById('modalVersions');
    if(verModal&&verModal.classList.contains('open')){closeModal('modalVersions');return;}
    const addColModal=document.getElementById('modalAddColumn');
    if(addColModal&&addColModal.classList.contains('open')){closeModal('modalAddColumn');return;}
    const fieldsMenu=document.getElementById('fieldsMenu');
    if(fieldsMenu&&!fieldsMenu.hasAttribute('hidden')){fieldsMenu.setAttribute('hidden','');return;}
    const typeMenu=document.getElementById('typeFilterMenu');
    if(typeMenu&&!typeMenu.hasAttribute('hidden')){typeMenu.setAttribute('hidden','');return;}
    const ownerMenu=document.getElementById('ownerFilterMenu');
    if(ownerMenu&&!ownerMenu.hasAttribute('hidden')){ownerMenu.setAttribute('hidden','');return;}
    const ragMenu=document.getElementById('ragFilterMenu');
    if(ragMenu&&!ragMenu.hasAttribute('hidden')){ragMenu.setAttribute('hidden','');return;}
    if(checkedRowIds.size){clearRowSelection();return;}
    closeVersionMenu();
  }
});

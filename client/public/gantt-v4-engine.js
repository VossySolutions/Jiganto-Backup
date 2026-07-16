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
const LEVELS={0:'Programme',1:'Project',2:'Phase',3:'Workstream',4:'Activity',5:'Task',6:'Milestone'};
const LEVEL_COLORS=['#3730a3','#4f46e5','#0891b2','#059669','#d97706','#64748b','#db2777'];
const LEVEL_BG=['rgba(55,48,163,.12)','rgba(79,70,229,.10)','rgba(8,145,178,.08)','rgba(5,150,105,.07)','rgba(217,119,6,.07)','rgba(100,116,139,.06)','rgba(219,39,119,.08)'];
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
  return t;
}
function buildRagPillCell(t,id,dim){
  const v=ragField(t,dim);
  const lbl=(RAG_PILL_LABELS[dim]||RAG_PILL_LABELS.scp)[v]||'On Track';
  return '<div class="task-rag-pill-col" onclick="event.stopPropagation();cycleRagDim('+id+',\''+dim+'\')" title="Click to cycle '+dim+' RAG">'+
    '<span class="rag-pill rag-pill-'+v+'"><span class="rag-pill-dot"></span><span class="rag-pill-lbl">'+lbl+'</span></span></div>';
}
const BAR_PALETTE=['#4f46e5','#0891b2','#059669','#d97706','#db2477','#ea580c','#7c3aed','#0f766e','#9333ea','#0369a1'];
const TYPE_ICONS={0:'🔷',1:'📁',2:'📋',3:'🔀',4:'⚡',5:'☑',6:'◆'};
const AV_COLORS={'#4f46e5':'#4f46e5','#059669':'#059669','#0891b2':'#0891b2','#d97706':'#d97706','#db2477':'#db2477','#ea580c':'#ea580c'};

// ── OWNERS (populated from init data) ────────────────────────
const OWNERS = [];

// ── STATE ────────────────────────────────────────────────────
let tasks=[];
let nextId=5000;
let collapsed={};
let editingId=null;
let currentRag='g';
let currentDep='FS';
let zoom='week';
let colW=28;
let showCP=false;
let mainView='gantt';
let criticalIds=new Set();
let importMode='append';
let customCols=[];
let ccNextId=1;
let depDrawMode=false;
let depSourceId=null;
let selectedTaskId=null;
let insertAfterId=null;
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
  showLoading(showCP?'Computing critical path…':'Updating view…');
  try{ renderAll(); }
  finally{ hideLoading(); }
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
    showLoading('Auto-scheduling…');
    try{
      pushHistory();
      applyAutoSchedule();
      renderAll();
      void persistScheduleChanges().finally(()=>hideLoading());
      showToast('✓ Auto schedule applied','ok');
    }catch(e){
      hideLoading();
      showToast('Auto schedule failed','err',2800);
    }
  }
}
function toggleCollapseRows(fromSwitch){
  const sw=document.getElementById('switchCollapse');
  if(fromSwitch===true){
    if(sw&&sw.checked) collapseAll();
    else expandAll();
  }
}
function toggleZoomFit(fromSwitch){
  const sw=document.getElementById('switchZoomFit');
  const on=fromSwitch===true?!!(sw&&sw.checked):!zoomFitActive;
  if(sw) sw.checked=on;
  showLoading(on?'Zooming to fit…':'Restoring zoom…');
  try{
    if(on){
      zoomBeforeFit={zoom,colW};
      zoomFitActive=true;
      zoomToFit();
    } else {
      zoomFitActive=false;
      zoom=zoomBeforeFit.zoom||'week';
      colW=zoomBeforeFit.colW||28;
      document.querySelectorAll('.zb').forEach(b=>{
        b.classList.toggle('on', b.dataset.zoom===zoom);
      });
      renderAll();
    }
  } finally {
    hideLoading();
  }
}
function applyAutoSchedule(){
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
      if(ns!==t.start||ne!==t.end){ t.start=ns; t.end=ne; changed=true; }
    });
  }
  rollupParentDates();
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
  if(task&&task.id<5000){
    persistSave(task);
    if(autoSchedule) void persistScheduleChanges(task);
  }
}
async function persistScheduleChanges(primary){
  const touched=new Set();
  if(primary&&primary.id<5000) touched.add(primary.id);
  if(autoSchedule){
    tasks.filter(t=>t.id<5000&&(t.predId||tasks.some(x=>x.predId===t.id))).forEach(t=>touched.add(t.id));
  }
  for(const id of touched){
    const t=tasks.find(x=>x.id===id);
    if(t) await persistSave(t);
  }
}
function getChildren(id){ return tasks.filter(c=>c.parent===id); }
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
  if(history.length>MAX_HISTORY) history.shift();
  historyIdx=history.length-1;
  updateUndoRedoButtons();
}
function restoreHistory(idx){
  if(idx<0||idx>=history.length) return;
  historyIdx=idx;
  tasks=JSON.parse(history[historyIdx]);
  updateUndoRedoButtons();
  renderAll();
}
function undo(){
  if(historyIdx<=0) return;
  showLoading('Undoing…');
  try{ restoreHistory(historyIdx-1); }
  finally{ hideLoading(); }
}
function redo(){
  if(historyIdx>=history.length-1) return;
  showLoading('Redoing…');
  try{ restoreHistory(historyIdx+1); }
  finally{ hideLoading(); }
}
function updateUndoRedoButtons(){
  const u=document.getElementById('undoBtn');
  const r=document.getElementById('redoBtn');
  if(u) u.disabled=historyIdx<=0;
  if(r) r.disabled=historyIdx>=history.length-1;
}
function formatPred(t){
  if(!t.predId) return '—';
  const p=tasks.find(x=>x.id===t.predId);
  if(!p) return '—';
  return p.wbs||p.name.substring(0,14);
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
function renderCustomHeaders(){
  const el=document.getElementById('tpCustomHeaders');
  if(!el) return;
  el.innerHTML=customCols.map(c=>
    '<div class="th-cell th-custom-col" style="width:'+c.width+'px;min-width:'+c.width+'px;" title="'+esc(c.name)+'">'+
      esc(c.name)+' <span class="th-col-rm" onclick="event.stopPropagation();removeCustomColumn('+c.id+')" title="Remove column">×</span>'+
    '</div>'
  ).join('');
}
function promptAddColumn(){
  const name=prompt('New column name:');
  if(!name||!name.trim()) return;
  pushHistory();
  customCols.push({id:ccNextId++,name:name.trim(),width:110,type:'text'});
  saveCustomCols();
  renderCustomHeaders();
  renderAll();
}
function removeCustomColumn(id){
  if(!confirm('Remove this column?')) return;
  pushHistory();
  customCols=customCols.filter(c=>c.id!==id);
  tasks.forEach(t=>{
    if(t.customData) delete t.customData[id];
  });
  saveCustomCols();
  renderCustomHeaders();
  renderAll();
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
  const rootTasks=tasks.filter(t=>t.parent===null);
  function assign(list,prefix){
    let c=0;
    list.forEach(t=>{
      c++;
      const wbs=prefix?(prefix+'.'+c):String(c);
      t.wbs=wbs;
      const children=tasks.filter(ch=>ch.parent===t.id);
      if(children.length) assign(children,wbs);
    });
  }
  assign(rootTasks,'');
}

// ── CRITICAL PATH ────────────────────────────────────────────
function computeCriticalPath(){
  criticalIds=new Set();
  if(!showCP) return;
  const hasSuccessor=new Set(tasks.filter(t=>t.predId).map(t=>t.predId));
  const endNodes=tasks.filter(t=>!hasSuccessor.has(t.id)&&t.type<6);
  if(!endNodes.length) return;
  const latestEnd=Math.max(...endNodes.map(t=>D(t.end).getTime()));
  function markCritical(id){
    criticalIds.add(id);
    const t=tasks.find(x=>x.id===id);
    if(!t||!t.predId) return;
    markCritical(t.predId);
  }
  endNodes.filter(t=>D(t.end).getTime()===latestEnd).forEach(t=>markCritical(t.id));
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
function getVisible(){
  const fl=document.getElementById('f-level')?.value||'';
  const fo=document.getElementById('f-owner')?.value||'';
  const fr=document.getElementById('f-rag')?.value||'';
  const fq=(document.getElementById('f-search')?.value||'').trim().toLowerCase();
  return tasks.filter(t=>{
    if(t.parent!==null&&collapsed[t.parent]) return false;
    if(fl!==''&&String(t.type)!==fl) return false;
    if(fo&&t.owner!==fo) return false;
    if(fr&&(ragField(t,'bgt')!==fr&&ragField(t,'sch')!==fr&&ragField(t,'scp')!==fr)) return false;
    if(fq&&!(t.name||'').toLowerCase().includes(fq)&&!(t.wbs||'').toLowerCase().includes(fq)) return false;
    return true;
  });
}

// ── ZOOM ─────────────────────────────────────────────────────
function setZoom(z,el){
  zoom=z;
  colW={day:44,week:28,month:14,quarter:7,year:4}[z]||28;
  zoomFitActive=false;
  const sw=document.getElementById('switchZoomFit');
  if(sw) sw.checked=false;
  document.querySelectorAll('.zb').forEach(b=>b.classList.remove('on'));
  if(el) el.classList.add('on');
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
  document.querySelectorAll('.zb').forEach(b=>b.classList.remove('on'));
  renderAll();
  wrap.scrollLeft=0;
}
function toggleFullscreen(){
  const root=document.querySelector('.main');
  if(!root) return;
  showLoading(document.fullscreenElement?'Exiting fullscreen…':'Entering fullscreen…');
  const done=()=>hideLoading();
  if(!document.fullscreenElement){
    root.requestFullscreen?.().then(done).catch(()=>{done();showToast('Fullscreen not available','err',2500);});
  } else {
    document.exitFullscreen?.().then(done).catch(()=>{done();});
  }
}

// ── VIEW ─────────────────────────────────────────────────────
function setView(v,el){
  try{
    if(v!=='gantt'&&v!=='list') return;
    showLoading(v==='list'?'Loading list view…':'Loading Gantt view…');
    mainView=v;
    document.querySelectorAll('.vb').forEach(b=>b.classList.remove('on'));
    if(el) el.classList.add('on');
    const gBtn=document.getElementById('viewGanttBtn');
    const lBtn=document.getElementById('viewListBtn');
    if(v==='gantt'&&gBtn) gBtn.classList.add('on');
    if(v==='list'&&lBtn) lBtn.classList.add('on');

    const gv=document.getElementById('ganttView');
    const lv=document.getElementById('listView');
    const bottom=document.getElementById('ganttBottomBar');

    if(v==='list'){
      if(gv){ gv.hidden=true; gv.style.display='none'; }
      if(lv){ lv.hidden=false; lv.style.display='block'; }
      if(bottom) bottom.style.display='none';
      renderListView();
      return;
    }

    if(lv){ lv.hidden=true; lv.style.display='none'; }
    if(gv){ gv.hidden=false; gv.style.display='flex'; }
    if(bottom) bottom.style.display='flex';
    renderAll();
  }catch(err){
    console.error('setView failed',err);
  } finally {
    hideLoading();
  }
}
window.setView=setView;

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════
function renderAll(){
  if(mainView==='list'){ renderListView(); return; }
  const gv=document.getElementById('ganttView');
  const lv=document.getElementById('listView');
  if(gv){ gv.hidden=false; gv.style.display='flex'; }
  if(lv){ lv.hidden=true; lv.style.display='none'; }
  const ts=document.getElementById('taskScroll');
  const tw=document.getElementById('tlWrap');
  if(!ts||!tw) return;
  const prevScrollTop=ts.scrollTop||0;
  calcWBS();
  computeCriticalPath();
  const {start,end}=getRange();
  const totalDays=daysBetween(start,end);
  const totalW=totalDays*colW;
  renderTaskPanel();
  renderCustomHeaders();
  renderTimeline(start,end,totalW);
  positionTodayLine(start);
  if(!scrollSyncing){
    scrollSyncing=true;
    ts.scrollTop=prevScrollTop;
    tw.scrollTop=prevScrollTop;
    const th=document.getElementById('tlHeader');
    if(th) th.style.transform='translateX('+(-tw.scrollLeft)+'px)';
    requestAnimationFrame(()=>{scrollSyncing=false;});
  }
}

// ── TASK PANEL ───────────────────────────────────────────────
function renderTaskPanel(){
  const scroll=document.getElementById('taskScroll');
  if(!scroll) return;
  const visible=getVisible();
  scroll.innerHTML=visible.map(t=>buildTaskRowHTML(t)).join('');
  bindCustomCellClicks();
}

function getDepth(t){
  let d=0,cur=t;
  while(cur.parent!==null){
    const p=tasks.find(x=>x.id===cur.parent);
    if(!p) break;
    cur=p; d++;
    if(d>10) break;
  }
  return d;
}

// Build inline-editable task row HTML
function buildTaskRowHTML(t){
  const depth=getDepth(t);
  const indentPx=depth*14;
  const hasKids=tasks.some(c=>c.parent===t.id);
  const isCollapsed=collapsed[t.id];
  const progC=t.prog>=70?'#059669':t.prog>=40?'#d97706':'#dc2626';
  const ragC=RAG_COL[t.rag]||'#94a3b8';
  const isCrit=showCP&&criticalIds.has(t.id);
  const customCells=customCols.map(col=>{
    const val=t.customData?.[col.id]||'';
    return '<div class="task-custom-col ie-cell" style="min-width:'+col.width+'px;max-width:'+col.width+'px;" data-id="'+t.id+'" data-col="'+col.id+'" title="Click to edit">'+esc(val||'—')+'</div>';
  }).join('');
  return '<div class="task-row '+(isCrit?'critical':'')+'" data-id="'+t.id+'" data-level="'+t.type+'" id="tr-'+t.id+'" onclick="selectTask('+t.id+')">'+
    '<div class="task-wbs" title="'+(LEVELS[t.type]||'')+'">'+esc(t.wbs||'')+'</div>'+
    '<div class="task-name-col">'+
      '<div class="task-indent" style="width:'+indentPx+'px;"></div>'+
      '<div class="task-toggle '+(hasKids?(isCollapsed?'collapsed':'expanded'):'leaf')+'" onclick="event.stopPropagation();toggleCollapse('+t.id+')"></div>'+
      '<div class="task-name ie-cell" data-level="'+t.type+'" id="tn-'+t.id+'" onclick="event.stopPropagation();editName('+t.id+')" onblur="saveName('+t.id+',this)" onkeydown="nameKey(event,'+t.id+',this)" title="Click to edit name">'+esc(t.name)+'</div>'+
    '</div>'+
    '<div class="task-owner-col ie-cell" onclick="event.stopPropagation();inlineEditOwner('+t.id+',this)" title="Click to change owner">'+
      '<div class="av" style="background:'+avC(t.owner)+';">'+avInits(t.owner)+'</div>'+
    '</div>'+
    '<div class="task-date-col ie-cell" onclick="event.stopPropagation();inlineEditDate('+t.id+',\'start\',this)" title="Click to edit start date">'+
      '<span class="date-val">'+((getChildren(t.id).length?getEffectiveDates(t).start:t.start))+'</span>'+
    '</div>'+
    '<div class="task-date-col ie-cell" onclick="event.stopPropagation();inlineEditDate('+t.id+',\'end\',this)" title="Click to edit end date">'+
      '<span class="date-val">'+((getChildren(t.id).length?getEffectiveDates(t).end:t.end))+'</span>'+
    '</div>'+
    '<div class="task-dur-col ie-cell" onclick="event.stopPropagation();inlineEditDuration('+t.id+',this)" title="Click to edit duration (days)">'+
      '<span class="dur-val">'+formatDuration(t)+'</span>'+
    '</div>'+
    '<div class="task-pred-col ie-cell" onclick="event.stopPropagation();inlineEditPred('+t.id+',this)" title="Click to set predecessor">'+
      '<span class="pred-val">'+esc(formatPred(t))+'</span>'+
    '</div>'+
    '<div class="task-prog-col ie-cell ie-prog-cell" onclick="event.stopPropagation();inlineEditProg('+t.id+',this)" title="Click to update progress">'+
      '<div class="prog-track"><div class="prog-fill" style="width:'+t.prog+'%;background:'+progC+';"></div></div>'+
      '<div class="prog-pct">'+t.prog+'%</div>'+
    '</div>'+
    buildRagPillCell(t,t.id,'bgt')+
    buildRagPillCell(t,t.id,'sch')+
    buildRagPillCell(t,t.id,'scp')+
    customCells+
    '<div class="task-row-add-col" onclick="event.stopPropagation();quickAddChild('+t.id+')" title="Add child item">+</div>'+
  '</div>';
}

function editName(id){
  const el=document.getElementById('tn-'+id);
  if(!el||el.contentEditable==='true') return;
  el.contentEditable='true';
  el.focus();
  const r=document.createRange();
  r.selectNodeContents(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(r);
}
function saveName(id,el){
  if(el.contentEditable!=='true') return;
  el.contentEditable='false';
  const t=tasks.find(x=>x.id===id);
  if(t){
    const next=el.textContent.trim()||t.name;
    if(next!==t.name){ pushHistory(); t.name=next; persistSave(t); }
  }
  renderAll();
}
function nameKey(e,id,el){
  if(e.key==='Enter'){e.preventDefault();el.blur();}
  if(e.key==='Escape'){el.contentEditable='false';renderAll();}
}
function selectTask(id){
  selectedTaskId=id;
  document.querySelectorAll('.task-row').forEach(r=>r.classList.remove('selected'));
  document.querySelectorAll('.tl-grid-row').forEach(r=>r.classList.remove('selected'));
  const r=document.getElementById('tr-'+id);
  if(r) r.classList.add('selected');
  const gr=document.getElementById('gr-'+id);
  if(gr) gr.classList.add('selected');
}
function getSelectedTask(){
  return selectedTaskId?tasks.find(t=>t.id===selectedTaskId)||null:null;
}
function toggleCollapse(id){
  if(collapsed[id]) collapsed[id]=false;
  else collapsed[id]=true;
  renderAll();
}
function collapseAll(){
  showLoading('Collapsing rows…');
  try{
    tasks.forEach(t=>{if(tasks.some(c=>c.parent===t.id))collapsed[t.id]=true;});
    const sw=document.getElementById('switchCollapse');
    if(sw) sw.checked=true;
    renderAll();
  } finally {
    hideLoading();
  }
}
function expandAll(){
  showLoading('Expanding rows…');
  try{
    collapsed={};
    const sw=document.getElementById('switchCollapse');
    if(sw) sw.checked=false;
    renderAll();
  } finally {
    hideLoading();
  }
}
/** Header "+" pill — add a child under the currently selected row (falls back to a root-level add) */
function headerAddChild(){
  const sel=getSelectedTask();
  if(sel) quickAddChild(sel.id);
  else addNewItem();
}

function indentTask(){
  const t=getSelectedTask();
  if(!t||t.type===1) return;
  const idx=tasks.findIndex(x=>x.id===t.id);
  if(idx<=0) return;
  const prev=tasks[idx-1];
  if(prev.type>=6) return;
  t.parent=prev.id;
  if(collapsed[prev.id]) collapsed[prev.id]=false;
  calcWBS();
  renderAll();
  if(t.id<5000) persistSave(t);
}
function outdentTask(){
  const t=getSelectedTask();
  if(!t||t.parent===null) return;
  const parent=tasks.find(x=>x.id===t.parent);
  t.parent=parent?parent.parent:null;
  calcWBS();
  renderAll();
  if(t.id<5000) persistSave(t);
}
function resetPanelLayout(){
  document.documentElement.style.setProperty('--task-col','570px');
  localStorage.removeItem('gantt-task-col-width');
  renderAll();
}
function setupPanelSplitter(){
  if(splitterBound) return;
  const saved=localStorage.getItem('gantt-task-col-width');
  if(saved) document.documentElement.style.setProperty('--task-col',saved+'px');
  const splitter=document.getElementById('panelSplitter');
  if(!splitter) return;
  splitterBound=true;
  splitter.addEventListener('mousedown',e=>{
    e.preventDefault();
    const startX=e.clientX;
    const panel=document.getElementById('taskPanel');
    const startW=panel?panel.offsetWidth:570;
    splitter.classList.add('dragging');
    const move=e2=>{
      const w=Math.max(320,Math.min(900,startW+(e2.clientX-startX)));
      document.documentElement.style.setProperty('--task-col',w+'px');
    };
    const up=()=>{
      document.removeEventListener('mousemove',move);
      document.removeEventListener('mouseup',up);
      splitter.classList.remove('dragging');
      const val=getComputedStyle(document.documentElement).getPropertyValue('--task-col').trim();
      const w=parseInt(val)||570;
      localStorage.setItem('gantt-task-col-width',String(w));
    };
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseup',up);
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
  const h=tlh.offsetHeight;
  if(h>0){
    tph.style.height=h+'px';
    tph.style.minHeight=h+'px';
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

function renderTimeline(start,end,totalW){
  const header=document.getElementById('tlHeader');
  const rows=document.getElementById('tlRows');
  if(!header||!rows) return;
  const totalDays=daysBetween(start,end);
  const days=[];
  for(let i=0;i<totalDays;i++) days.push(addDays(start,i));

  header.innerHTML=buildTimelineHeader(start,end,totalW);
  header.style.width=totalW+'px';

  const visible=getVisible();
  const today=new Date();today.setHours(0,0,0,0);
  let rHTML='';
  visible.forEach(t=>{
    let cells='';
    days.forEach(dt=>{
      const isWE=dt.getDay()===0||dt.getDay()===6;
      const isT=dt.getTime()===today.getTime();
      cells+='<div class="tl-cell '+(isWE?'weekend':'')+' '+(isT?'today-col':'')+'" style="width:'+colW+'px;" data-date="'+fmt(dt)+'"></div>';
    });
    rHTML+='<div class="tl-grid-row" id="gr-'+t.id+'" data-level="'+t.type+'" data-task-id="'+t.id+'" style="width:'+totalW+'px;">'+cells+'</div>';
  });
  rows.innerHTML=rHTML;

  Object.keys(barPos).forEach(k=>delete barPos[k]);

  requestAnimationFrame(()=>{
    visible.forEach(t=>{
      drawTaskBar(t,start,rows);
    });
    const totalH=visible.length*ROW_H;
    document.getElementById('tlInner').style.width=totalW+'px';
    document.getElementById('depSvg').setAttribute('width',totalW);
    document.getElementById('depSvg').setAttribute('height',totalH+'px');
    renderDeps(visible,start);
    document.getElementById('tlInner').style.minHeight=totalH+'px';
    syncHeaderHeights();
    const tw=document.getElementById('tlWrap');
    const th=document.getElementById('tlHeader');
    if(tw&&th) th.style.transform='translateX('+(-tw.scrollLeft)+'px)';
    bindTimelineClicks(start);
  });
}

function drawTaskBar(t,rangeStart,rows){
  const row=document.getElementById('gr-'+t.id);
  if(!row) return;
  const rowTop=row.offsetTop;
  const hasKids=getChildren(t.id).length>0;
  const eff=getEffectiveDates(t);
  const isCrit=showCP&&criticalIds.has(t.id);

  if(t.type===6){
    const offsetDays=daysBetween(rangeStart,D(eff.start));
    const left=offsetDays*colW;
    const el=document.createElement('div');
    el.className='milestone-diamond';
    el.style.cssText='left:'+(left-6)+'px;top:'+(rowTop+(ROW_H-12)/2)+'px;width:12px;height:12px;';
    el.title=t.name+' · '+fmtDisp(D(eff.start));
    el.onclick=()=>openEdit(t.id);
    rows.appendChild(el);
    const msLbl=document.createElement('div');
    msLbl.className='bar-label-outside bar-label-milestone';
    msLbl.textContent=t.name;
    msLbl.style.cssText='left:'+(left+10)+'px;top:'+(rowTop+(ROW_H-14)/2)+'px;';
    rows.appendChild(msLbl);
  } else {
    const s=D(eff.start),e=D(eff.end);
    const left=daysBetween(rangeStart,s)*colW;
    const width=Math.max((taskDurationDays(eff.start,eff.end)+1)*colW,colW);
    const barH=hasKids?14:(t.type<=2?16:14);
    const barTop=rowTop+(ROW_H-barH)/2;
    const el=document.createElement('div');
    el.className='gantt-bar '+getTaskBarClass(t,hasKids,isCrit);
    el.id='bar-'+t.id;
    el.style.cssText='left:'+left+'px;top:'+barTop+'px;width:'+width+'px;height:'+barH+'px;';
    el.title=t.name+'\n'+fmtDisp(s)+' → '+fmtDisp(e)+'\n'+t.prog+'% · '+(LEVELS[t.type]||'');
    const pf=document.createElement('div');
    pf.className='bar-prog-fill';
    pf.style.width=t.prog+'%';
    el.appendChild(pf);
    if(hasKids){
      const lbl=document.createElement('div');
      lbl.className='bar-label';
      lbl.textContent=t.name;
      el.appendChild(lbl);
    }
    const rl=document.createElement('div');rl.className='bar-resize-l';
    const rr=document.createElement('div');rr.className='bar-resize-r';
    el.appendChild(rl);el.appendChild(rr);
    registerBar(t.id,left,barTop,width,barH);
    el.onclick=(e2)=>{
      e2.stopPropagation();
      if(handleBarClickForDep(el,t.id)) return;
      selectTask(t.id);
    };
    el.ondblclick=(e2)=>{e2.stopPropagation();if(!depDrawMode)openEdit(t.id);};
    if(!hasKids) setupDrag(el,t,rangeStart,rl,rr);
    rows.appendChild(el);
    if(!hasKids){
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
    row.querySelectorAll('.tl-cell').forEach(cell=>{
      cell.style.cursor='cell';
      cell.title='Click to add a task on this date';
      cell.onclick=(e)=>{
        if(depDrawMode||e.target.closest('.gantt-bar')||e.target.closest('.milestone-diamond')) return;
        e.stopPropagation();
        const dateStr=cell.dataset.date;
        if(!dateStr) return;
        const taskId=parseInt(row.dataset.taskId,10);
        const rowTask=tasks.find(x=>x.id===taskId);
        addTaskOnTimeline(dateStr,rowTask);
      };
    });
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
  selectedTaskId=newTask.id;
  renderAll();
  persistCreate(newTask);
  const el=document.getElementById('tn-'+newTask.id);
  if(el) setTimeout(()=>editName(newTask.id),50);
}

// ── DEPENDENCY ARROWS ────────────────────────────────────────
function renderDeps(visible,start){
  const svg=document.getElementById('depSvg');
  if(!svg) return;
  svg.innerHTML='<defs>'+
    '<marker id="ah" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#94a3b8"/></marker>'+
    '<marker id="ah-crit" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#dc2626"/></marker>'+
  '</defs>';
  visible.forEach(t=>{
    if(!t.predId) return;
    const fromT=tasks.find(x=>x.id===t.predId);
    if(!fromT) return;
    const fp=barPos[fromT.id];
    const tp=barPos[t.id];
    if(!fp||!tp) return;
    const depType=t.depType||'FS';
    let x1,y1,x2,y2;
    if(depType==='FS'){x1=fp.left+fp.width;y1=fp.midY;x2=tp.left;y2=tp.midY;}
    else if(depType==='SS'){x1=fp.left;y1=fp.midY;x2=tp.left;y2=tp.midY;}
    else{x1=fp.left+fp.width;y1=fp.midY;x2=tp.left+tp.width;y2=tp.midY;}
    const isCrit=showCP&&criticalIds.has(t.id)&&criticalIds.has(fromT.id);
    const color=isCrit?'#e74c3c':'#9e9e9e';
    const markerId=isCrit?'ah-crit':'ah';
    let d;
    const dx=x2-x1,dy=y2-y1;
    if(Math.abs(dy)<4){
      const cx=x1+dx*0.5;
      d='M'+x1+','+y1+' C'+cx+','+y1+' '+cx+','+y2+' '+x2+','+y2;
    } else {
      const ex=Math.max(x1+18,x2-18);
      d='M'+x1+','+y1+' L'+ex+','+y1+' L'+ex+','+y2+' L'+x2+','+y2;
    }
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',d);
    path.setAttribute('fill','none');
    path.setAttribute('stroke',color);
    path.setAttribute('stroke-width',isCrit?'2':'1.5');
    if(!isCrit) path.setAttribute('stroke-dasharray','5 3');
    path.setAttribute('marker-end','url(#'+markerId+')');
    path.style.cursor='pointer';
    path.onclick=()=>openEdit(t.id);
    const midX=(x1+x2)/2,midY=(y1+y2)/2;
    const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('x',midX-9);bg.setAttribute('y',midY-7);
    bg.setAttribute('width',18);bg.setAttribute('height',13);
    bg.setAttribute('rx',3);bg.setAttribute('fill','#fff');
    bg.setAttribute('stroke',color);bg.setAttribute('stroke-width','0.8');
    const lbl=document.createElementNS('http://www.w3.org/2000/svg','text');
    lbl.setAttribute('x',midX);lbl.setAttribute('y',midY+1);
    lbl.setAttribute('text-anchor','middle');
    lbl.setAttribute('dominant-baseline','middle');
    lbl.setAttribute('font-size','8');
    lbl.setAttribute('font-family','DM Mono,monospace');
    lbl.setAttribute('fill',color);lbl.setAttribute('font-weight','600');
    lbl.textContent=depType;
    svg.appendChild(path);svg.appendChild(bg);svg.appendChild(lbl);
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
  const {start}=getRange();
  const today=new Date();today.setHours(0,0,0,0);
  const offset=daysBetween(start,today);
  const left=Math.max(0,offset*colW-220);
  const wrap=document.getElementById('tlWrap');
  if(wrap) wrap.scrollLeft=left;
}

// ── DRAG & DROP ──────────────────────────────────────────────
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
    el.title=task.name+'\n'+fmtDisp(ns)+' → '+fmtDisp(ne)+'\n'+task.prog+'% · '+(LEVELS[task.type]||'');
  }
  function down(e,m){
    e.preventDefault();
    if(getChildren(task.id).length) return;
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
      if(autoSchedule) applyAutoSchedule();
      renderAll();
      if(task.id<5000){
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
  const lv=document.getElementById('listView')||document.getElementById('ganttBody');
  if(!lv) return;
  const rows=(tasks||[]).map(t=>{
    try{
      return '<tr class="list-tr" onclick="openEdit('+t.id+')">'+
        '<td class="list-td mono">'+esc(t.wbs)+'</td>'+
        '<td class="list-td"><div class="list-name" style="padding-left:'+(getDepth(t)*14)+'px;">'+
          '<span class="list-type">'+(TYPE_ICONS[t.type]||'☑')+'</span>'+
          '<span class="list-title'+(t.type<=2?' bold':'')+'">'+esc(t.name)+'</span>'+
          '<span class="list-badge" style="background:'+(LEVEL_COLORS[t.type]||'#64748b')+'22;color:'+(LEVEL_COLORS[t.type]||'#64748b')+';">'+(LEVELS[t.type]||'')+'</span>'+
        '</div></td>'+
        '<td class="list-td">'+esc(t.owner||'—')+'</td>'+
        '<td class="list-td mono">'+esc(t.start)+'</td>'+
        '<td class="list-td mono">'+esc(t.end)+'</td>'+
        '<td class="list-td"><div class="list-prog"><div class="prog-track"><div class="prog-fill" style="width:'+(t.prog||0)+'%;"></div></div><span>'+(t.prog||0)+'%</span></div></td>'+
        '<td class="list-td center"><span class="rag-pill rag-pill-'+(t.rag||'g')+'"><span class="rag-pill-dot"></span></span></td>'+
        '<td class="list-td center"><button type="button" class="btn btn-ghost" onclick="event.stopPropagation();openEdit('+t.id+')">Edit</button></td>'+
      '</tr>';
    }catch(e){ return ''; }
  }).join('');
  lv.innerHTML='<div class="list-wrap">'+
    '<table class="list-table">'+
      '<thead><tr>'+
        '<th>WBS</th><th>Name</th><th>Owner</th><th>Start</th><th>End</th><th>Progress</th><th>RAG</th><th></th>'+
      '</tr></thead>'+
      '<tbody>'+(rows||'<tr><td colspan="8" class="list-empty">No tasks</td></tr>')+'</tbody>'+
    '</table>'+
    '<button type="button" class="add-new-item-btn" onclick="addNewItem()" style="margin-top:12px;">+ Add a New Item</button>'+
  '</div>';
}
window.renderListView=renderListView;

// ── MODAL: EDIT / ADD ────────────────────────────────────────
function populatePredDropdown(excludeId){
  const sel=document.getElementById('m-pred');
  if(!sel) return;
  sel.innerHTML='<option value="">None</option>';
  tasks.filter(t=>t.id!==excludeId).forEach(t=>{
    const o=document.createElement('option');
    o.value=t.id;
    o.textContent=(t.wbs||t.id)+' — '+(t.name||'').substring(0,30);
    sel.appendChild(o);
  });
}
function populateParentDropdown(excludeId){
  const sel=document.getElementById('m-parent');
  if(!sel) return;
  sel.innerHTML='<option value="">None (top level)</option>';
  tasks.filter(t=>t.id!==excludeId&&t.type<6).forEach(t=>{
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
  document.getElementById('m-type').value=t.type;
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
  document.getElementById('m-type').value='5';
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
    if(parent.type<=1) type=2;
    else if(parent.type===2) type=3;
    else if(parent.type===3) type=5;
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
  selectedTaskId=newTask.id;
  calcWBS();
  if(mainView==='list'){
    renderListView();
    openEdit(newTask.id);
  } else {
    renderAll();
    setTimeout(()=>editName(newTask.id),40);
  }
  persistCreate(newTask);
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
      t.type=typeVal;t.owner=document.getElementById('m-owner').value||'';
      t.prog=parseInt(document.getElementById('m-prog').value)||0;
      t.rag=currentRag;t.ragScp=currentRag;
      if(t.type===1){ t.ragBgt=currentRag; t.ragSch=currentRag; }
      t.notes=document.getElementById('m-notes').value;
      t.parent=parentVal?parseInt(parentVal):null;
      t.predId=predVal?parseInt(predVal):null;
      t.depType=currentDep;
      closeModal('modalEdit');
      if(autoSchedule) applyAutoSchedule();
      renderAll();
      persistSave(t);
      if(autoSchedule) void persistScheduleChanges(t);
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
    insertAfterId=null;
    closeModal('modalEdit');
    renderAll();
    persistCreate(newTask);
  }
}

function deleteItem(){
  if(!editingId) return;
  if(!confirm('Delete this item and all its children?')) return;
  pushHistory();
  const target=tasks.find(t=>t.id===editingId);
  function removeWithChildren(id){
    tasks=tasks.filter(t=>t.id!==id);
    tasks.filter(t=>t.parent===id).forEach(c=>removeWithChildren(c.id));
  }
  removeWithChildren(editingId);
  if(target) persistDelete(target);
  if(selectedTaskId===editingId) selectedTaskId=null;
  closeModal('modalEdit');
  renderAll();
}

function closeModal(id){const el=document.getElementById(id);if(el)el.classList.remove('open');}
function selRag(el,r){
  currentRag=r;
  document.querySelectorAll('.rag-opt').forEach(o=>o.classList.remove('sel-g','sel-a','sel-r'));
  el.classList.add('sel-'+r);
}
function selDep(el,d){
  currentDep=d;
  document.querySelectorAll('.dep-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel');
}

// ─── IMPORT / EXPORT ────────────────────────────────────────
function openImportExport(mode){
  const body=document.getElementById('iebody');
  document.getElementById('ieTitle').textContent=mode==='export'?'Export Project Plan':'Import Project Plan';
  if(mode==='export'){
    body.innerHTML='<div class="ie-section">'+
      '<div class="ie-section-title">📥 Export (Excel-compatible CSV)</div>'+
      '<p style="font-size:12px;color:var(--g500);margin-bottom:10px;">Download your project plan as CSV for offline editing or Excel import.</p>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        '<button class="btn btn-excel" onclick="downloadTemplate(event)">↓ Empty template</button>'+
        '<button class="btn btn-excel" onclick="downloadCurrentPlan(event)">↓ Export Excel (CSV)</button>'+
        '<button class="btn btn-green" onclick="downloadMSProject(event)">↓ Export MS Project (XML)</button>'+
        '<button class="btn btn-ghost" onclick="exportGanttPNG(event)">↓ Export PNG</button>'+
        '<button class="btn btn-ghost" onclick="exportGanttPDF(event)">↓ Export PDF</button>'+
      '</div></div>'+
      '<div class="ie-section" style="margin-bottom:0;"><div class="ie-section-title">📋 Column reference</div>'+
      '<table style="width:100%;font-size:11px;border-collapse:collapse;">'+
        [['WBS','Auto-generated'],['Name*','Work item name'],['Type*','0=Programme,1=Project,2=Phase,3=Workstream,4=Activity,5=Task,6=Milestone'],
         ['Parent_WBS','WBS of parent'],['Owner*','Owner name'],['Start*','YYYY-MM-DD'],['End*','YYYY-MM-DD'],['Duration','Days (inclusive)'],
         ['Progress','0–100'],['RAG*','g, a, or r'],['Predecessor_WBS','WBS of dependency'],['Dep_Type','FS, SS, or EE'],['Notes','Free text']
        ].map(([col,desc])=>'<tr style="border-bottom:1px solid var(--g100);"><td style="padding:5px 8px;font-family:var(--mono);font-weight:600;color:var(--p);">'+col+'</td><td style="padding:5px 8px;color:var(--g500);">'+desc+'</td></tr>').join('')+
      '</table></div>';
  } else {
    body.innerHTML='<div class="ie-section">'+
      '<div class="ie-section-title">📤 Import from CSV or MS Project</div>'+
      '<p style="font-size:12px;color:var(--g500);margin-bottom:10px;">Upload a <strong>.csv</strong> (Jiganto format) or <strong>.xml</strong> (MS Project) file.</p>'+
      '<div style="display:flex;gap:8px;margin-bottom:10px;">'+
        '<button class="btn '+(importMode==='append'?'btn-p':'btn-ghost')+'" onclick="setImportMode(\'append\')">⊕ Append</button>'+
        '<button class="btn '+(importMode==='overwrite'?'btn-p':'btn-ghost')+'" onclick="setImportMode(\'overwrite\')">↺ Overwrite</button>'+
      '</div>'+
      (importMode==='overwrite'?'<div style="font-size:11px;color:var(--amber);background:var(--amber-l);border:1px solid #fcd34d;border-radius:5px;padding:6px 10px;margin-bottom:10px;">⚠ Overwrite will replace your entire project plan.</div>':'')+
      '<div class="drop-zone" id="dropZone" onclick="document.getElementById(\'fileInput\').click()">'+
        '<div style="font-size:22px;margin-bottom:6px;">📁</div>'+
        '<div class="drop-zone-text">Click or drag a <strong>.csv</strong> or <strong>.xml</strong> file here</div>'+
      '</div>'+
      '<input type="file" id="fileInput" accept=".csv,.txt,.xml" style="display:none;" onchange="handleFileSelect(this)">'+
      '<div id="importResult" style="margin-top:8px;font-size:12px;"></div>'+
    '</div>';
    setupDropZone();
  }
  document.getElementById('modalIE').classList.add('open');
}
function setImportMode(m){importMode=m;openImportExport('import');}
function downloadTemplate(ev){
  const btn=ev&&ev.currentTarget?ev.currentTarget:null;
  showLoading('Preparing template…',btn);
  try{
    const header='WBS,Name,Type,Parent_WBS,Owner,Start,End,Progress,RAG,Predecessor_WBS,Dep_Type,Notes\n';
    const example=',"Example Phase",2,,Owner Name,2025-06-01,2025-06-30,0,g,,,\n';
    downloadCSV('jiganto_gantt_template.csv',header+example);
    showToast('✓ Template downloaded','ok');
  } finally {
    hideLoading();
  }
}
function downloadCurrentPlan(ev){
  const btn=ev&&ev.currentTarget?ev.currentTarget:null;
  showLoading('Exporting to Excel…',btn);
  try{
    calcWBS();
    const wbsMap={};
    tasks.forEach(t=>wbsMap[t.id]=t.wbs);
    const header='WBS,Name,Type,Parent_WBS,Owner,Start,End,Duration,Progress,RAG,Predecessor_WBS,Dep_Type,Notes\n';
    const rows=tasks.map(t=>[t.wbs,'"'+t.name.replace(/"/g,'""')+'"',t.type,t.parent?wbsMap[t.parent]:'','"'+(t.owner||'')+'"',t.start,t.end,taskDuration(t),t.prog,t.rag,t.predId?wbsMap[t.predId]:'',t.depType||'FS','"'+(t.notes||'').replace(/"/g,'""')+'"'].join(',')).join('\n');
    downloadCSV('jiganto_gantt_export.csv',header+rows);
    showToast('✓ Excel downloaded','ok');
  }catch(e){
    console.error(e);
    showToast('Excel export failed','err',2800);
  } finally {
    hideLoading();
  }
}
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
    tasks.forEach((t,i)=>{uidMap[t.id]=i+1;});
    const depTypeMap={FS:1,SS:2,EE:3};
    let tasksXml='';
    tasks.forEach(t=>{
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
async function withLoading(msg,fn,btnEl){
  showLoading(msg,btnEl);
  try{
    return await fn();
  } finally {
    hideLoading();
  }
}
function showExportToast(msg){
  // Back-compat shim → unified toast (loading handled separately)
  if(!msg) return;
  const lower=String(msg).toLowerCase();
  if(lower.includes('generating')||lower.includes('exporting')||lower.includes('saving')||lower.includes('importing')||lower.includes('loading')){
    showLoading(msg);
    return;
  }
  hideLoading();
  if(lower.includes('fail')||lower.includes('error')) showToast(msg,'err',2800);
  else if(lower.includes('✓')||lower.includes('downloaded')||lower.includes('saved')||lower.includes('imported')) showToast(msg,'ok',2200);
  else showToast(msg,'info',2200);
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
      if(row?.parentWbs){
        const p=imported.find(x=>x.wbs===row.parentWbs)||tasks.find(x=>x.wbs===row.parentWbs);
        if(p) t.parent=p.id;
      }
      if(row?.predecessorWbs){
        const p=imported.find(x=>x.wbs===row.predecessorWbs)||tasks.find(x=>x.wbs===row.predecessorWbs);
        if(p) t.predId=p.id;
      }
    });
    if(importMode==='overwrite') tasks=tasks.filter(t=>t.type===1);
    tasks=[...tasks,...imported];
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
      headers:apiAuthHeaders(true),
      body:JSON.stringify({mode:mode||'append',items:rows}),
    });
    if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.message||'Import failed');}
    return true;
  }catch(e){console.error('Gantt bulk import failed:',e);return false;}
}
function notifyGanttRefresh(){
  const {projectId}=ganttMeta();
  try{window.parent.postMessage({type:'gantt-saved',projectId},'*');}catch(e){}
}
function parseCSV(file){
  showLoading('Reading CSV…');
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const text=e.target.result;
      const lines=text.split('\n').map(l=>l.trim()).filter(l=>l);
      if(lines.length<2){hideLoading();showImportResult('error','File appears empty.');return;}
      const headers=parseCSVLine(lines[0]).map(h=>h.trim().toLowerCase().replace(/\s/g,'_'));
      const rows=[];let errors=0;
      lines.slice(1).forEach((line,idx)=>{
        const cols=parseCSVLine(line);
        if(cols.length<6){errors++;return;}
        const get=col=>{const i=headers.indexOf(col);return i>=0?(cols[i]||'').trim():'';};
        const name=get('name');const start=get('start');const end=get('end')||start;
        if(!name||!start){errors++;return;}
        rows.push({
          wbs:get('wbs')||('IMP-'+(idx+1)),
          name,
          type:parseInt(get('type'))||5,
          parentWbs:get('parent_wbs')||null,
          predecessorWbs:get('predecessor_wbs')||null,
          owner:get('owner')||'',
          start,end,
          progress:parseInt(get('progress'))||0,
          rag:get('rag')||'g',
          notes:get('notes')||'',
          depType:get('dep_type')||'FS',
        });
      });
      hideLoading();
      await applyImportedRows(rows,'CSV');
    }catch(err){
      hideLoading();
      showImportResult('error',err.message||'CSV import failed');
      showToast('Import failed','err',2800);
    }
  };
  reader.onerror=()=>{hideLoading();showToast('Could not read file','err',2800);};
  reader.readAsText(file);
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
// INLINE CELL EDITING
// ══════════════════════════════════════════════════════════════
function makeEditable(td, task, field, options=null){
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
    const commit=()=>{
      const val=sel.value;
      if(String(val)!==original) pushHistory();
      task[field]=val;
      td.classList.remove('editing');
      renderAll();
      if(task.id<5000) persistSave(task);
      if(options?.onCommit) options.onCommit();
    };
    sel.onchange=commit;sel.onblur=commit;
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
    inp.onchange=()=>{if(Number(inp.value)!==Number(original)) pushHistory();task[field]=Number(inp.value);renderAll();if(task.id<5000) persistSave(task);};
    inp.onblur=()=>{task[field]=Number(inp.value);td.classList.remove('editing');renderAll();};
    wrap.appendChild(inp);wrap.appendChild(lbl);
    td.innerHTML='';td.appendChild(wrap);inp.focus();
  } else {
    const inp=document.createElement('input');
    inp.className='ie-input';
    inp.type=options?.type||'text';
    inp.value=original;
    td.innerHTML='';td.appendChild(inp);inp.focus();inp.select();
    const commit=()=>{
      const v=inp.value.trim();
      if(v&&v!==original) pushHistory();
      if(v) task[field]=v;
      td.classList.remove('editing');
      renderAll();
      if(task.id<5000) persistSave(task);
      if(options?.onCommit) options.onCommit();
    };
    inp.onblur=commit;
    inp.onkeydown=(e)=>{
      if(e.key==='Enter'){e.preventDefault();commit();}
      if(e.key==='Escape'){td.classList.remove('editing');renderAll();}
    };
  }
}

function inlineEditPred(id,cell){
  const t=tasks.find(x=>x.id===id);
  if(!t||getChildren(t.id).length||t.type===6) return;
  if(cell.classList.contains('editing')) return;
  cell.classList.add('editing');
  const sel=document.createElement('select');
  sel.className='ie-select';
  const none=document.createElement('option');
  none.value=''; none.textContent='—'; sel.appendChild(none);
  tasks.filter(x=>x.id!==id&&getChildren(x.id).length===0).forEach(x=>{
    const o=document.createElement('option');
    o.value=String(x.id);
    o.textContent=(x.wbs?x.wbs+' · ':'')+x.name;
    if(t.predId===x.id) o.selected=true;
    sel.appendChild(o);
  });
  cell.innerHTML=''; cell.appendChild(sel); sel.focus();
  const commit=()=>{
    const v=sel.value?parseInt(sel.value,10):null;
    if(v!==t.predId){ pushHistory(); t.predId=v; if(autoSchedule) applyAutoSchedule(); if(t.id<5000) persistSave(t); if(autoSchedule) void persistScheduleChanges(t); }
    cell.classList.remove('editing');
    renderAll();
  };
  sel.onchange=commit;
  sel.onblur=commit;
}
function inlineEditOwner(id,cell){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  const ownerChoices=OWNERS.length?OWNERS.map(o=>[o,o]):[['','—']];
  makeEditable(cell,t,'owner',{type:'select',choices:ownerChoices});
}
function inlineEditDate(id,field,cell){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  if(getChildren(t.id).length) return;
  makeEditable(cell,t,field,{type:'date',onCommit:()=>{
    if(autoSchedule) applyAutoSchedule();
    if(t.id<5000){ persistSave(t); if(autoSchedule) persistScheduleChanges(t); }
  }});
}
function inlineEditDuration(id,cell){
  const t=tasks.find(x=>x.id===id);
  if(!t||getChildren(t.id).length||t.type===6) return;
  if(cell.classList.contains('editing')) return;
  cell.classList.add('editing');
  const original=taskDuration(t);
  const inp=document.createElement('input');
  inp.className='ie-input'; inp.type='number'; inp.min=0; inp.step=1; inp.value=original;
  cell.innerHTML=''; cell.appendChild(inp); inp.focus(); inp.select();
  const commit=()=>{
    const days=Math.max(0,parseInt(inp.value,10)||0);
    if(days!==original) pushHistory();
    setTaskDuration(t,days);
    cell.classList.remove('editing');
    afterTaskDateChange(t);
  };
  inp.onblur=commit;
  inp.onkeydown=(e)=>{
    if(e.key==='Enter'){e.preventDefault();commit();}
    if(e.key==='Escape'){cell.classList.remove('editing');renderAll();}
  };
}
function inlineEditProg(id,cell){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  makeEditable(cell,t,'prog',{type:'range'});
}
function cycleRagDim(id,dim){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  const field=dim==='bgt'?'ragBgt':dim==='sch'?'ragSch':'ragScp';
  const cycle={g:'a',a:'r',r:'g'};
  pushHistory();
  t[field]=cycle[ragField(t,dim)]||'g';
  if(field==='ragScp') t.rag=t.ragScp;
  renderAll();
  if(t.id<5000) persistSave(t);
}
function cycleRag(id){ cycleRagDim(id,'scp'); }

function bindCustomCellClicks(){
  document.querySelectorAll('.task-custom-col[data-col]').forEach(cell=>{
    cell.onclick=(e)=>{
      e.stopPropagation();
      const id=Number(cell.dataset.id);
      const colId=cell.dataset.col;
      const t=tasks.find(x=>x.id===id);if(!t) return;
      if(!t.customData) t.customData={};
      const col=customCols.find(c=>String(c.id)===String(colId));if(!col) return;
      const proxy={};
      proxy[colId]=t.customData[colId]||'';
      if(col.type==='select'){
        makeEditable(cell,proxy,colId,{type:'select',choices:(col.opts||[]).map(o=>[o,o])});
      } else {
        makeEditable(cell,proxy,colId,{type:'text'});
      }
      cell.addEventListener('blur',()=>{t.customData[colId]=proxy[colId];},{once:true});
    };
  });
}

// ══════════════════════════════════════════════════════════════
// INTERACTIVE DEPENDENCY DRAWING
// ══════════════════════════════════════════════════════════════
function toggleDepDraw(){
  depDrawMode=!depDrawMode;
  depSourceId=null;
  const btn=document.getElementById('depDrawBtn');
  if(btn) btn.classList.toggle('on',depDrawMode);
  const body=document.querySelector('.gantt-body');
  if(body) body.classList.toggle('dep-draw-mode',depDrawMode);
  if(!depDrawMode){
    document.querySelectorAll('.gantt-bar.dep-source').forEach(b=>b.classList.remove('dep-source'));
    showDepToast(null);
  } else {
    showDepToast('Click a bar to set as dependency source');
  }
}
function showDepToast(msg){
  let toast=document.getElementById('depToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='depToast';
    toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--p);color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:500;z-index:200;transition:opacity .2s;box-shadow:0 4px 12px rgba(0,0,0,.2);pointer-events:none;opacity:0;';
    document.body.appendChild(toast);
  }
  clearTimeout(toast._hideT);
  if(msg){
    toast.textContent=msg;
    toast.style.opacity='1';
    toast._hideT=setTimeout(()=>{toast.style.opacity='0';},3000);
  } else {
    toast.style.opacity='0';
  }
}
function handleBarClickForDep(barEl,taskId){
  if(!depDrawMode) return false;
  if(!depSourceId){
    depSourceId=taskId;
    document.querySelectorAll('.gantt-bar.dep-source').forEach(b=>b.classList.remove('dep-source'));
    barEl.classList.add('dep-source');
    showDepToast('Now click the target bar to create the dependency');
    return true;
  } else {
    if(taskId===depSourceId){showDepToast('Cannot link a task to itself');return true;}
    const targetTask=tasks.find(x=>x.id===taskId);
    if(targetTask){
      targetTask.predId=depSourceId;
      targetTask.depType=currentDep||'FS';
      showDepToast('✓ Dependency created ('+targetTask.depType+')');
      if(targetTask.id<5000) persistSave(targetTask);
    }
    depSourceId=null;
    document.querySelectorAll('.gantt-bar.dep-source').forEach(b=>b.classList.remove('dep-source'));
    depDrawMode=false;
    const btn=document.getElementById('depDrawBtn');
    if(btn) btn.classList.remove('on');
    const body=document.querySelector('.gantt-body');
    if(body) body.classList.remove('dep-draw-mode');
    renderAll();
    return true;
  }
}

// ══════════════════════════════════════════════════════════════
// API PERSISTENCE (saves back to Jiganto backend)
// ID ranges: phases=1000+id, workstreams=2000+id, tasks=3000+id, milestones=4000+id
// Items with id>=5000 are locally added and not yet in the DB (Phase 2)
// ══════════════════════════════════════════════════════════════
const RAG_TO_RAGSTATUS={g:'green',a:'amber',r:'red'};
function taskStatusFromGantt(t){
  if((t.prog||0)>=100) return 'done';
  if((t.prog||0)>0) return 'in_progress';
  return 'todo';
}
function notifyGanttParent(){
  const projectId=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||null;
  try{ window.parent.postMessage({type:'gantt-saved',projectId},'*'); }catch(e){}
}
const ID_PFX={project:1,phase:1000,ws:2000,task:3000,ms:4000};

function ganttMeta(){
  const d=window.GANTT_INIT_DATA||{};
  return {projectId:d.projectId,tenantId:d.tenantId};
}
function apiAuthHeaders(json){
  const h={};
  if(json) h['Content-Type']='application/json';
  const token=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.authToken)||'';
  if(token) h['Authorization']='Bearer '+token;
  return h;
}

function resolvePhaseId(parentId){
  if(!parentId||parentId===ID_PFX.project) return null;
  if(parentId>ID_PFX.phase&&parentId<ID_PFX.ws) return parentId-ID_PFX.phase;
  const p=tasks.find(t=>t.id===parentId);
  return p?resolvePhaseId(p.parent):null;
}

function resolveParentTaskId(parentId){
  if(parentId>ID_PFX.task&&parentId<ID_PFX.ms) return parentId-ID_PFX.task;
  return null;
}

function countPhases(){
  return tasks.filter(t=>t.type===2&&t.id<ID_PFX.ws).length;
}

async function persistCreate(t){
  const {projectId,tenantId}=ganttMeta();
  if(!projectId||!tenantId) return;
  showLoading('Saving new item…');
  const h=apiAuthHeaders(true);
  const post=(url,body)=>fetch(url,{method:'POST',credentials:'include',headers:h,body:JSON.stringify(body)});
  const rag=RAG_TO_RAGSTATUS[t.rag]||'green';
  const phaseId=resolvePhaseId(t.parent);
  const parentTaskId=resolveParentTaskId(t.parent);
  const ownerMap=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.ownerIdMap)||{};
  const assigneeId=t.owner?ownerMap[t.owner]||null:null;
  try{
    if(t.type===2){
      const created=await post('/api/pm/phases',{tenantId,projectId,name:t.name,phaseNumber:countPhases()+1,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,ragStatus:rag,order:countPhases()}).then(r=>r.json());
      if(created?.id){
        const oldId=t.id;
        t.id=ID_PFX.phase+created.id;
        tasks.filter(x=>x.parent===oldId).forEach(c=>{c.parent=t.id;});
        if(selectedTaskId===oldId) selectedTaskId=t.id;
      }
    } else if(t.type===3){
      const created=await post('/api/pm/workstreams',{tenantId,projectId,phaseId,name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,ragStatus:rag,order:tasks.filter(x=>x.type===3).length}).then(r=>r.json());
      if(created?.id){
        const oldId=t.id;
        t.id=ID_PFX.ws+created.id;
        tasks.filter(x=>x.parent===oldId).forEach(c=>{c.parent=t.id;});
        if(selectedTaskId===oldId) selectedTaskId=t.id;
      }
    } else if(t.type===4||t.type===5){
      const created=await post('/api/pm/tasks',{tenantId,projectId,phaseId,parentTaskId,name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,status:taskStatusFromGantt(t),isSummary:t.type===4,ganttType:t.type===4?'summary':'task',order:tasks.filter(x=>x.type===4||x.type===5).length,assigneeId:assigneeId||undefined}).then(r=>r.json());
      if(created?.id){
        const oldId=t.id;
        t.id=ID_PFX.task+created.id;
        tasks.filter(x=>x.parent===oldId||x.predId===oldId).forEach(c=>{
          if(c.parent===oldId) c.parent=t.id;
          if(c.predId===oldId) c.predId=t.id;
        });
        if(selectedTaskId===oldId) selectedTaskId=t.id;
      }
    } else if(t.type===6){
      const created=await post('/api/pm/milestones',{tenantId,projectId,phaseId,name:t.name,dueDate:t.start,status:t.prog>=100?'completed':'pending',ragStatus:rag,order:tasks.filter(x=>x.type===6).length}).then(r=>r.json());
      if(created?.id){
        const oldId=t.id;
        t.id=ID_PFX.ms+created.id;
        if(selectedTaskId===oldId) selectedTaskId=t.id;
      }
    }
    calcWBS();
    renderAll();
    showSaveIndicator();
    notifyGanttParent();
  } catch(e){
    console.error('Gantt create failed:',e);
    showToast('Save failed','err',2800);
  } finally {
    hideLoading();
  }
}

async function persistDelete(t){
  if(!t||t.id>=5000) return;
  showLoading('Deleting…');
  const h=apiAuthHeaders();
  const del=(url)=>fetch(url,{method:'DELETE',credentials:'include',headers:h});
  try{
    if(t.type===2&&t.id>ID_PFX.phase&&t.id<ID_PFX.ws) await del('/api/pm/phases/'+(t.id-ID_PFX.phase));
    else if(t.type===3&&t.id>ID_PFX.ws&&t.id<ID_PFX.task) await del('/api/pm/workstreams/'+(t.id-ID_PFX.ws));
    else if((t.type===4||t.type===5)&&t.id>ID_PFX.task&&t.id<ID_PFX.ms) await del('/api/pm/tasks/'+(t.id-ID_PFX.task));
    else if(t.type===6&&t.id>ID_PFX.ms&&t.id<5000) await del('/api/pm/milestones/'+(t.id-ID_PFX.ms));
    showToast('✓ Deleted','ok');
    notifyGanttParent();
  } catch(e){
    console.error('Gantt delete failed:',e);
    showToast('Delete failed','err',2800);
  } finally {
    hideLoading();
  }
}

async function persistSave(t){
  if(!t||t.id>=5000) return; // local-only items
  showLoading('Saving…');
  const h=apiAuthHeaders(true);
  const put=(url,body)=>fetch(url,{method:'PUT',credentials:'include',headers:h,body:JSON.stringify(body)});
  const ownerMap=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.ownerIdMap)||{};
  const projectId=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||null;
  function mapParent(parent){
    if(!parent||parent===1) return {phaseId:null,parentTaskId:null,parentPhaseId:null};
    if(parent>=3000&&parent<4000) return {phaseId:null,parentTaskId:parent-3000,parentPhaseId:null};
    if(parent>=2000&&parent<3000) return {phaseId:null,parentTaskId:null,parentPhaseId:null,workstreamPhase:null};
    if(parent>=1000&&parent<2000) return {phaseId:parent-1000,parentTaskId:null,parentPhaseId:parent-1000};
    return {phaseId:null,parentTaskId:null,parentPhaseId:null};
  }
  function notifyParent(){
    try{ window.parent.postMessage({type:'gantt-saved',projectId},'*'); }catch(e){}
  }
  try{
    if(t.type===1&&projectId){
      await put('/api/pm/projects/'+projectId,{
        startDate:t.start,endDate:t.end,progress:t.prog,
        ragStatus:RAG_TO_RAGSTATUS[t.ragScp||t.rag]||'green',
        financialRag:RAG_TO_RAGSTATUS[t.ragBgt||t.rag]||'green',
        scheduleRag:RAG_TO_RAGSTATUS[t.ragSch||t.rag]||'green',
        description:t.notes||undefined,
      });
    } else if(t.type===2&&t.id>1000&&t.id<2000){
      const id=t.id-1000;
      await put('/api/pm/phases/'+id,{name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,ragStatus:RAG_TO_RAGSTATUS[t.ragScp||t.rag]||'green',description:t.notes||undefined,wbsCode:t.wbs||undefined});
    } else if(t.type===3&&t.id>2000&&t.id<3000){
      const id=t.id-2000;
      const parent=mapParent(t.parent);
      await put('/api/pm/workstreams/'+id,{name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,ragStatus:RAG_TO_RAGSTATUS[t.ragScp||t.rag]||'green',description:t.notes||undefined,wbsCode:t.wbs||undefined,...(parent.phaseId?{phaseId:parent.phaseId}:{})});
    } else if((t.type===4||t.type===5)&&t.id>3000&&t.id<4000){
      const id=t.id-3000;
      const parent=mapParent(t.parent);
      const predIds=t.predId&&t.predId>=3000&&t.predId<4000?[t.predId-3000]:null;
      const assigneeId=t.owner?ownerMap[t.owner]||null:null;
      await put('/api/pm/tasks/'+id,{
        name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,
        status:taskStatusFromGantt(t),description:t.notes||undefined,
        wbsCode:t.wbs||undefined,phaseId:parent.phaseId||undefined,
        parentTaskId:parent.parentTaskId||undefined,
        predecessorIds:predIds||undefined,assigneeId:assigneeId||undefined,
        isSummary:t.type===4,
      });
    } else if(t.type===6&&t.id>4000&&t.id<5000){
      const id=t.id-4000;
      const parent=mapParent(t.parent);
      await put('/api/pm/milestones/'+id,{name:t.name,dueDate:t.start,status:t.prog>=100?'completed':'pending',notes:t.notes||undefined,...(parent.phaseId?{phaseId:parent.phaseId}:{})});
    }
    showSaveIndicator();
    notifyParent();
  } catch(e){
    console.error('Gantt persist failed:',e);
    showToast('Save failed','err',2800);
  } finally {
    hideLoading();
  }
}

function showSaveIndicator(){
  showToast('✓ Saved','ok',1800);
}

// ══════════════════════════════════════════════════════════════
// DATA INIT — reads window.GANTT_INIT_DATA injected by React
// ══════════════════════════════════════════════════════════════
function loadFromInitData(){
  const d=window.GANTT_INIT_DATA;
  if(!d||!Array.isArray(d.tasks)){tasks=[];nextId=5000;return;}
  tasks=d.tasks.map(t=>normalizeTaskRags(Object.assign({},t)));
  nextId=d.nextId||5000;
  // Populate OWNERS
  OWNERS.length=0;
  (d.owners||[]).forEach(o=>OWNERS.push(o));
  // Repopulate owner filter dropdown
  const fo=document.getElementById('f-owner');
  if(fo){
    fo.innerHTML='<option value="">All owners</option>';
    OWNERS.forEach(o=>{const opt=document.createElement('option');opt.value=o;opt.textContent=o;fo.appendChild(opt);});
  }
  // Update modal owner select
  const mo=document.getElementById('m-owner');
  if(mo&&OWNERS.length){
    mo.innerHTML='';
    OWNERS.forEach(o=>{const opt=document.createElement('option');opt.value=o;opt.textContent=o;mo.appendChild(opt);});
  }
  loadCustomCols();
  renderCustomHeaders();
}

// ── INIT ─────────────────────────────────────────────────────
loadFromInitData();
pushHistory();
setupScrollSync();
setupPanelSplitter();
renderAll();
updateUndoRedoButtons();
setTimeout(()=>jumpToToday(),200);
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();redo();}
});

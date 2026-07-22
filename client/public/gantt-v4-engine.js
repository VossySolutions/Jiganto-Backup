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
  return t;
}
function buildRagPillCell(t,id,dim){
  const v=ragField(t,dim);
  const lbl=(RAG_PILL_LABELS[dim]||RAG_PILL_LABELS.scp)[v]||'On Track';
  return '<div class="task-rag-pill-col" onclick="event.stopPropagation();cycleRagDim('+id+',\''+dim+'\')" title="Click to cycle '+dim+' RAG">'+
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
  try{
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
  } finally {
    hideLoading();
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
    el.innerHTML='<span><strong>Critical path on</strong> — click a cell in the <em>Pred</em> column (or open Edit → Predecessor) to link tasks. The longest zero-slack chain will highlight in red.</span>';
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
    // Bottom switch always collapses/expands the whole plan
    if(sw&&sw.checked) collapseAll(true);
    else expandAll(true);
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
      const sel=document.getElementById('zoomToSelect');
      if(sel) sel.value=zoom;
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
  if(history.length>MAX_HISTORY){
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
  updateUndoRedoButtons();
  renderAll();
  if(selectedTaskId!=null) selectTask(selectedTaskId);
}
function undo(){
  if(historyIdx<0||!history.length) return;
  showLoading('Undoing…');
  try{
    const live=snapshotTasks();
    // Live mutated past tip (e.g. drag) — stash live for Redo, then restore tip
    if(live!==history[historyIdx]){
      history.splice(historyIdx+1);
      history.push(live);
      if(history.length>MAX_HISTORY){
        history.shift();
        // tip index moves left by 1 after shift
        historyIdx=Math.max(0,historyIdx-1);
      }
      restoreHistory(historyIdx);
      return;
    }
    if(historyIdx<=0) return;
    restoreHistory(historyIdx-1);
  } finally {
    hideLoading();
  }
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
/** Classic ES/EF + LS/LF slack on the dependency network only (predId links). */
function computeCriticalPath(){
  criticalIds=new Set();
  if(!showCP) return;
  if(!tasks.some(t=>t.predId)) return;

  const byId=new Map(tasks.map(t=>[t.id,t]));
  const successors=new Map();
  tasks.forEach(t=>{
    if(!t.predId||!byId.has(t.predId)) return;
    if(!successors.has(t.predId)) successors.set(t.predId,[]);
    successors.get(t.predId).push(t.id);
  });
  const inNetwork=new Set();
  tasks.forEach(t=>{
    if(t.predId&&byId.has(t.predId)){
      inNetwork.add(t.id);
      inNetwork.add(t.predId);
    }
  });
  if(!inNetwork.size) return;

  const durDays=(t)=>{
    if(t.type===6) return 0;
    return Math.max(1,taskDurationDays(t.start,t.end)+1);
  };

  // Forward: earliest start / finish (in day units from an arbitrary epoch)
  const es=new Map(), ef=new Map();
  function calcForward(id,visiting){
    if(es.has(id)) return;
    if(visiting.has(id)) return;
    visiting.add(id);
    const t=byId.get(id);
    if(!t){ visiting.delete(id); return; }
    let start=0;
    if(t.predId&&byId.has(t.predId)){
      calcForward(t.predId,visiting);
      const pred=byId.get(t.predId);
      const dep=t.depType||'FS';
      const pEs=es.get(t.predId)||0;
      const pEf=ef.get(t.predId)||0;
      if(dep==='FS') start=pEf;
      else if(dep==='SS') start=pEs;
      else start=Math.max(0,pEf-durDays(t)); // FF
    }
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
    const succs=(successors.get(id)||[]).filter(sid=>inNetwork.has(sid));
    let finish=projectEnd;
    if(succs.length){
      finish=Math.min(...succs.map(sid=>{
        calcBackward(sid,visiting);
        const s=byId.get(sid);
        const dep=(s&&s.depType)||'FS';
        const sLs=ls.get(sid)||0;
        const sLf=lf.get(sid)||0;
        if(dep==='FS') return sLs;          // pred must finish before succ starts
        if(dep==='SS') return sLs;          // pred start aligned → treat LF as succ LS + pred dur later
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
  const result=[];
  const seen=new Set();
  function walk(parentId){
    tasks.filter(t=>t.parent===parentId).forEach(t=>{
      if(seen.has(t.id)) return;
      seen.add(t.id);
      result.push(t);
      walk(t.id);
    });
  }
  walk(null);
  tasks.forEach(t=>{ if(!seen.has(t.id)){ seen.add(t.id); result.push(t); } });
  return result;
}
function getVisible(){
  const fl=document.getElementById('f-level')?.value||'';
  const fo=document.getElementById('f-owner')?.value||'';
  const frDim=document.getElementById('f-rag-dim')?.value||'';
  const fr=document.getElementById('f-rag')?.value||'';
  const fq=(document.getElementById('f-search')?.value||'').trim().toLowerCase();
  return getOrderedTasks().filter(t=>{
    // Hide if any ancestor is collapsed
    let p=t.parent;
    const seen=new Set();
    while(p!==null){
      if(seen.has(p)||p===t.id) break;
      seen.add(p);
      if(collapsed[p]) return false;
      const pt=tasks.find(x=>x.id===p);
      if(!pt||pt.parent===pt.id) break;
      p=pt.parent;
    }
    if(fl!==''&&String(t.type)!==fl) return false;
    if(fo&&t.owner!==fo) return false;
    if(fr){
      if(frDim){
        if(ragField(t,frDim)!==fr) return false;
      } else if(ragField(t,'bgt')!==fr&&ragField(t,'sch')!==fr&&ragField(t,'scp')!==fr){
        return false;
      }
    }
    if(fq&&!(t.name||'').toLowerCase().includes(fq)&&!(t.wbs||'').toLowerCase().includes(fq)) return false;
    return true;
  });
}

/** Place task in the array immediately after its parent (and parent's subtree) for clear hierarchy */
function moveTaskAfterParent(task){
  const from=tasks.findIndex(x=>x.id===task.id);
  if(from<0) return;
  tasks.splice(from,1);
  if(task.parent===null){
    tasks.push(task);
    return;
  }
  // Find end of parent's subtree in current array
  let insertAt=tasks.findIndex(x=>x.id===task.parent);
  if(insertAt<0){ tasks.push(task); return; }
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
    if(menu.parentElement!==document.body) document.body.appendChild(menu);
    const r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    menu.style.left=Math.max(8,r.left)+'px';
    menu.removeAttribute('hidden');
    const close=(ev)=>{
      if(ev.target.closest&&(ev.target.closest('#ragFilterBtn')||ev.target.closest('#ragFilterMenu'))) return;
      menu.setAttribute('hidden','');
      document.removeEventListener('mousedown',close,true);
    };
    setTimeout(()=>document.addEventListener('mousedown',close,true),0);
  } else {
    menu.setAttribute('hidden','');
  }
}
function setRagFilter(dim,val,el){
  const dimEl=document.getElementById('f-rag-dim');
  const hidden=document.getElementById('f-rag');
  if(dimEl) dimEl.value=dim||'';
  if(hidden) hidden.value=val||'';
  const key=(dim&&val)?(dim+':'+val):'';
  document.querySelectorAll('#ragFilterMenu .tb-filter-opt').forEach(b=>{
    b.classList.toggle('on',(b.getAttribute('data-rag-key')||'')===key);
  });
  const btn=document.getElementById('ragFilterBtn');
  if(btn) btn.classList.toggle('active',!!val);
  const menu=document.getElementById('ragFilterMenu');
  if(menu) menu.setAttribute('hidden','');
  renderAll();
}
window.toggleRagFilterMenu=toggleRagFilterMenu;
window.setRagFilter=setRagFilter;

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
function toggleFullscreen(){
  const root=document.querySelector('.main')||document.documentElement;
  if(!root) return;
  const btn=document.getElementById('fullscreenBtn');
  showLoading(document.fullscreenElement?'Exiting fullscreen…':'Entering fullscreen…');
  const done=()=>{
    hideLoading();
    if(btn) btn.classList.toggle('on',!!document.fullscreenElement);
  };
  if(!document.fullscreenElement){
    root.requestFullscreen?.().then(done).catch(()=>{done();showToast('Fullscreen not available','err',2500);});
  } else {
    document.exitFullscreen?.().then(done).catch(()=>{done();});
  }
}
document.addEventListener('fullscreenchange',()=>{
  const btn=document.getElementById('fullscreenBtn');
  if(btn) btn.classList.toggle('on',!!document.fullscreenElement);
});

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

    if(v==='list'){
      if(gv){ gv.hidden=true; gv.style.display='none'; }
      if(lv){ lv.hidden=false; lv.style.display='block'; }
      renderListView();
      return;
    }

    if(lv){ lv.hidden=true; lv.style.display='none'; }
    if(gv){ gv.hidden=false; gv.style.display='flex'; }
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
  calcWBS();
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
  const prevScrollTop=ts.scrollTop||0;
  const {start,end}=getRange();
  const totalDays=daysBetween(start,end);
  const totalW=totalDays*colW;
  renderTaskPanel();
  renderCustomHeaders();
  renderTimeline(start,end,totalW);
  positionTodayLine(start);
  if(selectedTaskId!=null) selectTask(selectedTaskId);
  if(!scrollSyncing){
    scrollSyncing=true;
    ts.scrollTop=prevScrollTop;
    tw.scrollTop=prevScrollTop;
    const th=document.getElementById('tlHeader');
    if(th) th.style.transform='translateX('+(-tw.scrollLeft)+'px)';
    requestAnimationFrame(()=>{scrollSyncing=false;});
  }
  updateCpBanner();
}

// ── TASK PANEL ───────────────────────────────────────────────
function renderTaskPanel(){
  const scroll=document.getElementById('taskScroll');
  if(!scroll) return;
  const visible=getVisible();
  if(!visible.length){
    const hasFilters=!!(
      (document.getElementById('f-level')?.value)||
      (document.getElementById('f-owner')?.value)||
      (document.getElementById('f-rag')?.value)||
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
    scroll.innerHTML=visible.map(t=>buildTaskRowHTML(t)).join('');
    bindCustomCellClicks();
  }
  if(selectedTaskId!=null){
    const r=document.getElementById('tr-'+selectedTaskId);
    if(r) r.classList.add('selected');
  }
}

function getDepth(t){
  let d=0,cur=t;
  const seen=new Set();
  while(cur.parent!==null){
    if(seen.has(cur.id)) break;
    seen.add(cur.id);
    const p=tasks.find(x=>x.id===cur.parent);
    if(!p||p.id===cur.id) break;
    cur=p; d++;
    if(d>20) break;
  }
  return d;
}

// Build inline-editable task row HTML
function buildTaskRowHTML(t){
  const depth=getDepth(t);
  const indentPx=depth*18;
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
    '<div class="task-pred-col ie-cell" onclick="event.stopPropagation();inlineEditPred('+t.id+',this)" title="Click to set predecessor (used by Critical path)">'+
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
    '<div class="task-row-add-col" aria-hidden="true"></div>'+
    '<div class="grid-filler"></div>'+
    '<div class="row-insert-hit" onclick="event.stopPropagation()">'+
      '<button type="button" class="row-insert-btn" onclick="event.stopPropagation();insertRowAfter('+t.id+')" title="Insert row below" aria-label="Insert row">+</button>'+
    '</div>'+
  '</div>';
}

/** Insert a new sibling row after the given task (same parent). */
function insertRowAfter(afterId){
  const after=tasks.find(x=>x.id===afterId);
  if(!after){ addNewItem(); return; }
  quickAddTask(after.parent, after.id);
}

function editName(id){
  const el=document.getElementById('tn-'+id)||document.getElementById('ln-'+id);
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
  renderAll();
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
  showLoading('Collapsing…');
  try{
    const selected=!forceAll?getSelectedTask():null;
    if(selected){
      const hasKids=tasks.some(c=>c.parent===selected.id);
      if(!hasKids){
        showToast('Select a folder (row with children), or clear selection to collapse all','info',2800);
        return;
      }
      collapseSubtree(selected.id);
      // Keep selection so user can expand the same folder again
      selectTask(selected.id);
      showToast('Collapsed "'+selected.name+'" and subfolders','ok',2000);
    } else {
      collapsed={};
      tasks.forEach(t=>{ if(tasks.some(c=>c.parent===t.id)) collapsed[t.id]=true; });
      const sw=document.getElementById('switchCollapse');
      if(sw) sw.checked=true;
      showToast('Collapsed all folders','ok',1800);
    }
    renderAll();
  } finally {
    hideLoading();
  }
}
/**
 * Toolbar Expand:
 * - Selected folder → expand that folder + all nested folders
 * - No selection → expand entire structure
 */
function expandAll(forceAll){
  showLoading('Expanding…');
  try{
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
    renderAll();
  } finally {
    hideLoading();
  }
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
  calcWBS();
  pushHistory(); // after-state so Redo works
  renderAll();
  selectTask(t.id);
  flashTaskRow(t.id);
  showToast('Indented under "'+newParent.name+'"','ok',2200);
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
    el.className='milestone-diamond'+(isCrit?' critical':'');
    el.dataset.id=String(t.id);
    el.style.cssText='left:'+(left-6)+'px;top:'+(rowTop+(ROW_H-12)/2)+'px;width:12px;height:12px;';
    el.title=t.name+' · '+fmtDisp(D(eff.start))+(isCrit?' · Critical':'');
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
/** Draw a clear ◀ / ▶ arrowhead (not a marker — markers fail in srcdoc iframes) */
function appendDepArrow(svg,xFrom,yFrom,x2,y2,color,size){
  const dx=x2-xFrom, dy=y2-yFrom;
  const len=Math.hypot(dx,dy)||1;
  const ux=dx/len, uy=dy/len;
  const s=Math.max(size||10, 10);
  // Tip at (x2,y2); base centered behind tip along the segment
  const bx=x2-ux*s, by=y2-uy*s;
  const px=-uy, py=ux;
  const w=s*0.62;
  const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  poly.setAttribute('points',
    x2.toFixed(1)+','+y2.toFixed(1)+' '+
    (bx+px*w).toFixed(1)+','+(by+py*w).toFixed(1)+' '+
    (bx-px*w).toFixed(1)+','+(by-py*w).toFixed(1)
  );
  poly.setAttribute('fill',color);
  poly.setAttribute('stroke',color);
  poly.setAttribute('stroke-width','1');
  poly.setAttribute('stroke-linejoin','round');
  poly.style.pointerEvents='none';
  svg.appendChild(poly);
}
function renderDeps(visible,start){
  const svg=document.getElementById('depSvg');
  if(!svg) return;
  svg.innerHTML='';
  const tipGap=8; // keep tip clearly outside the bar so arrow isn't covered
  visible.forEach(t=>{
    if(!t.predId) return;
    const fromT=tasks.find(x=>x.id===t.predId);
    if(!fromT) return;
    const fp=barPos[fromT.id];
    const tp=barPos[t.id];
    if(!fp||!tp) return;
    const depType=t.depType||'FS';
    let x1,y1,x2,y2;
    if(depType==='FS'){x1=fp.left+fp.width;y1=fp.midY;x2=tp.left-tipGap;y2=tp.midY;}
    else if(depType==='SS'){x1=fp.left;y1=fp.midY;x2=tp.left-tipGap;y2=tp.midY;}
    else{x1=fp.left+fp.width;y1=fp.midY;x2=tp.left+tp.width+tipGap;y2=tp.midY;}
    const isCrit=showCP&&criticalIds.has(t.id)&&criticalIds.has(fromT.id);
    const color=isCrit?'#c62828':'#546e7a';

    const stub=14;
    let elbowX,d,labelX,labelY,ax,ay;
    if(Math.abs(y2-y1)<3){
      // Keep a horizontal approach long enough for a visible arrow
      const mid=x1+(x2-x1)*0.5;
      d='M'+x1+','+y1+' H'+x2;
      labelX=mid; labelY=y1-10;
      ax=x2-Math.sign(x2-x1||1)*24; ay=y1;
      if(Math.abs(x2-x1)<20){ ax=x1; }
    } else if(depType==='FS'||depType==='SS'){
      if(x2>=x1+stub){
        elbowX=x1+stub;
      } else {
        elbowX=Math.max(x1, tp.left+tp.width)+stub;
      }
      d='M'+x1+','+y1+' H'+elbowX+' V'+y2+' H'+x2;
      labelX=elbowX; labelY=(y1+y2)/2;
      ax=elbowX; ay=y2;
    } else {
      elbowX=Math.max(x1,x2)+stub;
      d='M'+x1+','+y1+' H'+elbowX+' V'+y2+' H'+x2;
      labelX=elbowX; labelY=(y1+y2)/2;
      ax=elbowX; ay=y2;
    }

    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',d);
    path.setAttribute('fill','none');
    path.setAttribute('stroke',color);
    path.setAttribute('stroke-width',isCrit?'2.25':'1.5');
    path.setAttribute('stroke-linejoin','round');
    path.setAttribute('stroke-linecap','butt');
    if(!isCrit) path.setAttribute('stroke-dasharray','4 3');
    path.style.pointerEvents='stroke';
    path.style.cursor='pointer';
    path.onclick=()=>openEdit(t.id);
    svg.appendChild(path);
    appendDepArrow(svg,ax,ay,x2,y2,color,isCrit?12:11);

    if(depType!=='FS'){
      const tag=depType==='EE'?'FF':depType;
      const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
      bg.setAttribute('x',labelX-10); bg.setAttribute('y',labelY-7);
      bg.setAttribute('width',20); bg.setAttribute('height',14);
      bg.setAttribute('rx',3); bg.setAttribute('fill','#fff');
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
            '<span class="list-type">'+(TYPE_ICONS[t.type]||'☑')+'</span>'+
            '<span class="list-title'+(t.type<=2?' bold':'')+'">'+esc(t.name)+'</span>'+
            '<span class="list-badge" style="background:'+(LEVEL_COLORS[t.type]||'#64748b')+'22;color:'+(LEVEL_COLORS[t.type]||'#64748b')+';">'+(LEVELS[t.type]||'')+'</span>'+
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
  syncDepTypeUI();
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
        [['WBS','Auto-generated'],['Name*','Work item name'],['Type*','0=Program,1=Project,2=Phase,3=Workstream,4=Activity,5=Task,6=Milestone,7=Release'],
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
  showLoading('Exporting CSV…',btn);
  try{
    calcWBS();
    const wbsMap={};
    tasks.forEach(t=>wbsMap[t.id]=t.wbs);
    const header='WBS,Name,Type,Parent_WBS,Owner,Start,End,Duration,Progress,RAG,Predecessor_WBS,Dep_Type,Notes\n';
    const rows=tasks.map(t=>[t.wbs,'"'+t.name.replace(/"/g,'""')+'"',t.type,t.parent?wbsMap[t.parent]:'','"'+(t.owner||'')+'"',t.start,t.end,taskDuration(t),t.prog,t.rag,t.predId?wbsMap[t.predId]:'',t.depType||'FS','"'+(t.notes||'').replace(/"/g,'""')+'"'].join(',')).join('\n');
    downloadCSV('jiganto_gantt_export.csv',header+rows);
    showToast('✓ CSV downloaded','ok');
  }catch(e){
    console.error(e);
    showToast('CSV export failed','err',2800);
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
  // Hard remount so iframe reloads real DB ids after bulk import
  try{window.parent.postMessage({type:'gantt-version-activated',projectId,reason:'import'},'*');}catch(e){}
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
      if(!isUnsavedLocal(task)) persistSave(task);
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
    inp.onchange=()=>{if(Number(inp.value)!==Number(original)) pushHistory();task[field]=Number(inp.value);renderAll();if(!isUnsavedLocal(task)) persistSave(task);};
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
      if(!isUnsavedLocal(task)) persistSave(task);
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
  if(!t) return;
  if(getChildren(t.id).length){
    showToast('Folder rows can’t have predecessors — pick a Task or Activity','info',3200);
    return;
  }
  if(t.type===1||t.id===1){ showToast('Project row cannot have a predecessor','info',2800); return; }
  if(cell.classList.contains('editing')) return;
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
  const commit=()=>{
    const v=sel.value?parseInt(sel.value,10):null;
    const changed=v!==t.predId;
    if(changed){
      pushHistory();
      t.predId=v;
      if(v&&!t.depType) t.depType='FS';
      if(!v) t.depType='FS';
      if(autoSchedule) applyAutoSchedule();
      void persistSave(t);
      if(autoSchedule) void persistScheduleChanges(t);
    }
    cell.classList.remove('editing');
    renderAll();
    if(changed&&showCP){
      if(v&&criticalIds.size) showToast('Critical path updated ('+criticalIds.size+')','ok',2000);
      else if(v) showToast('Predecessor saved','ok',1800);
      else showToast('Predecessor cleared','info',1800);
    } else if(changed&&v){
      showToast('Predecessor saved · '+(t.depType==='EE'?'FF':(t.depType||'FS')),'ok',1800);
    } else if(changed&&!v){
      showToast('Predecessor cleared','info',1800);
    }
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
    void persistSave(t); if(autoSchedule) persistScheduleChanges(t);
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
  void persistSave(t);
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
  const types=document.getElementById('depDrawTypes');
  if(types){
    if(depDrawMode) types.removeAttribute('hidden');
    else types.setAttribute('hidden','');
  }
  syncDepTypeUI();
  const body=document.querySelector('.gantt-body');
  if(body) body.classList.toggle('dep-draw-mode',depDrawMode);
  if(!depDrawMode){
    document.querySelectorAll('.gantt-bar.dep-source').forEach(b=>b.classList.remove('dep-source'));
    showDepToast(null);
  } else {
    const label=currentDep==='EE'?'FF':(currentDep||'FS');
    showDepToast('Draw Dep ('+label+'): click source bar, then target');
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
    toast._hideT=setTimeout(()=>{toast.style.opacity='0';},4000);
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
    const label=currentDep==='EE'?'FF':(currentDep||'FS');
    showDepToast('Now click the target bar ('+label+')');
    return true;
  }
  if(taskId===depSourceId){showDepToast('Cannot link a task to itself');return true;}
  const targetTask=tasks.find(x=>x.id===taskId);
  if(targetTask){
    pushHistory();
    targetTask.predId=depSourceId;
    targetTask.depType=currentDep||'FS';
    if(autoSchedule) applyAutoSchedule();
    pushHistory();
    const label=targetTask.depType==='EE'?'FF':targetTask.depType;
    showDepToast('✓ '+label+' dependency created');
    if(!isUnsavedLocal(targetTask)){
      persistSave(targetTask);
      if(autoSchedule) void persistScheduleChanges(targetTask);
    }
  }
  depSourceId=null;
  document.querySelectorAll('.gantt-bar.dep-source').forEach(b=>b.classList.remove('dep-source'));
  depDrawMode=false;
  const btn=document.getElementById('depDrawBtn');
  if(btn) btn.classList.remove('on');
  const types=document.getElementById('depDrawTypes');
  if(types) types.setAttribute('hidden','');
  const body=document.querySelector('.gantt-body');
  if(body) body.classList.remove('dep-draw-mode');
  renderAll();
  return true;
}

// ══════════════════════════════════════════════════════════════
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
  try{ window.parent.postMessage({type:'gantt-saved',projectId},'*'); }catch(e){}
}

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

function isUnsavedLocal(t){
  return !t || t.id>=LOCAL_ID_BASE;
}
function isLocalOnly(t){
  if(!t) return true;
  return t.id>=LOCAL_ID_BASE || t.id===1;
}
function engineTypeToGanttFields(type){
  if(type===2) return {ganttType:'phase',isSummary:true};
  if(type===3) return {ganttType:'workstream',isSummary:true};
  if(type===4) return {ganttType:'activity',isSummary:true};
  if(type===6) return {ganttType:'milestone',isSummary:false};
  return {ganttType:'task',isSummary:false};
}
function ganttIdToDbTaskId(ganttId){
  if(ganttId==null||ganttId===''||Number.isNaN(Number(ganttId))) return null;
  const id=Number(ganttId);
  if(id===1||id>=LOCAL_ID_BASE) return null;
  return id;
}
function predecessorIdsForSave(predId){
  if(!predId) return [];
  const dbId=ganttIdToDbTaskId(predId);
  return dbId!=null ? [dbId] : null;
}
function persistablePredOptions(excludeId){
  return tasks.filter(x=>x.id!==excludeId&&x.type!==1&&x.id!==1&&getChildren(x.id).length===0&&!isLocalOnly(x));
}

async function persistCreate(t){
  const {projectId,tenantId}=ganttMeta();
  if(!projectId||!tenantId) return;
  showLoading('Saving new item…');
  const h=apiAuthHeaders(true);
  const post=async (url,body)=>{
    const res=await fetch(url,{method:'POST',credentials:'include',headers:h,body:JSON.stringify(body)});
    if(!res.ok) throw new Error((await res.text().catch(()=>''))||('HTTP '+res.status));
    return res.json();
  };
  const ownerMap=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.ownerIdMap)||{};
  const assigneeId=t.owner?ownerMap[t.owner]||null:null;
  const gt=engineTypeToGanttFields(t.type);
  try{
    const parentTaskId=(t.parent&&t.parent!==1)?ganttIdToDbTaskId(t.parent):null;
    const predIds=predecessorIdsForSave(t.predId)||[];
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
      assigneeId:assigneeId||null,
      order:tasks.filter(x=>x.type!==1).length,
    });
    if(created?.id){
      const oldId=t.id;
      t.id=created.id;
      // Remap children/preds that pointed at the temp local id — never rewrite this row onto itself
      tasks.filter(x=>x.id!==t.id&&(x.parent===oldId||x.predId===oldId)).forEach(c=>{
        if(c.parent===oldId) c.parent=t.id;
        if(c.predId===oldId) c.predId=t.id;
      });
      if(t.parent===oldId||t.parent===t.id) t.parent=null;
      if(selectedTaskId===oldId) selectedTaskId=t.id;
    }
    calcWBS();
    renderAll();
    showSaveIndicator();
    notifyGanttParent();
  } catch(e){
    console.error('Gantt create failed:',e);
    showToast('Save failed: '+(e&&e.message?String(e.message).slice(0,100):'error'),'err',4000);
  } finally {
    hideLoading();
  }
}

async function persistDelete(t){
  if(!t||t.type===1||t.id===1) return;
  if(isLocalOnly(t)) return;
  showLoading('Deleting…');
  const h=apiAuthHeaders();
  try{
    const res=await fetch('/api/pm/tasks/'+t.id,{method:'DELETE',credentials:'include',headers:h});
    if(!res.ok) throw new Error('HTTP '+res.status);
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
  if(!t||t.type===1||t.id===1){
    const projectId=(window.GANTT_INIT_DATA&&window.GANTT_INIT_DATA.projectId)||null;
    if(!projectId) return false;
    const h=apiAuthHeaders(true);
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
  const h=apiAuthHeaders(true);
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
  const gt=engineTypeToGanttFields(t.type);
  try{
    const parentTaskId=(t.parent&&t.parent!==1)?ganttIdToDbTaskId(t.parent):null;
    let predIds=predecessorIdsForSave(t.predId);
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
    const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions/active',{credentials:'include',headers:apiAuthHeaders(false)});
    if(!res.ok) return;
    const data=await res.json();
    activePlanVersion=data&&data.id?data:null;
    updatePlanChip();
  }catch(e){ /* ignore */ }
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

async function nextVersionDefaultName(){
  const {projectId}=ganttMeta();
  let n=1;
  try{
    const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions',{credentials:'include',headers:apiAuthHeaders(false)});
    if(res.ok){
      const list=await res.json();
      if(Array.isArray(list)&&list.length){
        n=Math.max(...list.map(v=>Number(v.versionNumber)||0))+1;
      }
    }
  }catch(e){}
  return n===1?'Baseline v1':('Version '+n);
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
      method:'PATCH',credentials:'include',headers:apiAuthHeaders(true),
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
      method:'POST',credentials:'include',headers:apiAuthHeaders(true),
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
  await refreshVersionsList();
  const el=document.getElementById('modalVersions');
  if(el) el.classList.add('open');
}

async function refreshVersionsList(){
  const {projectId}=ganttMeta();
  const el=document.getElementById('versionsList');
  if(!el||!projectId) return;
  el.innerHTML='<div class="versions-empty">Loading…</div>';
  try{
    const res=await fetch('/api/pm/projects/'+projectId+'/gantt/versions',{credentials:'include',headers:apiAuthHeaders(false)});
    const ct=(res.headers.get('content-type')||'');
    if(!ct.includes('application/json')){
      el.innerHTML='<div class="versions-empty">'+
        '<div class="versions-empty-title">Versions API unavailable</div>'+
        '<div>Refresh the page (or restart the app server) and try again.</div>'+
      '</div>';
      return;
    }
    const list=await res.json();
    if(!res.ok){
      el.innerHTML='<div class="versions-empty">'+(list&&list.message?esc(list.message):'Could not load versions')+'</div>';
      return;
    }
    if(!Array.isArray(list)){
      el.innerHTML='<div class="versions-empty">Could not load versions</div>';
      return;
    }
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
  }catch(e){
    console.error('refreshVersionsList',e);
    el.innerHTML='<div class="versions-empty">'+
      '<div class="versions-empty-title">Could not load versions</div>'+
      '<div>Check your connection and refresh the page.</div>'+
    '</div>';
  }
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
          method:'POST',credentials:'include',headers:apiAuthHeaders(true),body:'{}',
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
          method:'POST',credentials:'include',headers:apiAuthHeaders(true),
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
          method:'PATCH',credentials:'include',headers:apiAuthHeaders(true),
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
          method:'DELETE',credentials:'include',headers:apiAuthHeaders(false),
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
function loadFromInitData(){
  const d=window.GANTT_INIT_DATA;
  if(!d||!Array.isArray(d.tasks)){tasks=[];nextId=100000;return;}
  tasks=d.tasks.map(t=>normalizeTaskRags(Object.assign({},t)));
  nextId=d.nextId||100000;
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
updatePlanChip();
loadActivePlanVersion();
setTimeout(()=>jumpToToday(),200);
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();redo();}
  if(e.key==='Escape'){
    const confirmModal=document.getElementById('modalVersionConfirm');
    if(confirmModal&&confirmModal.classList.contains('open')){closeModal('modalVersionConfirm');return;}
    const nameModal=document.getElementById('modalVersionName');
    if(nameModal&&nameModal.classList.contains('open')){closeModal('modalVersionName');return;}
    const verModal=document.getElementById('modalVersions');
    if(verModal&&verModal.classList.contains('open')){closeModal('modalVersions');return;}
    closeVersionMenu();
  }
});

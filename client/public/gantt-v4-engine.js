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

// ── UTILS ────────────────────────────────────────────────────
const D=(s)=>{ const dt=new Date(s+'T00:00:00'); return dt; };
const fmt=(dt)=>dt.toISOString().split('T')[0];
const addDays=(dt,n)=>{ const r=new Date(dt); r.setDate(r.getDate()+n); return r; };
const daysBetween=(a,b)=>Math.round((b-a)/86400000);
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
  return tasks.filter(t=>{
    if(t.parent!==null&&collapsed[t.parent]) return false;
    if(fl!==''&&String(t.type)!==fl) return false;
    if(fo&&t.owner!==fo) return false;
    if(fr&&t.rag!==fr) return false;
    return true;
  });
}

// ── ZOOM ─────────────────────────────────────────────────────
function setZoom(z,el){
  zoom=z;
  colW={day:44,week:28,month:14,quarter:7}[z]||28;
  document.querySelectorAll('.zb').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  renderAll();
}

// ── VIEW ─────────────────────────────────────────────────────
function setView(v,el){
  mainView=v;
  document.querySelectorAll('.vb').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  renderAll();
}

// ── CRITICAL PATH TOGGLE ─────────────────────────────────────
function toggleCP(){
  showCP=!showCP;
  const btn=document.getElementById('cpBtn');
  if(btn) btn.classList.toggle('on',showCP);
  renderAll();
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════
function renderAll(){
  if(mainView==='list'){renderListView();return;}
  const ts=document.getElementById('taskScroll');
  const tw=document.getElementById('tlWrap');
  const prevScrollTop=ts?ts.scrollTop:0;
  calcWBS();
  computeCriticalPath();
  const {start,end}=getRange();
  const totalDays=daysBetween(start,end);
  const totalW=totalDays*colW;
  renderTaskPanel();
  renderTimeline(start,end,totalW);
  positionTodayLine(start);
  if(ts&&tw&&!scrollSyncing){
    scrollSyncing=true;
    ts.scrollTop=prevScrollTop;
    tw.scrollTop=prevScrollTop;
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
      '<div class="task-toggle" onclick="event.stopPropagation();toggleCollapse('+t.id+')">'+
        (hasKids?(isCollapsed?'▶':'▼'):'·')+
      '</div>'+
      '<span class="type-icon" title="'+(LEVELS[t.type]||'')+'">'+(TYPE_ICONS[t.type]||'☑')+'</span>'+
      '<div class="task-name ie-cell" id="tn-'+t.id+'" onclick="event.stopPropagation();" ondblclick="event.stopPropagation();editName('+t.id+')" onblur="saveName('+t.id+',this)" onkeydown="nameKey(event,'+t.id+',this)" title="Double-click to edit name">'+esc(t.name)+'</div>'+
    '</div>'+
    '<div class="task-owner-col ie-cell" onclick="event.stopPropagation();inlineEditOwner('+t.id+',this)" title="Click to change owner">'+
      '<div class="av" style="background:'+avC(t.owner)+';">'+avInits(t.owner)+'</div>'+
    '</div>'+
    '<div class="task-date-col ie-cell" onclick="event.stopPropagation();inlineEditDate('+t.id+',\'start\',this)" title="Click to edit start date">'+
      '<span style="font-size:9px;font-family:var(--mono);color:var(--g500);">'+fmtShort(D(t.start))+'</span>'+
    '</div>'+
    '<div class="task-date-col ie-cell" onclick="event.stopPropagation();inlineEditDate('+t.id+',\'end\',this)" title="Click to edit end date">'+
      '<span style="font-size:9px;font-family:var(--mono);color:var(--g500);">'+fmtShort(D(t.end))+'</span>'+
    '</div>'+
    '<div class="task-prog-col ie-cell ie-prog-cell" onclick="event.stopPropagation();inlineEditProg('+t.id+',this)" title="Click to update progress">'+
      '<div class="prog-track"><div class="prog-fill" style="width:'+t.prog+'%;background:'+progC+';"></div></div>'+
      '<div class="prog-pct">'+t.prog+'%</div>'+
    '</div>'+
    '<div class="task-rag-col" onclick="event.stopPropagation();cycleRag('+t.id+')" title="Click to cycle RAG" style="cursor:pointer;">'+
      '<div class="rag-dot" style="background:'+ragC+';"></div>'+
    '</div>'+
    customCells+
  '</div>';
}

function editName(id){
  const el=document.getElementById('tn-'+id);
  if(!el) return;
  el.contentEditable='true';
  el.focus();
  const r=document.createRange();
  r.selectNodeContents(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(r);
}
function saveName(id,el){
  el.contentEditable='false';
  const t=tasks.find(x=>x.id===id);
  if(t){ t.name=el.textContent.trim()||t.name; persistSave(t); }
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
function collapseAll(){tasks.forEach(t=>{if(tasks.some(c=>c.parent===t.id))collapsed[t.id]=true;});renderAll();}
function expandAll(){collapsed={};renderAll();}

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
  const saved=localStorage.getItem('gantt-task-col-width');
  if(saved) document.documentElement.style.setProperty('--task-col',saved+'px');
  const splitter=document.getElementById('panelSplitter');
  if(!splitter) return;
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
  const ts=document.getElementById('taskScroll');
  const tw=document.getElementById('tlWrap');
  if(!ts||!tw) return;
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
    requestAnimationFrame(()=>{scrollSyncing=false;});
  });
}

// ── TIMELINE ─────────────────────────────────────────────────
function renderTimeline(start,end,totalW){
  const header=document.getElementById('tlHeader');
  const rows=document.getElementById('tlRows');
  if(!header||!rows) return;
  const totalDays=daysBetween(start,end);
  const days=[];
  for(let i=0;i<totalDays;i++) days.push(addDays(start,i));

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

  const today=new Date();today.setHours(0,0,0,0);
  let dHTML='<div class="tl-days">';
  days.forEach(dt=>{
    const isWE=dt.getDay()===0||dt.getDay()===6;
    const isT=dt.getTime()===today.getTime();
    let lbl='';
    if(zoom==='day'||zoom==='week') lbl=String(dt.getDate());
    else if(zoom==='month'&&dt.getDate()%5===0) lbl=String(dt.getDate());
    else if(zoom==='quarter'&&dt.getDate()===1) lbl=dt.toLocaleDateString('en-GB',{month:'short'});
    dHTML+='<div class="tl-day-cell '+(isWE?'weekend':'')+' '+(isT?'today-col':'')+'" style="width:'+colW+'px;">'+lbl+'</div>';
  });
  dHTML+='</div>';
  header.innerHTML=mHTML+dHTML;

  const visible=getVisible();
  let rHTML='';
  rows.innerHTML='';
  visible.forEach(t=>{
    let cells='';
    days.forEach(dt=>{
      const isWE=dt.getDay()===0||dt.getDay()===6;
      const isT=dt.getTime()===today.getTime();
      cells+='<div class="tl-cell '+(isWE?'weekend':'')+' '+(isT?'today-col':'')+'" style="width:'+colW+'px;"></div>';
    });
    rHTML+='<div class="tl-grid-row" id="gr-'+t.id+'" data-level="'+t.type+'" style="width:'+totalW+'px;">'+cells+'</div>';
  });
  rows.innerHTML=rHTML;

  // clear barPos before re-registering
  Object.keys(barPos).forEach(k=>delete barPos[k]);

  visible.forEach(t=>{
    const row=document.getElementById('gr-'+t.id);
    if(!row) return;
    const rowTop=row.offsetTop;
    const isCrit=showCP&&criticalIds.has(t.id);
    const barColor=isCrit?'#dc2626':(LEVEL_COLORS[t.type]||'#4f46e5');

    if(t.type===6){
      const offsetDays=daysBetween(start,D(t.start));
      const left=offsetDays*colW;
      const el=document.createElement('div');
      el.className='milestone-diamond';
      el.style.cssText='left:'+(left-6)+'px;top:'+(rowTop+13)+'px;background:'+barColor+';width:12px;height:12px;';
      el.title=t.name+' · '+fmtDisp(D(t.start));
      el.onclick=()=>openEdit(t.id);
      rows.appendChild(el);
    } else {
      const s=D(t.start),e=D(t.end);
      const left=daysBetween(start,s)*colW;
      const width=Math.max((daysBetween(s,e)+1)*colW,colW);
      const barH={0:22,1:20,2:18,3:16,4:16,5:16}[t.type]||16;
      const barTop=rowTop+(38-barH)/2;
      const el=document.createElement('div');
      el.className='gantt-bar '+(isCrit?'critical':'');
      el.id='bar-'+t.id;
      el.style.cssText='left:'+left+'px;top:'+barTop+'px;width:'+width+'px;height:'+barH+'px;background:'+barColor+';';
      el.title=t.name+'\n'+fmtDisp(s)+' → '+fmtDisp(e)+'\n'+t.prog+'% · '+(LEVELS[t.type]||'');
      const pf=document.createElement('div');
      pf.className='bar-prog-fill';
      pf.style.cssText='width:'+t.prog+'%;background:rgba(255,255,255,0.5);';
      el.appendChild(pf);
      const lbl=document.createElement('div');
      lbl.className='bar-label';
      lbl.style.fontSize=(barH<=16)?'9px':'10px';
      lbl.textContent=t.name;
      el.appendChild(lbl);
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
      setupDrag(el,t,start,rl,rr);
      rows.appendChild(el);
    }
  });

  document.getElementById('tlInner').style.width=totalW+'px';
  const totalH=visible.length*38+60;
  document.getElementById('depSvg').setAttribute('width',totalW);
  document.getElementById('depSvg').setAttribute('height',totalH+'px');
  renderDeps(visible,start);
  document.getElementById('tlInner').style.minHeight=totalH+'px';
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
    const color=isCrit?'#dc2626':'#6366f1';
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
  let startX=0,origL=0,origW=0,mode=null;
  function down(e,m){
    e.preventDefault();
    mode=m;startX=e.clientX;
    origL=parseInt(el.style.left)||0;
    origW=parseInt(el.style.width)||colW;
    const move=e2=>{
      const dx=e2.clientX-startX;
      const snap=Math.round(dx/colW)*colW;
      if(mode==='move') el.style.left=(origL+snap)+'px';
      else if(mode==='r') el.style.width=Math.max(colW,origW+snap)+'px';
      else if(mode==='l'){el.style.width=Math.max(colW,origW-snap)+'px';el.style.left=(origL+snap)+'px';}
    };
    const up=()=>{
      document.removeEventListener('mousemove',move);
      document.removeEventListener('mouseup',up);
      const newL=parseInt(el.style.left)||0;
      const newW=parseInt(el.style.width)||colW;
      const dOffset=Math.round(newL/colW);
      const dur=Math.max(0,Math.round(newW/colW)-1);
      const ns=addDays(rangeStart,dOffset);
      const ne=addDays(ns,dur);
      task.start=fmt(ns);task.end=fmt(ne);
      renderAll();
      persistSave(task);
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
  const gb=document.getElementById('ganttBody');
  const rows=tasks.map(t=>'<tr style="border-bottom:1px solid var(--g100);" onmouseover="this.style.background=\'#f5f3ff\'" onmouseout="this.style.background=\'\'">'+
    '<td style="padding:7px 10px;font-family:var(--mono);font-size:10px;color:var(--g400);">'+esc(t.wbs)+'</td>'+
    '<td style="padding:7px 10px;"><div style="display:flex;align-items:center;gap:5px;padding-left:'+(getDepth(t)*12)+'px;">'+
      '<span style="font-size:11px;">'+(TYPE_ICONS[t.type]||'☑')+'</span>'+
      '<span style="font-size:12px;font-weight:'+(t.type<2?600:400)+';color:var(--g800);">'+esc(t.name)+'</span>'+
      '<span style="font-size:9px;background:'+(LEVEL_COLORS[t.type]||'#64748b')+'22;color:'+(LEVEL_COLORS[t.type]||'#64748b')+';padding:1px 5px;border-radius:20px;">'+(LEVELS[t.type]||'')+'</span>'+
    '</div></td>'+
    '<td style="padding:7px 10px;font-size:11px;color:var(--g600);">'+esc(t.owner)+'</td>'+
    '<td style="padding:7px 10px;font-family:var(--mono);font-size:10px;color:var(--g500);">'+fmtShort(D(t.start))+'</td>'+
    '<td style="padding:7px 10px;font-family:var(--mono);font-size:10px;color:var(--g500);">'+fmtShort(D(t.end))+'</td>'+
    '<td style="padding:7px 10px;"><div style="display:flex;align-items:center;gap:5px;">'+
      '<div style="width:40px;height:4px;background:var(--g200);border-radius:2px;overflow:hidden;"><div style="width:'+t.prog+'%;height:100%;background:'+(t.prog>=70?'#059669':t.prog>=40?'#d97706':'#dc2626')+';border-radius:2px;"></div></div>'+
      '<span style="font-size:10px;font-family:var(--mono);">'+t.prog+'%</span>'+
    '</div></td>'+
    '<td style="padding:7px 10px;text-align:center;"><div style="width:8px;height:8px;border-radius:50%;background:'+(RAG_COL[t.rag]||'#94a3b8')+';margin:auto;"></div></td>'+
    '<td style="padding:7px 10px;text-align:center;"><button onclick="openEdit('+t.id+')" style="background:none;border:none;cursor:pointer;color:var(--g400);font-size:12px;padding:3px 6px;border-radius:4px;" onmouseover="this.style.background=\'var(--g100)\'" onmouseout="this.style.background=\'none\'">✏</button></td>'+
  '</tr>').join('');
  gb.innerHTML='<div style="flex:1;overflow-y:auto;padding:14px 16px;">'+
    '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--g200);border-radius:10px;overflow:hidden;table-layout:fixed;">'+
      '<thead><tr style="background:var(--g50);">'+
        '<th style="padding:7px 10px;font-size:9px;font-weight:600;color:var(--g500);text-transform:uppercase;letter-spacing:.4px;text-align:left;border-bottom:1px solid var(--g200);width:52px;">WBS</th>'+
        '<th style="padding:7px 10px;font-size:9px;font-weight:600;color:var(--g500);text-transform:uppercase;letter-spacing:.4px;text-align:left;border-bottom:1px solid var(--g200);">Name</th>'+
        '<th style="padding:7px 10px;font-size:9px;font-weight:600;color:var(--g500);text-transform:uppercase;letter-spacing:.4px;text-align:left;border-bottom:1px solid var(--g200);width:100px;">Owner</th>'+
        '<th style="padding:7px 10px;font-size:9px;font-weight:600;color:var(--g500);text-transform:uppercase;letter-spacing:.4px;text-align:left;border-bottom:1px solid var(--g200);width:80px;">Start</th>'+
        '<th style="padding:7px 10px;font-size:9px;font-weight:600;color:var(--g500);text-transform:uppercase;letter-spacing:.4px;text-align:left;border-bottom:1px solid var(--g200);width:80px;">End</th>'+
        '<th style="padding:7px 10px;font-size:9px;font-weight:600;color:var(--g500);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--g200);width:80px;">Progress</th>'+
        '<th style="padding:7px 10px;font-size:9px;font-weight:600;color:var(--g500);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--g200);width:46px;">RAG</th>'+
        '<th style="border-bottom:1px solid var(--g200);width:38px;"></th>'+
      '</tr></thead>'+
      '<tbody>'+rows+'</tbody>'+
    '</table>'+
    '<button onclick="addItem(null)" style="margin-top:8px;display:flex;align-items:center;gap:5px;font-size:11px;color:var(--p);cursor:pointer;padding:6px 10px;border-radius:5px;border:1px dashed var(--p);background:transparent;font-family:var(--font);">＋ Add task</button>'+
  '</div>';
}

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
      t.name=name;t.start=start;t.end=(typeVal===6?start:end);
      t.type=typeVal;t.owner=document.getElementById('m-owner').value||'';
      t.prog=parseInt(document.getElementById('m-prog').value)||0;
      t.rag=currentRag;t.notes=document.getElementById('m-notes').value;
      t.parent=parentVal?parseInt(parentVal):null;
      t.predId=predVal?parseInt(predVal):null;
      t.depType=currentDep;
      closeModal('modalEdit');
      renderAll();
      persistSave(t);
    }
  } else {
    const newTask={
      id:nextId++,name,type:typeVal,
      owner:document.getElementById('m-owner').value||'',
      start,end:(typeVal===6?start:end),
      prog:parseInt(document.getElementById('m-prog').value)||0,
      rag:currentRag,
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
        '<button class="btn btn-excel" onclick="downloadTemplate()">↓ Empty template</button>'+
        '<button class="btn btn-green" onclick="downloadCurrentPlan()">↓ Export current plan</button>'+
      '</div></div>'+
      '<div class="ie-section" style="margin-bottom:0;"><div class="ie-section-title">📋 Column reference</div>'+
      '<table style="width:100%;font-size:11px;border-collapse:collapse;">'+
        [['WBS','Auto-generated'],['Name*','Work item name'],['Type*','0=Programme,1=Project,2=Phase,3=Workstream,4=Activity,5=Task,6=Milestone'],
         ['Parent_WBS','WBS of parent'],['Owner*','Owner name'],['Start*','YYYY-MM-DD'],['End*','YYYY-MM-DD'],
         ['Progress','0–100'],['RAG*','g, a, or r'],['Predecessor_WBS','WBS of dependency'],['Dep_Type','FS, SS, or EE'],['Notes','Free text']
        ].map(([col,desc])=>'<tr style="border-bottom:1px solid var(--g100);"><td style="padding:5px 8px;font-family:var(--mono);font-weight:600;color:var(--p);">'+col+'</td><td style="padding:5px 8px;color:var(--g500);">'+desc+'</td></tr>').join('')+
      '</table></div>';
  } else {
    body.innerHTML='<div class="ie-section">'+
      '<div class="ie-section-title">📤 Import from CSV</div>'+
      '<p style="font-size:12px;color:var(--g500);margin-bottom:10px;">Upload a CSV file using the Jiganto column format.</p>'+
      '<div style="display:flex;gap:8px;margin-bottom:10px;">'+
        '<button class="btn '+(importMode==='append'?'btn-p':'btn-ghost')+'" onclick="setImportMode(\'append\')">⊕ Append</button>'+
        '<button class="btn '+(importMode==='overwrite'?'btn-p':'btn-ghost')+'" onclick="setImportMode(\'overwrite\')">↺ Overwrite</button>'+
      '</div>'+
      (importMode==='overwrite'?'<div style="font-size:11px;color:var(--amber);background:var(--amber-l);border:1px solid #fcd34d;border-radius:5px;padding:6px 10px;margin-bottom:10px;">⚠ Overwrite will replace your entire project plan.</div>':'')+
      '<div class="drop-zone" id="dropZone" onclick="document.getElementById(\'fileInput\').click()">'+
        '<div style="font-size:22px;margin-bottom:6px;">📁</div>'+
        '<div class="drop-zone-text">Click or drag a <strong>.csv</strong> file here</div>'+
      '</div>'+
      '<input type="file" id="fileInput" accept=".csv,.txt" style="display:none;" onchange="handleFileSelect(this)">'+
      '<div id="importResult" style="margin-top:8px;font-size:12px;"></div>'+
    '</div>';
    setupDropZone();
  }
  document.getElementById('modalIE').classList.add('open');
}
function setImportMode(m){importMode=m;openImportExport('import');}
function downloadTemplate(){
  const header='WBS,Name,Type,Parent_WBS,Owner,Start,End,Progress,RAG,Predecessor_WBS,Dep_Type,Notes\n';
  const example=',"Example Phase",2,,Owner Name,2025-06-01,2025-06-30,0,g,,,\n';
  downloadCSV('jiganto_gantt_template.csv',header+example);
}
function downloadCurrentPlan(){
  calcWBS();
  const wbsMap={};
  tasks.forEach(t=>wbsMap[t.id]=t.wbs);
  const header='WBS,Name,Type,Parent_WBS,Owner,Start,End,Progress,RAG,Predecessor_WBS,Dep_Type,Notes\n';
  const rows=tasks.map(t=>[t.wbs,'"'+t.name.replace(/"/g,'""')+'"',t.type,t.parent?wbsMap[t.parent]:'','"'+(t.owner||'')+'"',t.start,t.end,t.prog,t.rag,t.predId?wbsMap[t.predId]:'',t.depType||'FS','"'+(t.notes||'').replace(/"/g,'""')+'"'].join(',')).join('\n');
  downloadCSV('jiganto_gantt_export.csv',header+rows);
}
function downloadCSV(filename,content){
  const blob=new Blob([content],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}
function setupDropZone(){
  const dz=document.getElementById('dropZone');
  if(!dz) return;
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag-over');const file=e.dataTransfer.files[0];if(file)parseCSV(file);});
}
function handleFileSelect(input){const file=input.files[0];if(file)parseCSV(file);}
async function persistBulkImport(rows,mode){
  const {projectId}=ganttMeta();
  if(!projectId||!rows.length) return false;
  try{
    const res=await fetch('/api/pm/projects/'+projectId+'/gantt/import',{
      method:'POST',credentials:'include',
      headers:{'Content-Type':'application/json'},
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
  const reader=new FileReader();
  reader.onload=async e=>{
    const text=e.target.result;
    const lines=text.split('\n').map(l=>l.trim()).filter(l=>l);
    if(lines.length<2){showImportResult('error','File appears empty.');return;}
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
    const {projectId}=ganttMeta();
    if(projectId){
      showImportResult('success','⏳ Saving '+rows.length+' items to database…');
      const ok=await persistBulkImport(rows,importMode);
      if(ok){
        showImportResult('success','✅ Imported '+rows.length+' items to project.'+(errors>0?' ('+errors+' rows skipped)':''));
        notifyGanttRefresh();
        return;
      }
      showImportResult('error','Database import failed — loaded locally only.');
    }
    const imported=rows.map((r,i)=>({
      id:nextId++,name:r.name,type:r.type,owner:r.owner||'',start:r.start,end:r.end,
      prog:r.progress,rag:r.rag,notes:r.notes,parent:null,predId:null,depType:r.depType,color:'#4f46e5',wbs:r.wbs,
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
    showImportResult('success','✅ Imported '+imported.length+' items locally.'+(errors>0?' ('+errors+' rows skipped)':''));
    renderAll();
  };
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
      task[field]=sel.value;
      td.classList.remove('editing');
      renderAll();
      if(task.id<5000) persistSave(task);
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
    inp.onchange=()=>{task[field]=Number(inp.value);renderAll();if(task.id<5000) persistSave(task);};
    inp.onblur=()=>{task[field]=Number(inp.value);td.classList.remove('editing');renderAll();if(task.id<5000) persistSave(task);};
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
      if(v) task[field]=v;
      td.classList.remove('editing');
      renderAll();
      if(task.id<5000) persistSave(task);
    };
    inp.onblur=commit;
    inp.onkeydown=(e)=>{
      if(e.key==='Enter'){e.preventDefault();commit();}
      if(e.key==='Escape'){td.classList.remove('editing');renderAll();}
    };
  }
}

function inlineEditOwner(id,cell){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  const ownerChoices=OWNERS.length?OWNERS.map(o=>[o,o]):[['','—']];
  makeEditable(cell,t,'owner',{type:'select',choices:ownerChoices});
}
function inlineEditDate(id,field,cell){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  makeEditable(cell,t,field,{type:'date'});
}
function inlineEditProg(id,cell){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  makeEditable(cell,t,'prog',{type:'range'});
}
function cycleRag(id){
  const t=tasks.find(x=>x.id===id);if(!t) return;
  const cycle={g:'a',a:'r',r:'g'};
  t.rag=cycle[t.rag]||'g';
  renderAll();
  if(t.id<5000) persistSave(t);
}

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
    toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--p);color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:500;z-index:200;transition:opacity .2s;box-shadow:0 4px 12px rgba(0,0,0,.2);pointer-events:none;';
    document.body.appendChild(toast);
  }
  if(msg){toast.textContent=msg;toast.style.opacity='1';}
  else{toast.style.opacity='0';}
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
      setTimeout(()=>showDepToast(null),2000);
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
const RAG_TO_STATUS={g:'green',a:'amber',r:'red'};
const ID_PFX={project:1,phase:1000,ws:2000,task:3000,ms:4000};

function ganttMeta(){
  const d=window.GANTT_INIT_DATA||{};
  return {projectId:d.projectId,tenantId:d.tenantId};
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
  const h={'Content-Type':'application/json'};
  const post=(url,body)=>fetch(url,{method:'POST',credentials:'include',headers:h,body:JSON.stringify(body)});
  const rag=RAG_TO_STATUS[t.rag]||'green';
  const phaseId=resolvePhaseId(t.parent);
  const parentTaskId=resolveParentTaskId(t.parent);
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
      const created=await post('/api/pm/tasks',{tenantId,projectId,phaseId,parentTaskId,name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,ragStatus:rag,isSummary:t.type===4,ganttType:t.type===4?'summary':'task',order:tasks.filter(x=>x.type===4||x.type===5).length}).then(r=>r.json());
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
  } catch(e){ console.error('Gantt create failed:',e); }
}

async function persistDelete(t){
  if(!t||t.id>=5000) return;
  const del=(url)=>fetch(url,{method:'DELETE',credentials:'include'});
  try{
    if(t.type===2&&t.id>ID_PFX.phase&&t.id<ID_PFX.ws) await del('/api/pm/phases/'+(t.id-ID_PFX.phase));
    else if(t.type===3&&t.id>ID_PFX.ws&&t.id<ID_PFX.task) await del('/api/pm/workstreams/'+(t.id-ID_PFX.ws));
    else if((t.type===4||t.type===5)&&t.id>ID_PFX.task&&t.id<ID_PFX.ms) await del('/api/pm/tasks/'+(t.id-ID_PFX.task));
    else if(t.type===6&&t.id>ID_PFX.ms&&t.id<5000) await del('/api/pm/milestones/'+(t.id-ID_PFX.ms));
  } catch(e){ console.error('Gantt delete failed:',e); }
}

async function persistSave(t){
  if(!t||t.id>=5000) return; // local-only items
  const h={'Content-Type':'application/json'};
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
    if(t.type===2&&t.id>1000&&t.id<2000){
      const id=t.id-1000;
      await put('/api/pm/phases/'+id,{name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,ragStatus:RAG_TO_STATUS[t.rag]||'green',description:t.notes||undefined,wbsCode:t.wbs||undefined});
    } else if(t.type===3&&t.id>2000&&t.id<3000){
      const id=t.id-2000;
      const parent=mapParent(t.parent);
      await put('/api/pm/workstreams/'+id,{name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,ragStatus:RAG_TO_STATUS[t.rag]||'green',description:t.notes||undefined,wbsCode:t.wbs||undefined,...(parent.phaseId?{phaseId:parent.phaseId}:{})});
    } else if((t.type===4||t.type===5)&&t.id>3000&&t.id<4000){
      const id=t.id-3000;
      const parent=mapParent(t.parent);
      const predIds=t.predId&&t.predId>=3000&&t.predId<4000?[t.predId-3000]:null;
      const assigneeId=t.owner?ownerMap[t.owner]||null:null;
      await put('/api/pm/tasks/'+id,{
        name:t.name,plannedStartDate:t.start,plannedEndDate:t.end,progress:t.prog,
        status:RAG_TO_STATUS[t.rag]||'todo',description:t.notes||undefined,
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
  } catch(e){ console.error('Gantt persist failed:',e); }
}

function showSaveIndicator(){
  let ind=document.getElementById('ganttSaveInd');
  if(!ind){
    ind=document.createElement('div');
    ind.id='ganttSaveInd';
    ind.style.cssText='position:fixed;top:8px;right:12px;background:#059669;color:#fff;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;z-index:300;transition:opacity .4s;pointer-events:none;';
    document.body.appendChild(ind);
  }
  ind.textContent='✓ Saved';
  ind.style.opacity='1';
  clearTimeout(ind._t);
  ind._t=setTimeout(()=>{ind.style.opacity='0';},1800);
}

// ══════════════════════════════════════════════════════════════
// DATA INIT — reads window.GANTT_INIT_DATA injected by React
// ══════════════════════════════════════════════════════════════
function loadFromInitData(){
  const d=window.GANTT_INIT_DATA;
  if(!d||!Array.isArray(d.tasks)){tasks=[];nextId=5000;return;}
  tasks=d.tasks.map(t=>Object.assign({},t));
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
}

// ── INIT ─────────────────────────────────────────────────────
loadFromInitData();
setupScrollSync();
setupPanelSplitter();
renderAll();
setTimeout(()=>jumpToToday(),200);

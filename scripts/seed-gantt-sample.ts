import { db } from "../server/db";
import { pmProjects, pmTasks } from "../shared/models/projects";
import { tenants } from "../shared/schema";
import { eq } from "drizzle-orm";

const MONTH_MAP: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

function parseDDMmmYYYY(s: string): string {
  const [dd, mmm, yyyy] = s.split('-');
  const m = MONTH_MAP[mmm];
  const d = new Date(Number(yyyy), m, Number(dd));
  return d.toISOString().slice(0, 10);
}

const STATUS_MAP: Record<string, string> = {
  'In Progress': 'in_progress',
  'Completed': 'done',
  'Not Started': 'todo',
  'On Hold': 'blocked',
  'At Risk': 'in_progress',
};

const SUMMARY_TYPES = new Set(['project', 'phase', 'workstream']);

const csvRows = [
  { wbs:'1',id:'1',parent:'',type:'project',name:'SAP S/4HANA Global Transformation',start:'01-Jan-2026',end:'30-Jun-2027',progress:3,status:'In Progress',priority:'high',ganttType:'project',resources:'Programme Director' },
  { wbs:'1.1',id:'2',parent:'1',type:'phase',name:'Discover & Prepare',start:'01-Jan-2026',end:'31-Mar-2026',progress:100,status:'Completed',priority:'high',ganttType:'phase',resources:'Programme Director; PMO Lead' },
  { wbs:'1.1.1',id:'3',parent:'2',type:'workstream',name:'Project Management',start:'01-Jan-2026',end:'31-Mar-2026',progress:100,status:'Completed',priority:'high',ganttType:'workstream',resources:'PMO Lead' },
  { wbs:'1.1.1.1',id:'4',parent:'3',type:'activity',name:'Governance & Control',start:'01-Jan-2026',end:'31-Mar-2026',progress:100,status:'Completed',priority:'high',ganttType:'activity',resources:'PMO Lead' },
  { wbs:'1.1.1.1.1',id:'5',parent:'4',type:'task',name:'Establish Steering Committee',start:'01-Jan-2026',end:'15-Jan-2026',progress:100,status:'Completed',priority:'high',ganttType:'task',resources:'Programme Director' },
  { wbs:'1.1.1.1.2',id:'6',parent:'4',type:'task',name:'Weekly Status Reporting',start:'15-Jan-2026',end:'31-Mar-2026',progress:75,status:'In Progress',priority:'high',ganttType:'task',resources:'PMO Lead' },
  { wbs:'1.1.1.2',id:'7',parent:'3',type:'activity',name:'Financial Control',start:'01-Jan-2026',end:'31-Mar-2026',progress:60,status:'In Progress',priority:'high',ganttType:'activity',resources:'PMO Lead; Finance Consultant' },
  { wbs:'1.1.1.2.1',id:'8',parent:'7',type:'task',name:'Budget Tracking',start:'01-Jan-2026',end:'31-Mar-2026',progress:60,status:'In Progress',priority:'high',ganttType:'task',resources:'Finance Consultant' },
  { wbs:'1.1.1.2.2',id:'9',parent:'7',type:'task',name:'Forecast Updates',start:'01-Feb-2026',end:'31-Mar-2026',progress:50,status:'In Progress',priority:'medium',ganttType:'task',resources:'Finance Consultant' },
  { wbs:'1.2',id:'10',parent:'1',type:'phase',name:'Explore (Design)',start:'01-Apr-2026',end:'31-Jul-2026',progress:60,status:'In Progress',priority:'high',ganttType:'phase',resources:'Functional Lead; Solution Architect' },
  { wbs:'1.2.1',id:'11',parent:'10',type:'workstream',name:'Architecture',start:'01-Apr-2026',end:'31-Jul-2026',progress:50,status:'In Progress',priority:'high',ganttType:'workstream',resources:'Solution Architect' },
  { wbs:'1.2.1.1',id:'12',parent:'11',type:'activity',name:'Solution Architecture Design',start:'01-Apr-2026',end:'30-Jun-2026',progress:80,status:'In Progress',priority:'high',ganttType:'activity',resources:'Solution Architect; Technical Lead' },
  { wbs:'1.2.1.1.1',id:'13',parent:'12',type:'task',name:'Define Target Architecture',start:'01-Apr-2026',end:'30-Apr-2026',progress:100,status:'Completed',priority:'high',ganttType:'task',resources:'Solution Architect' },
  { wbs:'1.2.1.1.2',id:'14',parent:'12',type:'task',name:'Integration Architecture Design',start:'01-May-2026',end:'31-May-2026',progress:80,status:'In Progress',priority:'high',ganttType:'task',resources:'Solution Architect; Integration Lead' },
  { wbs:'1.2.1.1.3',id:'15',parent:'12',type:'task',name:'Environment Strategy',start:'01-Jun-2026',end:'30-Jun-2026',progress:70,status:'In Progress',priority:'medium',ganttType:'task',resources:'Technical Lead' },
  { wbs:'1.2.1.2',id:'16',parent:'11',type:'activity',name:'Design Authority',start:'01-Apr-2026',end:'31-Jul-2026',progress:60,status:'In Progress',priority:'medium',ganttType:'activity',resources:'Solution Architect' },
  { wbs:'1.2.1.2.1',id:'17',parent:'16',type:'task',name:'Architecture Review Boards',start:'01-Apr-2026',end:'31-Jul-2026',progress:60,status:'In Progress',priority:'medium',ganttType:'task',resources:'Solution Architect' },
  { wbs:'1.2.2',id:'18',parent:'10',type:'workstream',name:'Functional',start:'01-Apr-2026',end:'31-Jul-2026',progress:50,status:'In Progress',priority:'high',ganttType:'workstream',resources:'Functional Lead' },
  { wbs:'1.2.2.1',id:'19',parent:'18',type:'activity',name:'Fit-to-Standard Workshops',start:'01-Apr-2026',end:'31-May-2026',progress:90,status:'In Progress',priority:'high',ganttType:'activity',resources:'Functional Lead' },
  { wbs:'1.2.2.1.1',id:'20',parent:'19',type:'task',name:'Finance Workshops',start:'01-Apr-2026',end:'20-Apr-2026',progress:100,status:'Completed',priority:'high',ganttType:'task',resources:'Finance Consultant; Functional Lead' },
  { wbs:'1.2.2.1.2',id:'21',parent:'19',type:'task',name:'Procurement Workshops',start:'15-Apr-2026',end:'10-May-2026',progress:100,status:'Completed',priority:'high',ganttType:'task',resources:'Procurement Consultant' },
  { wbs:'1.2.2.1.3',id:'22',parent:'19',type:'task',name:'Sales Workshops',start:'01-May-2026',end:'31-May-2026',progress:90,status:'In Progress',priority:'high',ganttType:'task',resources:'Sales Consultant' },
  { wbs:'1.2.2.2',id:'23',parent:'18',type:'activity',name:'System Configuration',start:'01-Aug-2026',end:'30-Nov-2026',progress:10,status:'In Progress',priority:'high',ganttType:'activity',resources:'Technical Lead; Functional Lead' },
  { wbs:'1.2.2.2.1',id:'24',parent:'23',type:'task',name:'Configure Finance',start:'01-Aug-2026',end:'31-Aug-2026',progress:0,status:'Not Started',priority:'high',ganttType:'task',resources:'Finance Consultant' },
  { wbs:'1.2.2.2.2',id:'25',parent:'23',type:'task',name:'Configure Procurement',start:'01-Sep-2026',end:'30-Sep-2026',progress:0,status:'Not Started',priority:'high',ganttType:'task',resources:'Procurement Consultant' },
  { wbs:'1.2.2.2.3',id:'26',parent:'23',type:'task',name:'Configure Sales',start:'01-Oct-2026',end:'31-Oct-2026',progress:0,status:'Not Started',priority:'high',ganttType:'task',resources:'Sales Consultant' },
  { wbs:'1.2.2.2.4',id:'27',parent:'23',type:'task',name:'RICEFW Development',start:'01-Aug-2026',end:'30-Nov-2026',progress:5,status:'In Progress',priority:'high',ganttType:'task',resources:'Technical Lead' },
  { wbs:'1.2.3',id:'28',parent:'10',type:'workstream',name:'Data Migration',start:'01-May-2026',end:'31-Mar-2027',progress:25,status:'In Progress',priority:'high',ganttType:'workstream',resources:'Data Lead' },
  { wbs:'1.2.3.1',id:'29',parent:'28',type:'activity',name:'Data Strategy',start:'01-May-2026',end:'30-Jun-2026',progress:100,status:'Completed',priority:'high',ganttType:'activity',resources:'Data Lead' },
  { wbs:'1.2.3.1.1',id:'30',parent:'29',type:'task',name:'Define Data Objects',start:'01-May-2026',end:'15-May-2026',progress:100,status:'Completed',priority:'high',ganttType:'task',resources:'Data Lead' },
  { wbs:'1.2.3.1.2',id:'31',parent:'29',type:'task',name:'Data Cleansing Plan',start:'15-May-2026',end:'30-Jun-2026',progress:100,status:'Completed',priority:'high',ganttType:'task',resources:'Data Lead' },
  { wbs:'1.2.3.2',id:'32',parent:'28',type:'activity',name:'Mock Migrations',start:'01-Oct-2026',end:'31-Jan-2027',progress:0,status:'Not Started',priority:'high',ganttType:'activity',resources:'Data Lead; Technical Lead' },
  { wbs:'1.2.3.2.1',id:'33',parent:'32',type:'task',name:'Mock 1',start:'01-Oct-2026',end:'31-Oct-2026',progress:0,status:'Not Started',priority:'high',ganttType:'task',resources:'Data Lead' },
  { wbs:'1.2.3.2.2',id:'34',parent:'32',type:'task',name:'Mock 2',start:'01-Dec-2026',end:'31-Dec-2026',progress:0,status:'Not Started',priority:'high',ganttType:'task',resources:'Data Lead' },
  { wbs:'1.2.3.2.3',id:'35',parent:'32',type:'task',name:'Mock 3',start:'01-Jan-2027',end:'31-Jan-2027',progress:0,status:'Not Started',priority:'high',ganttType:'task',resources:'Data Lead' },
  { wbs:'1.2.4',id:'36',parent:'10',type:'workstream',name:'Integration',start:'01-May-2026',end:'31-Dec-2026',progress:30,status:'In Progress',priority:'high',ganttType:'workstream',resources:'Integration Lead' },
  { wbs:'1.2.4.1',id:'37',parent:'36',type:'activity',name:'Interface Design',start:'01-May-2026',end:'30-Jun-2026',progress:100,status:'Completed',priority:'high',ganttType:'activity',resources:'Integration Lead' },
  { wbs:'1.2.4.1.1',id:'38',parent:'37',type:'task',name:'Identify Interfaces',start:'01-May-2026',end:'20-May-2026',progress:100,status:'Completed',priority:'high',ganttType:'task',resources:'Integration Lead' },
  { wbs:'1.2.4.1.2',id:'39',parent:'37',type:'task',name:'Define Interface Specs',start:'15-May-2026',end:'30-Jun-2026',progress:100,status:'Completed',priority:'high',ganttType:'task',resources:'Integration Lead; Solution Architect' },
  { wbs:'1.2.4.2',id:'40',parent:'36',type:'activity',name:'Interface Build & Test',start:'01-Aug-2026',end:'30-Nov-2026',progress:5,status:'In Progress',priority:'high',ganttType:'activity',resources:'Integration Lead; Technical Lead' },
  { wbs:'1.2.4.2.1',id:'41',parent:'40',type:'task',name:'Develop Interfaces',start:'01-Aug-2026',end:'31-Oct-2026',progress:10,status:'In Progress',priority:'high',ganttType:'task',resources:'Technical Lead' },
  { wbs:'1.2.4.2.2',id:'42',parent:'40',type:'task',name:'Interface SIT',start:'01-Nov-2026',end:'30-Nov-2026',progress:0,status:'Not Started',priority:'high',ganttType:'task',resources:'Testing Manager' },
  { wbs:'1.3',id:'43',parent:'1',type:'phase',name:'Build & Configure',start:'01-Aug-2026',end:'31-Jan-2027',progress:15,status:'In Progress',priority:'high',ganttType:'phase',resources:'Technical Lead; Change Manager' },
];

async function seed() {
  let [tenant] = await db.select().from(tenants).limit(1);
  if (!tenant) {
    [tenant] = await db.insert(tenants).values({ name: 'Default Tenant' }).returning();
  }
  console.log('Using tenant:', tenant.id, tenant.name);

  let [project] = await db.select().from(pmProjects)
    .where(eq(pmProjects.name, 'SAP S/4HANA Global Transformation'))
    .limit(1);

  if (!project) {
    [project] = await db.insert(pmProjects).values({
      tenantId: tenant.id,
      name: 'SAP S/4HANA Global Transformation',
      description: 'SAP S/4HANA enterprise transformation programme — sample Gantt plan with resources',
      status: 'active',
      priority: 'high',
      methodology: 'waterfall',
    }).returning();
    console.log('Created project:', project.id, project.name);
  } else {
    console.log('Found existing project:', project.id, project.name);
  }

  await db.delete(pmTasks).where(eq(pmTasks.projectId, project.id));
  console.log('Cleared existing tasks');

  const idMap = new Map<string, number>();

  for (const row of csvRows) {
    const parentDbId = row.parent ? (idMap.get(row.parent) ?? null) : null;

    const [created] = await db.insert(pmTasks).values({
      tenantId: tenant.id,
      projectId: project.id,
      name: row.name,
      plannedStartDate: parseDDMmmYYYY(row.start),
      plannedEndDate: parseDDMmmYYYY(row.end),
      progress: row.progress,
      status: STATUS_MAP[row.status] || 'todo',
      priority: row.priority,
      ganttType: row.ganttType,
      isSummary: SUMMARY_TYPES.has(row.type),
      parentTaskId: parentDbId,
      wbsCode: row.wbs,
      description: row.resources ? `resources:${row.resources}` : null,
    }).returning();

    idMap.set(row.id, created.id);
    console.log(`  ${row.wbs} ${row.name} → DB id ${created.id}${parentDbId ? ` (parent: ${parentDbId})` : ''} [${row.resources}]`);
  }

  console.log(`\nDone! Inserted ${csvRows.length} tasks with hierarchy and resource names preserved.`);
  console.log(`Resource names stored in description field as 'resources:Name1; Name2' for Gantt adapter to parse.`);
  console.log(`Project ID: ${project.id}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

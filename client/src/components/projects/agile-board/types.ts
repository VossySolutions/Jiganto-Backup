export interface Workstream {
  id: string;
  name: string;
  color: string;
}

export interface Epic {
  id: string;
  wsId: string;
  title: string;
  initiative: string;
  status: string;
  tshirt: string;
  priority: string;
  progress: number;
  owner: string;
  creator: string;
  createdAt: string;
  color: string;
  stories: number;
  storiesDone: number;
  tags: string[];
  description: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface Story {
  id: string;
  epicId: string;
  wsId: string;
  title: string;
  status: string;
  points: number | null;
  tshirt: string;
  priority: string;
  assignee: string | null;
  creator: string;
  createdAt: string;
  sprint: string | null;
  tags: string[];
  tasks: number;
  tasksDone: number;
  ac: string[];
}

export interface Defect {
  id: string;
  storyId: string;
  wsId: string;
  title: string;
  severity: string;
  priority: string;
  status: string;
  assignee: string | null;
  creator: string;
  createdAt: string;
  environment: string;
  sprint: string | null;
}

export interface Sprint {
  id: string;
  wsId: string;
  name: string;
  status: string;
  start: string;
  end: string;
  points: number;
  done: number;
  goal?: string;
}

export interface BurndownPoint {
  day: string;
  ideal: number;
  actual: number | null;
}

export interface BurnUpPoint {
  week: string;
  completed: number;
  total: number;
}

declare module 'wx-react-gantt' {
  import { ComponentType } from 'react';

  interface GanttTask {
    id: number;
    text: string;
    start: Date;
    end: Date;
    duration?: number;
    progress?: number;
    parent?: number;
    type?: 'task' | 'summary' | 'milestone';
    open?: boolean;
    lazy?: boolean;
    [key: string]: unknown;
  }

  interface GanttLink {
    id: number;
    source: number;
    target: number;
    type: 'e2s' | 's2s' | 'e2e' | 's2e';
  }

  interface GanttScale {
    unit: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    step: number;
    format: string;
  }

  interface GanttColumn {
    id: string;
    header: string;
    width?: number;
    flexgrow?: number;
    align?: 'left' | 'center' | 'right';
  }

  interface GanttProps {
    tasks?: GanttTask[];
    links?: GanttLink[];
    scales?: GanttScale[];
    columns?: GanttColumn[];
    cellWidth?: number;
    cellHeight?: number;
    scaleHeight?: number;
    readonly?: boolean;
    start?: Date;
    end?: Date;
  }

  export const Gantt: ComponentType<GanttProps>;
}

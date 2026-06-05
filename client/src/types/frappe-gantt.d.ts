declare module "frappe-gantt" {
  interface GanttTask {
    id: string;
    name: string;
    start: string | Date;
    end: string | Date;
    progress?: number;
    dependencies?: string;
    custom_class?: string;
    [key: string]: any;
  }

  interface GanttOptions {
    view_mode?: "Quarter Day" | "Half Day" | "Day" | "Week" | "Month" | "Year";
    date_format?: string;
    popup_trigger?: "click" | "hover";
    readonly?: boolean;
    readonly_dates?: boolean;
    readonly_progress?: boolean;
    bar_height?: number;
    bar_corner_radius?: number;
    arrow_curve?: number;
    padding?: number;
    language?: string;
    on_click?: (task: GanttTask) => void;
    on_date_change?: (task: GanttTask, start: Date, end: Date) => void;
    on_progress_change?: (task: GanttTask, progress: number) => void;
    on_view_change?: (mode: string) => void;
    custom_popup_html?: (task: GanttTask) => string;
  }

  class Gantt {
    constructor(
      wrapper: string | SVGElement | HTMLElement,
      tasks: GanttTask[],
      options?: GanttOptions
    );
    change_view_mode(mode: string): void;
    refresh(tasks: GanttTask[]): void;
  }

  export default Gantt;
}

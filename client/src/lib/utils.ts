import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function isEditableElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return true;
  }
  if (el.isContentEditable) return true;
  if (el.closest("[contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']")) {
    return true;
  }
  if (el.closest(".ProseMirror, .tiptap, [data-editable-region]")) return true;
  if (el.closest('[role="textbox"]')) return true;
  return false;
}

/** True when focus is in a field where typing should not trigger app shortcuts. */
export function isTypingInEditableField(target: EventTarget | null): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const fromEvent = target instanceof HTMLElement ? target : null;
  if (fromEvent && isEditableElement(fromEvent)) return true;
  if (active && isEditableElement(active)) return true;
  return false;
}

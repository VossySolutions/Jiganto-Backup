import { useRef, useState } from "react";
import { AtSign, BarChart2, Bold, Italic, Link, List, ListOrdered, Paperclip, Quote, Send, Smile, Strikethrough, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_ACCENT, QUICK_EMOJIS } from "@/lib/chat-utils";
import { fetchWithAuth } from "@/lib/queryClient";
import { ChatButtonSpinner } from "@/components/chat/ChatLoading";
import type { ChatInboxItem } from "@shared/models/chat";

type MentionUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type PendingAttachment = {
  id: number;
  fileName: string;
};

export function MessageCompose({
  channel,
  channelId,
  value,
  mentionUsers,
  disabled,
  sending,
  maxAttachments = 5,
  onChange,
  onSend,
  onTyping,
  onOpenPoll,
}: {
  channel: ChatInboxItem | undefined;
  channelId?: number;
  value: string;
  mentionUsers: MentionUser[];
  disabled?: boolean;
  sending?: boolean;
  maxAttachments?: number;
  onChange: (v: string) => void;
  onSend: (attachmentIds: number[]) => void;
  onTyping: () => void;
  onOpenPoll: () => void;
}) {
  const [showFormat, setShowFormat] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readOnly =
    channel?.type === "announcement" && channel.canPost === false;

  const placeholder = readOnly
    ? "Only admins can post in this announcement channel"
    : channel
      ? channel.type === "direct"
        ? `Message ${channel.displayName}`
        : `Message ${channel.displayName.startsWith("#") ? channel.displayName : `#${channel.displayName}`}`
      : "Select a conversation";

  const wrapSelection = (before: string, after: string = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "text";
    onChange(value.slice(0, start) + before + selected + after + value.slice(end));
  };

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + text);
      return;
    }
    const start = el.selectionStart;
    onChange(value.slice(0, start) + text + value.slice(el.selectionEnd));
    setShowEmoji(false);
    setMentionQuery(null);
  };

  const handleChange = (next: string) => {
    onChange(next);
    onTyping();
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const atMatch = next.slice(0, cursor).match(/@([\w\s.]*)$/);
    setMentionQuery(atMatch ? atMatch[1].toLowerCase() : null);
  };

  const filteredMentions =
    mentionQuery === null
      ? []
      : mentionUsers
          .filter((u) => {
            const name = [u.firstName, u.lastName, u.email].filter(Boolean).join(" ").toLowerCase();
            return name.includes(mentionQuery);
          })
          .slice(0, 6);

  const pickMention = (user: MentionUser) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "user";
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    onChange(before.replace(/@([\w\s.]*)$/, `@${name.replace(/\s+/g, "_")} `) + after);
    setMentionQuery(null);
  };

  function makeFileList(files: File[]): FileList {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    return dt.files;
  }

  const handleFilePick = async (files: FileList | null) => {
    if (!files?.length || !channelId) return;
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(files)
        .slice(0, maxAttachments - pendingAttachments.length)
        .forEach((f) => form.append("files", f));
      const res = await fetchWithAuth(`/api/chat/channels/${channelId}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const uploaded = (await res.json()) as PendingAttachment[];
      setPendingAttachments((prev) => [...prev, ...uploaded].slice(0, maxAttachments));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canSend = !readOnly && (value.trim() || pendingAttachments.length > 0);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((i) => i.type.startsWith("image/"));
    if (imageItems.length === 0 || !channelId) return;
    e.preventDefault();
    const files = imageItems
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length) void handleFilePick(makeFileList(files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly || !channelId) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) void handleFilePick(makeFileList(files));
  };

  return (
    <div
      className="border-t p-2 sm:p-4 bg-card/80 backdrop-blur-sm shrink-0"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="max-w-3xl mx-auto relative">
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAttachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-lg"
              >
                {a.fileName}
                <button
                  type="button"
                  className="hover:text-destructive"
                  onClick={() => setPendingAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border bg-popover shadow-lg overflow-hidden z-10">
            {filteredMentions.map((u) => (
              <button
                key={u.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                onClick={() => pickMention(u)}
              >
                {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
              </button>
            ))}
          </div>
        )}
        {showEmoji && (
          <div className="absolute bottom-full left-0 mb-2 rounded-xl border bg-popover shadow-lg p-2 flex gap-1 z-10">
            {QUICK_EMOJIS.map((e) => (
              <button key={e} type="button" className="text-lg p-1" onClick={() => insertAtCursor(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
        {showFormat && (
          <div className="flex flex-wrap gap-1 mb-2 p-2 rounded-lg border bg-muted/30 overflow-x-auto">
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Bold" onClick={() => wrapSelection("**")}>
              <Bold className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Italic" onClick={() => wrapSelection("_")}>
              <Italic className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Strikethrough" onClick={() => wrapSelection("~~")}>
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Code" onClick={() => wrapSelection("`")}>
              <Type className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Quote" onClick={() => wrapSelection("> ", "")}>
              <Quote className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Bullet list" onClick={() => insertAtCursor("\n- ")}>
              <List className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Numbered list" onClick={() => insertAtCursor("\n1. ")}>
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Link" onClick={() => wrapSelection("[", "](url)")}>
              <Link className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="flex-1 relative bg-background rounded-2xl border shadow-sm overflow-hidden min-w-0">
            <Textarea
              ref={textareaRef}
              placeholder={placeholder}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) {
                    onSend(pendingAttachments.map((a) => a.id));
                    setPendingAttachments([]);
                    setShowEmoji(false);
                  }
                }
              }}
              onPaste={handlePaste}
              className="min-h-[44px] sm:min-h-[52px] max-h-32 sm:max-h-40 resize-none pr-3 sm:pr-48 border-0 focus-visible:ring-0 text-sm"
              rows={1}
              disabled={disabled || readOnly}
              data-testid="input-message"
            />
            <div className="hidden sm:flex absolute right-2 bottom-2 items-center gap-0.5">
              <Button type="button" size="sm" variant="ghost" className="px-2 h-8" onClick={() => setShowFormat((v) => !v)}>
                <span className="text-xs font-semibold">Aa</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleFilePick(e.target.files)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="px-2 h-8"
                disabled={readOnly || uploading || pendingAttachments.length >= maxAttachments}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? <ChatButtonSpinner className="h-3.5 w-3.5" /> : <Paperclip className="h-4 w-4" />}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="px-2 h-8" onClick={() => setShowEmoji((v) => !v)}>
                <Smile className="h-4 w-4" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="px-2 h-8" onClick={() => insertAtCursor("@")}>
                <AtSign className="h-4 w-4" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="px-2 h-8" onClick={onOpenPoll} disabled={readOnly}>
                <BarChart2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button
            onClick={() => {
              if (canSend) {
                onSend(pendingAttachments.map((a) => a.id));
                setPendingAttachments([]);
                setShowEmoji(false);
                setShowFormat(false);
              }
            }}
            disabled={disabled || readOnly || !canSend || sending}
            size="icon"
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0 text-white"
            style={{ backgroundColor: CHAT_ACCENT }}
            data-testid="button-send-message"
          >
            {sending ? <ChatButtonSpinner className="text-white" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex sm:hidden items-center gap-0.5 mt-2 overflow-x-auto pb-0.5">
          <Button type="button" size="sm" variant="ghost" className="px-2 h-8 shrink-0" onClick={() => setShowFormat((v) => !v)}>
            <span className="text-xs font-semibold">Aa</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2 h-8 shrink-0"
            disabled={readOnly || uploading || pendingAttachments.length >= maxAttachments}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <ChatButtonSpinner className="h-3.5 w-3.5" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="px-2 h-8 shrink-0" onClick={() => setShowEmoji((v) => !v)}>
            <Smile className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="px-2 h-8 shrink-0" onClick={() => insertAtCursor("@")}>
            <AtSign className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="px-2 h-8 shrink-0" onClick={onOpenPoll} disabled={readOnly}>
            <BarChart2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

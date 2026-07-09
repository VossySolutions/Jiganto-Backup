import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  CheckSquare,
  Table,
  Image,
  Video,
  FileUp,
  Link2,
  Quote,
  Undo2,
  Redo2,
  ChevronDown,
  Type,
  Highlighter,
  Subscript,
  Superscript,
  RemoveFormatting,
  Minus,
  FileDown,
  FileText,
  FileCode,
  FilePlus2
} from "lucide-react";

interface DocumentEditorToolbarProps {
  content: string;
  onContentChange: (content: string) => void;
  onExport?: (format: "pdf" | "html" | "markdown") => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export function DocumentEditorToolbar({ 
  content, 
  onContentChange, 
  onExport,
  textareaRef 
}: DocumentEditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const getSelection = () => {
    if (!textareaRef?.current) return { start: 0, end: 0, text: "" };
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = content.substring(start, end);
    return { start, end, text };
  };

  const insertText = (before: string, after: string = "", placeholder: string = "") => {
    if (!textareaRef?.current) return;
    const { start, end, text } = getSelection();
    const selectedText = text || placeholder;
    const newContent = 
      content.substring(0, start) + 
      before + selectedText + after + 
      content.substring(end);
    onContentChange(newContent);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = start + before.length + selectedText.length + after.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    if (!textareaRef?.current) return;
    const { start } = getSelection();
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const newContent = 
      content.substring(0, lineStart) + 
      prefix + 
      content.substring(lineStart);
    onContentChange(newContent);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    }, 0);
  };

  const wrapSelection = (wrapper: string) => {
    const { text } = getSelection();
    insertText(wrapper, wrapper, text || "text");
  };

  const insertHeading = (level: number) => {
    const prefix = "#".repeat(level) + " ";
    insertAtLineStart(prefix);
  };

  const insertLink = () => {
    if (linkUrl) {
      const text = linkText || linkUrl;
      insertText(`[${text}](${linkUrl})`, "", "");
      setLinkUrl("");
      setLinkText("");
    }
  };

  const insertImage = () => {
    if (imageUrl) {
      const alt = imageAlt || "image";
      insertText(`![${alt}](${imageUrl})`, "", "");
      setImageUrl("");
      setImageAlt("");
    }
  };

  const insertVideo = () => {
    if (videoUrl) {
      insertText(`\n[Video: ${videoUrl}]\n`, "", "");
      setVideoUrl("");
    }
  };

  const insertTable = () => {
    let table = "\n";
    const header = "|" + " Header |".repeat(tableCols);
    const separator = "|" + " --- |".repeat(tableCols);
    const row = "|" + " Cell |".repeat(tableCols);
    
    table += header + "\n" + separator + "\n";
    for (let i = 0; i < tableRows - 1; i++) {
      table += row + "\n";
    }
    insertText(table, "", "");
  };

  const insertCodeBlock = (language: string = "") => {
    insertText(`\n\`\`\`${language}\n`, "\n```\n", "// your code here");
  };

  const insertList = (type: "bullet" | "numbered" | "checklist") => {
    const { text } = getSelection();
    const lines = text ? text.split("\n") : ["Item 1", "Item 2", "Item 3"];
    let formatted = "\n";
    lines.forEach((line, i) => {
      if (type === "bullet") formatted += `- ${line}\n`;
      else if (type === "numbered") formatted += `${i + 1}. ${line}\n`;
      else formatted += `- [ ] ${line}\n`;
    });
    insertText(formatted, "", "");
  };

  const ToolbarButton = ({ 
    icon: Icon, 
    label, 
    onClick, 
    shortcut 
  }: { 
    icon: React.ElementType; 
    label: string; 
    onClick: () => void; 
    shortcut?: string;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
          data-testid={`toolbar-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}{shortcut && <span className="ml-2 text-muted-foreground">{shortcut}</span>}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30 rounded-t-lg" data-testid="document-editor-toolbar">
      {/* Undo/Redo */}
      <ToolbarButton icon={Undo2} label="Undo" onClick={() => document.execCommand('undo')} shortcut="Ctrl+Z" />
      <ToolbarButton icon={Redo2} label="Redo" onClick={() => document.execCommand('redo')} shortcut="Ctrl+Y" />
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Text Formatting */}
      <ToolbarButton icon={Bold} label="Bold" onClick={() => wrapSelection("**")} shortcut="Ctrl+B" />
      <ToolbarButton icon={Italic} label="Italic" onClick={() => wrapSelection("*")} shortcut="Ctrl+I" />
      <ToolbarButton icon={Underline} label="Underline" onClick={() => wrapSelection("__")} shortcut="Ctrl+U" />
      <ToolbarButton icon={Strikethrough} label="Strikethrough" onClick={() => wrapSelection("~~")} />
      <ToolbarButton icon={Code} label="Inline Code" onClick={() => wrapSelection("`")} />
      <ToolbarButton icon={Highlighter} label="Highlight" onClick={() => wrapSelection("==")} />
      <ToolbarButton icon={Subscript} label="Subscript" onClick={() => insertText("<sub>", "</sub>", "text")} />
      <ToolbarButton icon={Superscript} label="Superscript" onClick={() => insertText("<sup>", "</sup>", "text")} />
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Headings Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" data-testid="toolbar-headings">
            <Type className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => insertHeading(1)} data-testid="toolbar-h1">
            <Heading1 className="h-4 w-4 mr-2" /> Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertHeading(2)} data-testid="toolbar-h2">
            <Heading2 className="h-4 w-4 mr-2" /> Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertHeading(3)} data-testid="toolbar-h3">
            <Heading3 className="h-4 w-4 mr-2" /> Heading 3
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertHeading(4)} data-testid="toolbar-h4">
            <Heading4 className="h-4 w-4 mr-2" /> Heading 4
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertHeading(5)} data-testid="toolbar-h5">
            <Heading5 className="h-4 w-4 mr-2" /> Heading 5
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertHeading(6)} data-testid="toolbar-h6">
            <Heading6 className="h-4 w-4 mr-2" /> Heading 6
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Lists */}
      <ToolbarButton icon={List} label="Bullet List" onClick={() => insertList("bullet")} />
      <ToolbarButton icon={ListOrdered} label="Numbered List" onClick={() => insertList("numbered")} />
      <ToolbarButton icon={CheckSquare} label="Checklist" onClick={() => insertList("checklist")} />
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Table */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="toolbar-table">
            <Table className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Insert Table</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Rows</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                  className="h-8"
                  data-testid="input-table-rows"
                />
              </div>
              <div>
                <Label className="text-xs">Columns</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={tableCols}
                  onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                  className="h-8"
                  data-testid="input-table-cols"
                />
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={insertTable} data-testid="button-insert-table">
              Insert Table
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Media */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="toolbar-image">
            <Image className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Insert Image</h4>
            <div className="space-y-2">
              <Label className="text-xs">Image URL</Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="h-8"
                data-testid="input-image-url"
              />
              <Label className="text-xs">Alt Text</Label>
              <Input
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Image description"
                className="h-8"
                data-testid="input-image-alt"
              />
            </div>
            <Button size="sm" className="w-full" onClick={insertImage} data-testid="button-insert-image">
              Insert Image
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="toolbar-video">
            <Video className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Embed Video</h4>
            <div className="space-y-2">
              <Label className="text-xs">Video URL (YouTube, Vimeo, etc.)</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="h-8"
                data-testid="input-video-url"
              />
            </div>
            <Button size="sm" className="w-full" onClick={insertVideo} data-testid="button-insert-video">
              Embed Video
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      <ToolbarButton icon={FileUp} label="Attach File" onClick={() => insertText("\n[📎 Attachment: ", "]\n", "filename.pdf")} />
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Link */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="toolbar-link">
            <Link2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Insert Link</h4>
            <div className="space-y-2">
              <Label className="text-xs">Link Text</Label>
              <Input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Click here"
                className="h-8"
                data-testid="input-link-text"
              />
              <Label className="text-xs">URL</Label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="h-8"
                data-testid="input-link-url"
              />
            </div>
            <Button size="sm" className="w-full" onClick={insertLink} data-testid="button-insert-link">
              Insert Link
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      <ToolbarButton icon={Quote} label="Blockquote" onClick={() => insertAtLineStart("> ")} />
      <ToolbarButton icon={Minus} label="Horizontal Rule" onClick={() => insertText("\n---\n", "", "")} />
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Code Block */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" data-testid="toolbar-code-block">
            <FileCode className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => insertCodeBlock("")} data-testid="toolbar-code-plain">
            Plain Code Block
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => insertCodeBlock("javascript")} data-testid="toolbar-code-js">
            JavaScript
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertCodeBlock("typescript")} data-testid="toolbar-code-ts">
            TypeScript
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertCodeBlock("python")} data-testid="toolbar-code-py">
            Python
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertCodeBlock("sql")} data-testid="toolbar-code-sql">
            SQL
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertCodeBlock("html")} data-testid="toolbar-code-html">
            HTML
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertCodeBlock("css")} data-testid="toolbar-code-css">
            CSS
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertCodeBlock("json")} data-testid="toolbar-code-json">
            JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => insertCodeBlock("bash")} data-testid="toolbar-code-bash">
            Bash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Clear Formatting */}
      <ToolbarButton 
        icon={RemoveFormatting} 
        label="Clear Formatting" 
        onClick={() => {
          const { text } = getSelection();
          if (text) {
            const cleaned = text
              .replace(/\*\*/g, "")
              .replace(/\*/g, "")
              .replace(/__/g, "")
              .replace(/~~/g, "")
              .replace(/==/g, "")
              .replace(/`/g, "")
              .replace(/<sub>|<\/sub>/g, "")
              .replace(/<sup>|<\/sup>/g, "");
            insertText("", "", cleaned);
          }
        }} 
      />
      
      {/* Export Options */}
      {onExport && (
        <>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" data-testid="toolbar-export">
                <FileDown className="h-4 w-4" />
                <span className="text-xs">Export</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onExport("pdf")} data-testid="toolbar-export-pdf">
                <FileText className="h-4 w-4 mr-2" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("html")} data-testid="toolbar-export-html">
                <FileCode className="h-4 w-4 mr-2" /> Export as HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("markdown")} data-testid="toolbar-export-md">
                <FilePlus2 className="h-4 w-4 mr-2" /> Export as Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

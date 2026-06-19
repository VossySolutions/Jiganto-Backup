import { useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadDocumentImage } from "@/lib/document-image-upload";
import { Button } from "@/components/ui/button";

export function DocumentImageNodeView({ node, selected, deleteNode, editor, updateAttributes }: NodeViewProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = await uploadDocumentImage(file);
    if (url) updateAttributes({ src: url, alt: file.name });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "document-image-node group relative my-3 flex justify-center",
        selected && "ring-2 ring-primary/60 ring-offset-2 rounded-lg",
      )}
      data-testid="document-image-node"
    >
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || "Image"}
        className="max-w-full h-auto rounded-lg cursor-pointer"
        draggable={false}
      />
      {editor.isEditable && (
        <>
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 gap-1 shadow-md"
              onClick={() => fileRef.current?.click()}
              data-testid="image-node-replace"
            >
              <Upload className="h-3.5 w-3.5" />
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 gap-1 shadow-md"
              onClick={deleteNode}
              data-testid="image-node-delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleReplace}
          />
        </>
      )}
    </NodeViewWrapper>
  );
}

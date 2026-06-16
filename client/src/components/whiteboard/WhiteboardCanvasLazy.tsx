import { forwardRef, lazy, Suspense, useEffect, useState } from "react";
import type { WhiteboardCanvasHandle } from "./WhiteboardCanvas";
import type { WhiteboardDetail } from "@shared/models/whiteboard";
import { WhiteboardLoadingState } from "./WhiteboardLoadingState";

const WhiteboardCanvasInner = lazy(() =>
  import("./WhiteboardCanvas").then((m) => ({ default: m.WhiteboardCanvas })),
);

type Props = {
  board: WhiteboardDetail;
  canEdit: boolean;
  userId: string;
  userName: string;
  showMinimap?: boolean;
  onSaved?: () => void;
  onZoomChange?: (pct: number) => void;
};

/** Client-only Konva canvas — avoids SSR / duplicate-React issues with react-konva. */
export const WhiteboardCanvasLazy = forwardRef<WhiteboardCanvasHandle, Props>(
  function WhiteboardCanvasLazy(props, ref) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) {
      return (
        <div className="relative w-full h-full wb-dot-grid bg-background flex items-center justify-center">
          <WhiteboardLoadingState label="Loading canvas…" />
        </div>
      );
    }

    return (
      <Suspense
        fallback={
          <div className="relative w-full h-full wb-dot-grid bg-background flex items-center justify-center">
            <WhiteboardLoadingState label="Loading canvas…" />
          </div>
        }
      >
        <WhiteboardCanvasInner ref={ref} {...props} />
      </Suspense>
    );
  },
);

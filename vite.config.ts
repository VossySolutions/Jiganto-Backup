import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    // react-konva must share the same React instance as the app (fixes useRef null crash)
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react-konva", "konva", "@xyflow/react", "recharts"],
  },
  root: path.resolve(import.meta.dirname, "client"),
  // .env lives at the repo root, not under client/ (which is Vite's default envDir).
  envDir: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@xyflow")) return "xyflow";
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "tiptap";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("pdfjs-dist")) return "pdfjs";
          if (id.includes("konva") || id.includes("react-konva")) return "konva";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("ag-grid")) return "ag-grid";
          if (id.includes("@supabase")) return "supabase";
        },
      },
    },
  },
  server: {
    hmr: {
      path: "/vite-hmr",
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Pencil,
  Eraser,
  ScanEye,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

interface EditorToolbarTopProps {
  tool: "pencil" | "eraser";
  brushSize: number;
  zoom: number;
  onToolChange: (tool: "pencil" | "eraser") => void;
  onBrushSizeChange: (size: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function EditorToolbarTop({
  tool,
  brushSize,
  zoom,
  onToolChange,
  onBrushSizeChange,
  onZoomIn,
  onZoomOut,
  onResetView,
}: EditorToolbarTopProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap border-b p-4">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToolChange("pencil")}
          title="Pencil (add to mask)"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant={tool === "eraser" ? "default" : "outline"}
          size="sm"
          onClick={() => onToolChange("eraser")}
          title="Eraser (remove from mask)"
        >
          <Eraser className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Size
        </span>
        <Slider
          value={[brushSize]}
          onValueChange={([v]) => onBrushSizeChange(v!)}
          min={2}
          max={80}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-6 text-right">
          {brushSize}
        </span>
      </div>

      <div className="items-center gap-1 hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={onZoomOut}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" size="sm" onClick={onZoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        {zoom !== 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetView}
            title="Reset view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface EditorToolbarBottomProps {
  padding: number;
  onPaddingChange: (padding: number) => void;
  onAutoDetect: () => void;
  isDetecting: boolean;
}

export function EditorToolbarBottom({
  padding,
  onPaddingChange,
  onAutoDetect,
  isDetecting,
}: EditorToolbarBottomProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap border-t p-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onAutoDetect}
        disabled={isDetecting}
      >
        {isDetecting ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <ScanEye className="h-4 w-4 mr-1" />
        )}
        Auto-detect
      </Button>

      <div className="flex items-center gap-2 min-w-50">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Mask padding
        </span>
        <Slider
          value={[Math.round(padding * 100)]}
          onValueChange={([v]) => onPaddingChange(v! / 100)}
          min={0}
          max={100}
          step={5}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
          {Math.round(padding * 100)}%
        </span>
      </div>
    </div>
  );
}

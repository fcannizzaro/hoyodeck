import { useState, useCallback } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/drop-zone";
import { MaskEditor } from "@/components/mask-editor";
import {
  EditorToolbarTop,
  EditorToolbarBottom,
} from "@/components/editor-toolbar";
import { GenerationPanel } from "@/components/generation-panel";
import { SavePanel } from "@/components/save-panel";
import { detectEyeRegions } from "@/lib/face-detection";
import { getPassword } from "@/lib/auth-store";

import type { CanvasManager, ViewState } from "@/lib/canvas-manager";

export const Route = createFileRoute("/editor")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getPassword()) {
      throw redirect({ to: "/" });
    }
  },
  component: EditorPage,
});

function EditorPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [canvasManager, setCanvasManager] = useState<CanvasManager | null>(
    null,
  );
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [brushSize, setBrushSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [padding, setPadding] = useState(0.2);
  const [isDetecting, setIsDetecting] = useState(false);
  const [resultBase64, setResultBase64] = useState<string | null>(null);

  const handleImageLoaded = useCallback((img: HTMLImageElement) => {
    setImage(img);
    setResultBase64(null);
    setZoom(1);
  }, []);

  const handleManagerReady = useCallback(
    (manager: CanvasManager) => {
      setCanvasManager(manager);
      manager.setTool(tool);
      manager.setBrushSize(brushSize);
    },
    [tool, brushSize],
  );

  const handleViewChange = useCallback((view: ViewState) => {
    setZoom(view.zoom);
  }, []);

  const handleToolChange = useCallback(
    (newTool: "pencil" | "eraser") => {
      setTool(newTool);
      canvasManager?.setTool(newTool);
    },
    [canvasManager],
  );

  const handleBrushSizeChange = useCallback(
    (size: number) => {
      setBrushSize(size);
      canvasManager?.setBrushSize(size);
    },
    [canvasManager],
  );

  const handleClearMask = useCallback(() => {
    canvasManager?.clearMask();
  }, [canvasManager]);

  const handleAutoDetect = useCallback(async () => {
    if (!image) return;
    setIsDetecting(true);
    try {
      const regions = await detectEyeRegions(image, padding);
      if (regions && canvasManager) {
        canvasManager.clearMask();
        canvasManager.setMaskFromPoints(regions);
      } else {
        // Detection failed -- this is expected for anime
        console.warn(
          "Auto-detection did not find eyes. Use the pencil tool to draw the mask manually.",
        );
      }
    } finally {
      setIsDetecting(false);
    }
  }, [image, canvasManager, padding]);

  const handlePaddingChange = useCallback((value: number) => {
    setPadding(value);
  }, []);

  const handleZoomIn = useCallback(() => {
    canvasManager?.zoomIn();
  }, [canvasManager]);

  const handleZoomOut = useCallback(() => {
    canvasManager?.zoomOut();
  }, [canvasManager]);

  const handleResetView = useCallback(() => {
    canvasManager?.resetView();
  }, [canvasManager]);

  const handleResult = useCallback((base64: string) => {
    setResultBase64(base64);
  }, []);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Editor</h1>
          {image && (
            <Button variant="outline" size="sm" onClick={handleClearMask}>
              Clear mask
            </Button>
          )}
        </div>

        {/* Step 1: Image Upload */}
        {!image && (
          <Card>
            <CardContent>
              <DropZone
                onImageLoaded={handleImageLoaded}
                label="Drop a character image to get started"
              />
            </CardContent>
          </Card>
        )}

        {/* Step 2: Mask Editor */}
        {image && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-0">
                <CardContent className="space-y-4 p-0">
                  <EditorToolbarTop
                    tool={tool}
                    brushSize={brushSize}
                    zoom={zoom}
                    onToolChange={handleToolChange}
                    onBrushSizeChange={handleBrushSizeChange}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onResetView={handleResetView}
                  />
                  <MaskEditor
                    image={image}
                    onManagerReady={handleManagerReady}
                    onViewChange={handleViewChange}
                  />
                  <EditorToolbarBottom
                    padding={padding}
                    onPaddingChange={handlePaddingChange}
                    onAutoDetect={handleAutoDetect}
                    isDetecting={isDetecting}
                  />
                </CardContent>
              </Card>

              {/* Step 3: Generation */}
              <Card>
                <CardContent>
                  <GenerationPanel
                    canvasManager={canvasManager}
                    onResult={handleResult}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Step 4: Save */}
            {resultBase64 && (
              <Card>
                <CardContent>
                  <SavePanel
                    resultBase64={resultBase64}
                    originalImage={image}
                  />
                </CardContent>
              </Card>
            )}

            {/* Reset */}
            <button
              onClick={() => {
                setImage(null);
                setCanvasManager(null);
                setResultBase64(null);
                setZoom(1);
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Start over with a new image
            </button>
          </>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/*
  LogoCropEditor
  - Displays the given image with no outer whitespace
  - Zoom control
  - Create a crop box by dragging; move it by dragging inside; click outside to clear
  - On save: returns a PNG Blob resampled to standardHeight (variable width)
*/
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const useElementSize = () => {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(() => {
      const rect = ref.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
};

const LogoCropEditor = ({ image, standardHeight = 192, onCancel, onSave }) => {
  const iw = image?.naturalWidth || image?.width || 0;
  const ih = image?.naturalHeight || image?.height || 0;
  const [zoom, setZoom] = useState(1);
  
  // Fixed viewing area dimensions - never change
  const VIEW_WIDTH = 600;
  const VIEW_HEIGHT = 320;

  // Fit so the whole image is visible initially
  const fit = useMemo(() => {
    if (!iw || !ih) return 1;
    const ratio = Math.max(iw, ih);
    return Math.min(VIEW_WIDTH, VIEW_HEIGHT) / ratio;
  }, [iw, ih]);

  const scaledW = Math.round(iw * fit * zoom);
  const scaledH = Math.round(ih * fit * zoom);

  // Crop state in SCREEN coordinates (relative to viewing area's top-left)
  const [crop, setCrop] = useState(null); // {x,y,w,h}
  const [dragMode, setDragMode] = useState(null); // 'create' | 'move' | null
  const dragStart = useRef({ x: 0, y: 0 });
  const startCrop = useRef(null);
  const containerRef = useRef(null);

  const pointInCrop = (x, y) => {
    if (!crop) return false;
    return x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h;
  };

  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragStart.current = { x, y };

    if (pointInCrop(x, y)) {
      setDragMode("move");
      startCrop.current = { ...crop };
    } else {
      // Always allow marquee selection, no pan mode
      setDragMode("create");
      startCrop.current = { x, y, w: 0, h: 0 };
      setCrop({ x, y, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (!dragMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragMode === "create") {
      const nx = Math.min(startCrop.current.x, x);
      const ny = Math.min(startCrop.current.y, y);
      const nw = Math.abs(x - startCrop.current.x);
      const nh = Math.abs(y - startCrop.current.y);
      setCrop({
        x: clamp(nx, 0, VIEW_WIDTH),
        y: clamp(ny, 0, VIEW_HEIGHT),
        w: clamp(nw, 0, VIEW_WIDTH - nx),
        h: clamp(nh, 0, VIEW_HEIGHT - ny),
      });
    } else if (dragMode === "move" && startCrop.current) {
      const dx = x - dragStart.current.x;
      const dy = y - dragStart.current.y;
      const nx = clamp(startCrop.current.x + dx, 0, VIEW_WIDTH - startCrop.current.w);
      const ny = clamp(startCrop.current.y + dy, 0, VIEW_HEIGHT - startCrop.current.h);
      setCrop({ ...startCrop.current, x: nx, y: ny });
    }
  };

  const handleMouseUp = (e) => {
    if (!containerRef.current) return;
    const wasMode = dragMode;
    setDragMode(null);

    if (wasMode === "create") {
      // If too small, treat as click outside and clear
      if (crop && (crop.w < 4 || crop.h < 4)) setCrop(null);
    } else if (!wasMode) {
      // Click without drag: toggle off if clicked outside crop
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!pointInCrop(x, y)) setCrop(null);
    }
  };

  const saveCropped = async () => {
    if (!image || !iw || !ih) return;

    const s = fit * zoom; // screen px per image px

    // Compute source rect in image coordinates
    let srcX = 0, srcY = 0, srcW = iw, srcH = ih;

    if (crop) {
      // Use crop area
      srcX = Math.max(0, Math.min(iw, Math.round((crop.x - (VIEW_WIDTH - scaledW) / 2) / s)));
      srcY = Math.max(0, Math.min(ih, Math.round((crop.y - (VIEW_HEIGHT - scaledH) / 2) / s)));
      srcW = Math.max(1, Math.min(iw - srcX, Math.round(crop.w / s)));
      srcH = Math.max(1, Math.min(ih - srcY, Math.round(crop.h / s)));
    } else {
      // Use full viewing window - map visible area to source coordinates
      const visibleLeft = Math.max(0, (VIEW_WIDTH - scaledW) / 2);
      const visibleTop = Math.max(0, (VIEW_HEIGHT - scaledH) / 2);
      const visibleWidth = Math.min(VIEW_WIDTH, scaledW);
      const visibleHeight = Math.min(VIEW_HEIGHT, scaledH);

      srcX = Math.max(0, Math.round((visibleLeft - (VIEW_WIDTH - scaledW) / 2) / s));
      srcY = Math.max(0, Math.round((visibleTop - (VIEW_HEIGHT - scaledH) / 2) / s));
      srcW = Math.max(1, Math.min(iw, Math.round(visibleWidth / s)));
      srcH = Math.max(1, Math.min(ih, Math.round(visibleHeight / s)));
    }

    // Build final canvas with standard height and proportional width
    const finalH = standardHeight;
    const finalW = Math.max(1, Math.round(finalH * (srcW / srcH)));

    const canvas = document.createElement("canvas");
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, finalW, finalH);
    ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, finalW, finalH);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to render image"))), "image/png");
    });

    onSave?.(blob);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Zoom</span>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          aria-label="Zoom logo"
        />
        <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
      </div>

      <div className="relative block mx-auto rounded-lg border-2 border-border bg-background overflow-hidden" style={{ width: VIEW_WIDTH, height: VIEW_HEIGHT }}>
        {image && (
          <img
            src={image.src}
            alt="Logo preview"
            style={{ 
              width: scaledW, 
              height: scaledH, 
              maxWidth: 'none',
              maxHeight: 'none',
              display: "block",
              position: "absolute",
              left: (VIEW_WIDTH - scaledW) / 2,
              top: (VIEW_HEIGHT - scaledH) / 2
            }}
          />
        )}
        {/* Crop overlay region */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ cursor: "crosshair" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setDragMode(null)}
        >
          {crop && (
            <div
              className="absolute ring-2 ring-primary/80 bg-primary/5"
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, cursor: dragMode === "move" ? "grabbing" : "grab" }}
              aria-label="Crop box"
            />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={saveCropped} disabled={!image}>Save</Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Click-drag to create a crop box. Drag inside the box to reposition. Click outside the box to clear it. If no box is drawn, the full visible area will be saved.
      </p>
    </div>
  );
};

export default LogoCropEditor;

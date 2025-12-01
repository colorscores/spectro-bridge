import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

const TestChartVisualization = ({ patches = [], pageSize, patchSize = 6, numberOfPages = 1 }) => {
  const PAGE_SIZES = {
    'A4': { width: 210, height: 297 },
    'A3': { width: 297, height: 420 },
    'Letter': { width: 216, height: 279 },
    'Legal': { width: 216, height: 356 },
    'Tabloid': { width: 279, height: 432 }
  };

  const selectedPageSize = PAGE_SIZES[pageSize];
  
  if (patches.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No patch data to display</p>
          <p className="text-sm">Import a CGATS file to see the test chart visualization</p>
        </div>
      </div>
    );
  }
  
  // Use A4 as default if no page size is selected
  const effectivePageSize = selectedPageSize || PAGE_SIZES['A4'];

  // Calculate patches per page
  const margin = 10; // 10mm margins
  const spacing = 1; // 1mm spacing between patches
  const patchesPerRow = Math.floor((effectivePageSize.width - 2 * margin) / (patchSize + spacing));
  const patchesPerCol = Math.floor((effectivePageSize.height - 2 * margin) / (patchSize + spacing));
  const patchesPerPage = patchesPerRow * patchesPerCol;

  // Calculate scale factor for display (fit to container)
  const displayWidth = 400; // Fixed display width
  const scale = displayWidth / effectivePageSize.width;
  const displayHeight = effectivePageSize.height * scale;
  const displayPatchSize = patchSize * scale;
  const displayMargin = margin * scale;
  const displaySpacing = spacing * scale;

  const renderPage = (pageIndex) => {
    const startPatch = pageIndex * patchesPerPage;
    const endPatch = Math.min(startPatch + patchesPerPage, patches.length);
    const pagePatchCount = endPatch - startPatch;

    return (
      <div
        key={pageIndex}
        className="border-2 border-dashed border-muted-foreground/30 bg-white relative mb-4 flex-shrink-0"
        style={{
          width: displayWidth,
          height: displayHeight,
          minHeight: displayHeight
        }}
      >
        {/* Page border indicator */}
        <div className="absolute inset-1 border border-muted-foreground/20 rounded-sm" />
        
        {/* Page number */}
        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background px-2 py-1 rounded">
          Page {pageIndex + 1}
        </div>

        {/* Render patches */}
        <div 
          className="absolute"
          style={{
            left: displayMargin,
            top: displayMargin,
            width: displayWidth - 2 * displayMargin,
            height: displayHeight - 2 * displayMargin
          }}
        >
          {Array.from({ length: pagePatchCount }, (_, i) => {
            const patchIndex = startPatch + i;
            const patch = patches[patchIndex];
            const row = Math.floor(i / patchesPerRow);
            const col = i % patchesPerRow;
            
            // Get color from patch data
            let backgroundColor = '#f0f0f0'; // Default gray
            if (patch && patch.hex) {
              backgroundColor = patch.hex;
            } else if (patch && patch.cmyk) {
              // Convert CMYK to approximate RGB for display
              const { c = 0, m = 0, y = 0, k = 0 } = patch.cmyk;
              const r = Math.round(255 * (1 - c/100) * (1 - k/100));
              const g = Math.round(255 * (1 - m/100) * (1 - k/100));
              const b = Math.round(255 * (1 - y/100) * (1 - k/100));
              backgroundColor = `rgb(${r}, ${g}, ${b})`;
            }

            return (
              <div
                key={i}
                className="absolute border border-muted-foreground/20"
                style={{
                  left: col * (displayPatchSize + displaySpacing),
                  top: row * (displayPatchSize + displaySpacing),
                  width: displayPatchSize,
                  height: displayPatchSize,
                  backgroundColor
                }}
                title={patch ? `Patch ${patchIndex + 1}: ${patch.name || `Sample ${patchIndex + 1}`}` : ''}
              />
            );
          })}
        </div>

        {/* Grid lines for reference */}
        <div className="absolute inset-0 pointer-events-none opacity-10">
          {/* Vertical grid lines */}
          {Array.from({ length: patchesPerRow + 1 }, (_, i) => (
            <div
              key={`v-${i}`}
              className="absolute bg-muted-foreground"
              style={{
                left: displayMargin + i * (displayPatchSize + displaySpacing),
                top: displayMargin,
                width: 1,
                height: displayHeight - 2 * displayMargin
              }}
            />
          ))}
          {/* Horizontal grid lines */}
          {Array.from({ length: patchesPerCol + 1 }, (_, i) => (
            <div
              key={`h-${i}`}
              className="absolute bg-muted-foreground"
              style={{
                left: displayMargin,
                top: displayMargin + i * (displayPatchSize + displaySpacing),
                width: displayWidth - 2 * displayMargin,
                height: 1
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="mb-4 text-sm text-muted-foreground">
          <p>Patches per page: {patchesPerPage} ({patchesPerRow} × {patchesPerCol})</p>
          <p>Total patches: {patches.length}</p>
          <p>Number of pages: {numberOfPages}</p>
          <p>Page size: {pageSize || 'A4'} ({effectivePageSize.width}mm × {effectivePageSize.height}mm)</p>
          <p>Patch size: {patchSize}mm × {patchSize}mm</p>
        </div>

        <div className="flex flex-col items-center">
          {Array.from({ length: numberOfPages }, (_, i) => renderPage(i))}
        </div>
      </div>
    </ScrollArea>
  );
};

export default TestChartVisualization;
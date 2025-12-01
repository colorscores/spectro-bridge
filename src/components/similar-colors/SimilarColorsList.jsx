import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

import { toast } from 'react-hot-toast';
import { getDeltaEOptions } from '@/lib/constants/deltaEMethods';
import { labToHexD65 } from '@/lib/colorUtils';

const SimilarColorCard = React.forwardRef(({ color, index, deltaEType, isSelected = false, onClick, illuminantKey = 'D50' }, ref) => {
  const handleActionClick = () => {
    toast("🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀");
  };

  const displayHex = useMemo(() => {
    const L = Number(color.lab_l);
    const a = Number(color.lab_a);
    const b = Number(color.lab_b);
    if (Number.isFinite(L) && Number.isFinite(a) && Number.isFinite(b)) {
      try {
        return labToHexD65(L, a, b, illuminantKey);
      } catch {}
    }
    return '#E5E7EB';
  }, [color.lab_l, color.lab_a, color.lab_b, illuminantKey]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(e);
    }
  };

  return (
    <motion.div
      ref={ref}
      className={`relative ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-muted/40'} border-b ${isSelected ? 'border-white border-t border-t-white' : 'border-gray-200'} flex overflow-hidden h-[108px] cursor-pointer transition-colors`}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.05,
        ease: "easeOut"
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="w-32 flex-shrink-0 h-full" 
        style={{ backgroundColor: displayHex }}
      ></div>
      <div className="flex-grow p-3 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start">
          <div className="flex-1 overflow-hidden pr-2">
            <p className="font-bold text-gray-800 text-base leading-tight" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{color.name}</p>
          </div>
          <div className="text-sm text-gray-600 text-right">
            <p><span className="font-medium">Lab:</span> {color.lab_l?.toFixed(1)}, {color.lab_a?.toFixed(1)}, {color.lab_b?.toFixed(1)}</p>
          </div>
        </div>
        <div className="flex justify-between items-end">
          <div className="text-sm text-gray-600">
            <p><span className="font-medium">Type:</span> {color.standard_type || 'N/A'}</p>
          </div>
          <div className="text-sm text-right">
            <p className="font-semibold text-green-600">{deltaEType}: {color.deltaE?.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
SimilarColorCard.displayName = 'SimilarColorCard';

const SimilarColorsList = ({ colors, deltaEType, loading = false, setDeltaEType, threshold, setThreshold, selectedSimilarId, onSelectSimilar, selectedStatsRow, onStatsRowProcessed, illuminantKey = 'D50' }) => {
  const colorText = colors.length === 1 ? 'Similar Color' : 'Similar Colors';
  const rootRef = useRef(null);
  const itemRefs = useRef(new Map());
  const suppressNextScrollRef = useRef(false);
  const setItemRef = (id) => (el) => {
    if (el) itemRefs.current.set(id, el); else itemRefs.current.delete(id);
  };

  // Center selected similar in the viewport only when selection came from plot and is off-screen
  useEffect(() => {
    if (!selectedSimilarId) return;
    const root = rootRef.current;
    if (!root) return;
    const viewport = root.querySelector('[data-viewport]');
    const itemEl = itemRefs.current.get(selectedSimilarId);
    if (!viewport || !itemEl) return;

    // If selection came from a row click, skip auto-scroll once
    if (suppressNextScrollRef.current) {
      suppressNextScrollRef.current = false;
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    const isOffscreen = itemRect.top < viewportRect.top || itemRect.bottom > viewportRect.bottom;

    if (isOffscreen) {
      const target = itemEl.offsetTop - (viewport.clientHeight / 2 - itemEl.clientHeight / 2);
      viewport.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  }, [selectedSimilarId]);

  // Handle stats row selection - find closest color and scroll to it
  useEffect(() => {
    if (!selectedStatsRow || !colors.length || !rootRef.current) return;

    // Find color with closest Lab values to the stats row
    const targetLab = selectedStatsRow.lab;
    if (!targetLab) return;

    let closestIndex = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    colors.forEach((color, index) => {
      if (!color.lab_l || !color.lab_a || !color.lab_b) return;
      
      // Calculate Euclidean distance in Lab space
      const dL = targetLab.L - color.lab_l;
      const da = targetLab.a - color.lab_a;
      const db = targetLab.b - color.lab_b;
      const distance = Math.sqrt(dL * dL + da * da + db * db);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // Scroll to the closest color and select it
    const closestColor = colors[closestIndex];
    if (closestColor) {
      const itemEl = itemRefs.current.get(closestColor.id);
      if (itemEl) {
        const root = rootRef.current;
        const viewport = root.querySelector('[data-viewport]');
        if (viewport) {
          const target = itemEl.offsetTop - (viewport.clientHeight / 2 - itemEl.clientHeight / 2);
          viewport.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
        }
      }
      onSelectSimilar?.(closestColor.id);
    }
    
    // Mark stats row as processed
    onStatsRowProcessed?.();
  }, [selectedStatsRow, colors, onSelectSimilar, onStatsRowProcessed]);
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="bg-white border-b p-4 pb-4 flex justify-between items-center h-[64px]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">
            {loading ? 'Loading...' : `${colors.length} ${colorText}`}
          </h3>
          {loading && (
            <span className="inline-flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
              Updating…
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="deltaE-type" className="text-sm font-medium whitespace-nowrap">ΔE Type:</Label>
            <Select value={deltaEType} onValueChange={setDeltaEType}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select ΔE type" />
              </SelectTrigger>
              <SelectContent>
                {getDeltaEOptions().map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="threshold" className="text-sm font-medium whitespace-nowrap">Threshold:</Label>
            <Input
              id="threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="1.0"
              step="0.1"
              className="w-20"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative" aria-busy={loading}>
        {/* Loading overlay to fully cover previous content during recalculations */}
        {loading && (
          <div className="absolute inset-0 z-10 bg-white" aria-hidden="true" />
        )}
        <ScrollArea className="h-full" ref={rootRef}>
          <div className="animate-fade-in">
              {!loading && colors.map((color, index) => (
                <SimilarColorCard
                  ref={setItemRef(color.id)}
                  key={color.id}
                  color={color}
                  index={index}
                  deltaEType={deltaEType}
                  isSelected={selectedSimilarId === color.id}
                  onClick={() => {
                    suppressNextScrollRef.current = true;
                    onSelectSimilar?.(selectedSimilarId === color.id ? null : color.id);
                  }}
                  illuminantKey={illuminantKey}
                />
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default SimilarColorsList;
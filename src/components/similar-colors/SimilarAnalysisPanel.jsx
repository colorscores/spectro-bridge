import React, { useMemo, useState, startTransition } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Save } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, CartesianGrid, XAxis, YAxis, Tooltip, Scatter, ReferenceDot } from 'recharts';
import { toast } from 'react-hot-toast';
import { labToHex, labToHexD65 } from '@/lib/colorUtils';
import { calculateDeltaE } from '@/lib/deltaE';
import { labToChromaHue } from '@/lib/colorUtils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { Skeleton } from '@/components/ui/skeleton';
import PrintColorCardPanel from '@/components/matching/PrintColorCardPanel';

const SimilarAnalysisPanel = ({ masterColor, similarColors = [], deltaEType, referenceLab, threshold, selectedSimilarId, onSelectSimilar, illuminantKey = 'D50', loading = false, onFilteredColorsChange, onStatsRowSelect }) => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [mode, setMode] = useState('distribution');
  const [population, setPopulation] = useState('all'); // all | best | worst
  const [percent, setPercent] = useState(100);
  const [selectedStat, setSelectedStat] = useState(null); // 'min' | 'avg' | 'max' | null
  const [selectedPointData, setSelectedPointData] = useState(null);
  const [statsScope, setStatsScope] = useState('population'); // 'population' | 'all'
  const [isSliderOpen, setIsSliderOpen] = useState(false);
  const [isPrintPanelOpen, setIsPrintPanelOpen] = useState(false);

  // Tooltip positioning helpers
  const containerRef = React.useRef(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const handleMouseMove = (e) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const estW = 240;
    const estH = 72;
    const pad = 12;
    const toLeft = clientX > window.innerWidth - estW - pad;
    let x = toLeft ? clientX - rect.left - estW - pad : clientX - rect.left + pad;
    let y = clientY - rect.top - estH / 2;
    y = Math.max(pad, Math.min(y, rect.height - estH - pad));
    setTooltipPos({ x: Math.round(x), y: Math.round(y) });
  };

  // Square chart sizing via ResizeObserver, respecting container height
  const [chartHeight, setChartHeight] = useState(0);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 0;
      const h = el.clientHeight || 0;
      const pad = 8; // minimal padding for tight fit
      const size = Math.max(200, Math.min(w, h) - pad);
      setChartHeight(size > 0 ? size : 200);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center the plot on the master color by using relative a*, b*
  const centerA = (referenceLab?.a ?? masterColor?.lab_a ?? 0);
  const centerB = (referenceLab?.b ?? masterColor?.lab_b ?? 0);
  const masterL = (referenceLab?.L ?? masterColor?.lab_l ?? 0);
  const masterHex = labToHexD65(masterL, centerA, centerB, illuminantKey);
  const maxEven = useMemo(() => {
    if (!similarColors?.length) return 2;
    let maxA = 0, maxB = 0;
    for (const c of similarColors) {
      const a = (c.lab_a ?? 0) - centerA;
      const b = (c.lab_b ?? 0) - centerB;
      const absA = Math.abs(Number(a));
      const absB = Math.abs(Number(b));
      if (absA > maxA) maxA = absA;
      if (absB > maxB) maxB = absB;
    }
    const raw = Math.max(maxA, maxB);
    const rawSafe = Number.isFinite(raw) ? raw : 2;
    const even = Math.ceil(rawSafe / 2) * 2;
    return Math.max(2, even);
  }, [similarColors, centerA, centerB]);

  const axisDomain = useMemo(() => {
    const m = Number.isFinite(maxEven) && maxEven > 0 ? maxEven : 2;
    return [-m, m];
  }, [maxEven]);

  // Compute "nice" tick labels targeting ~7-9 labels including 0
  const labelTicks = useMemo(() => {
    const mRaw = Number.isFinite(maxEven) && maxEven > 0 ? maxEven : 2;
    const target = 9; // aim for 7-9 labels
    const range = 2 * mRaw;
    const rawStep = range / (target - 1);
    // Nice step: 1, 2, 2.5, 5, 10 ...
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const residual = rawStep / mag;
    let nice;
    if (residual <= 1) nice = 1;
    else if (residual <= 2) nice = 2;
    else if (residual <= 2.5) nice = 2.5;
    else if (residual <= 5) nice = 5;
    else nice = 10;
    let step = nice * mag;
    // Adjust to keep count within 7-9
    let count = Math.floor(range / step) + 1;
    if (count > 9) step *= 2;
    if (count < 7) step = Math.max(step / 2, 0.5);
    const k = Math.floor(mRaw / step);
    const arr = [];
    for (let i = -k; i <= k; i++) arr.push(parseFloat((i * step).toFixed(step < 1 ? 1 : 2)));
    // Always ensure 0 included
    if (!arr.includes(0)) arr.push(0);
    arr.sort((a, b) => a - b);
    return arr;
  }, [maxEven]);

  const formatTick = (v) => {
    const abs = Math.abs(v);
    return Number.isInteger(abs) ? v : Number(abs) >= 10 ? v.toFixed(0) : v.toFixed(1);
  };

  const deType = React.useMemo(() => {
    const t = deltaEType || 'dE76';
    if (t === 'dE2000') return 'dE00';
    if (t === 'dECMC 2:1') return 'dECMC2:1';
    if (t === 'dECMC 1:1') return 'dECMC1:1';
    return t;
  }, [deltaEType]);

  const refLabObj = React.useMemo(() => ({ L: masterL, a: centerA, b: centerB }), [masterL, centerA, centerB]);

  const getDE = React.useCallback((c) => {
    if (!c) return Number.POSITIVE_INFINITY;
    const L = Number(c.lab_l);
    const a = Number(c.lab_a);
    const b = Number(c.lab_b);
    if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
    return calculateDeltaE(refLabObj, { L, a, b }, deType);
  }, [refLabObj, deType]);

  const sorted = useMemo(() => {
    return [...(similarColors || [])].sort((a, b) => getDE(a) - getDE(b));
  }, [similarColors, getDE]);

  const subset = useMemo(() => {
    if (!sorted.length) return [];
    if (population === 'all') return sorted;
    const count = Math.max(1, Math.round(sorted.length * (percent / 100)));
    if (population === 'worst') return sorted.slice(-count);
    return sorted.slice(0, count); // best
  }, [sorted, population, percent]);

  // Notify parent of filtered colors change
  React.useEffect(() => {
    onFilteredColorsChange?.(subset);
  }, [subset, onFilteredColorsChange]);

  const highlightedIds = useMemo(() => new Set(subset.map((c) => c.id)), [subset]);

  const allPoints = useMemo(() =>
    (similarColors || []).map((c) => ({
      id: c.id,
      name: c.name,
      dE: getDE(c),
      a: (c.lab_a ?? 0) - centerA,
      b: (c.lab_b ?? 0) - centerB,
      lab_l: c.lab_l ?? 0,
      lab_a: c.lab_a ?? 0,
      lab_b: c.lab_b ?? 0,
      hex: labToHexD65(c.lab_l ?? 0, c.lab_a ?? 0, c.lab_b ?? 0, illuminantKey),
    })),
  [similarColors, centerA, centerB, getDE, illuminantKey]);

  const selectedPlotPoint = useMemo(() => allPoints.find((p) => p.id === selectedSimilarId) || null, [allPoints, selectedSimilarId]);
  const highlightData = allPoints.filter((p) => highlightedIds.has(p.id));
  const restData = allPoints.filter((p) => !highlightedIds.has(p.id));

  // When a similar is selected from outside (list), clear any active stat row
  React.useEffect(() => {
    if (selectedSimilarId) setSelectedStat(null);
  }, [selectedSimilarId]);

  // Clear selected stat when illuminant or reference changes
  React.useEffect(() => {
    setSelectedStat(null);
  }, [referenceLab, illuminantKey]);

  const getPointColor = (point) => {
    // Selected point is always blue
    if (selectedSimilarId === point.id) return '#2563eb';
    
    // If All is selected or not in best/worst subset, show gray
    if (population === 'all' || !highlightedIds.has(point.id)) return '#cbd5e1';
    
    // Color based on population selection
    return population === 'best' ? '#22c55e' : '#ef4444';
  };
  const handlePointClick = (d) => {
    const p = d?.payload || d;
    if (!p) return;
    setSelectedStat(null);
    onSelectSimilar?.(selectedSimilarId === p.id ? null : p.id);
  };

  const stats = useMemo(() => {
    const base = (statsScope === 'all') ? sorted : subset;
    const valid = (base || []).filter((c) => Number.isFinite(getDE(c)));
    if (!valid.length) return [];

    // Calculate Delta E for each color to find actual min/max colors
    const colorsWithDeltaE = valid.map((c) => {
      const colorLab = { L: c.lab_l ?? 0, a: c.lab_a ?? 0, b: c.lab_b ?? 0 };
      const deltaE = calculateDeltaE(refLabObj, colorLab, deType);
      return { color: c, lab: colorLab, deltaE };
    });

    // Sort by Delta E to find actual min/max colors
    const sortedByDeltaE = colorsWithDeltaE.sort((a, b) => a.deltaE - b.deltaE);
    
    const minEntry = sortedByDeltaE[0] || null;
    const maxEntry = sortedByDeltaE[sortedByDeltaE.length - 1] || null;
    
    const minLab = minEntry?.lab || { L: 0, a: 0, b: 0 };
    const maxLab = maxEntry?.lab || { L: 0, a: 0, b: 0 };

    const sum = valid.reduce((acc, c) => {
      const L = c.lab_l ?? 0, a = c.lab_a ?? 0, b = c.lab_b ?? 0;
      return { L: acc.L + L, a: acc.a + a, b: acc.b + b };
    }, { L: 0, a: 0, b: 0 });

    const avgLab = {
      L: sum.L / valid.length,
      a: sum.a / valid.length,
      b: sum.b / valid.length,
    };

    const rows = [
      { key: 'min', label: 'Min', lab: minLab, dE: calculateDeltaE(refLabObj, minLab, deType), colorId: minEntry?.color?.id, color: minEntry?.color },
      { key: 'avg', label: 'Avg', lab: avgLab, dE: calculateDeltaE(refLabObj, avgLab, deType), colorId: null, color: null },
      { key: 'max', label: 'Max', lab: maxLab, dE: calculateDeltaE(refLabObj, maxLab, deType), colorId: maxEntry?.color?.id, color: maxEntry?.color },
    ].map((r) => ({
      ...r,
      labStr: `${r.lab.L.toFixed(1)}, ${r.lab.a.toFixed(1)}, ${r.lab.b.toFixed(1)}`,
      dE: (r.dE ?? 0).toFixed(2),
      hex: labToHexD65(r.lab.L, r.lab.a, r.lab.b, illuminantKey),
    }));

    return rows;
  }, [subset, sorted, statsScope, getDE, refLabObj, deType, illuminantKey]);

  // Synchronize selectedStat with selectedSimilarId
  React.useEffect(() => {
    if (!selectedSimilarId) {
      // No match selected, clear stat selection (but preserve 'avg' since it doesn't have a point)
      if (selectedStat !== 'avg') {
        setSelectedStat(null);
      }
      return;
    }

    // Check if the selected match corresponds to min or max
    const minRow = stats.find(r => r.key === 'min');
    const maxRow = stats.find(r => r.key === 'max');

    if (minRow?.colorId === selectedSimilarId) {
      setSelectedStat('min');
    } else if (maxRow?.colorId === selectedSimilarId) {
      setSelectedStat('max');
    } else {
      // Selected match is neither min nor max
      setSelectedStat(null);
    }
  }, [selectedSimilarId, stats]);

  const selectedPoint = useMemo(() => {
    if (!selectedStat) return null;
    const row = stats.find((r) => r.key === selectedStat);
    if (!row) return null;
    const { L, a, b } = row.lab || {};
    return { x: ((a ?? 0) - centerA), y: ((b ?? 0) - centerB) };
  }, [selectedStat, stats, centerA, centerB]);

  // Function to calculate individual delta components
  const calculateDeltaComponents = (refLab, sampleLab, deltaEType) => {
    const dL = sampleLab.L - refLab.L;
    const da = sampleLab.a - refLab.a;
    const db = sampleLab.b - refLab.b;
    
    const refCH = labToChromaHue(refLab.L, refLab.a, refLab.b);
    const sampleCH = labToChromaHue(sampleLab.L, sampleLab.a, sampleLab.b);
    const dC = sampleCH.C - refCH.C;
    const dH = sampleCH.h - refCH.h;
    
    const deltaE = calculateDeltaE(refLab, sampleLab, deltaEType);
    
    return { deltaE, dL, da, db, dC, dH };
  };

  // Get sample color for variation or distribution view
  const selectedSampleColor = useMemo(() => {
    if (mode === 'variation' && selectedSimilarId) {
      return similarColors.find(c => c.id === selectedSimilarId);
    }
    if (mode === 'distribution') {
      if (selectedPointData) return selectedPointData;
      if (selectedStat && stats.length) {
        const statRow = stats.find(s => s.key === selectedStat);
        if (statRow?.color) return statRow.color;
      }
      // Fallback: if we have selectedSimilarId but no point/stat, find the color
      if (selectedSimilarId) {
        return similarColors.find(c => c.id === selectedSimilarId);
      }
    }
    return null;
  }, [mode, selectedSimilarId, selectedPointData, selectedStat, similarColors, stats]);

  // Calculate variation data for the selected sample
  const variationData = useMemo(() => {
    if (!selectedSampleColor) return null;
    
    const sampleLab = {
      L: selectedSampleColor.lab_l ?? 0,
      a: selectedSampleColor.lab_a ?? 0,
      b: selectedSampleColor.lab_b ?? 0
    };
    
    const refCH = labToChromaHue(refLabObj.L, refLabObj.a, refLabObj.b);
    const sampleCH = labToChromaHue(sampleLab.L, sampleLab.a, sampleLab.b);
    
    const components = calculateDeltaComponents(refLabObj, sampleLab, deType);
    
    return {
      reference: { ...refLabObj, C: refCH.C, h: refCH.h },
      sample: { ...sampleLab, C: sampleCH.C, h: sampleCH.h },
      deltas: components
    };
  }, [selectedSampleColor, refLabObj, deType]);

  const percentLabel = population === 'all' ? 'All' : `${percent}%`;
  const scopeLabel = statsScope === 'all' ? 'All colors' : (population === 'all' ? 'All colors' : `${population === 'best' ? 'Best' : 'Worst'} ${percentLabel}`);

const handleSave = async () => {
  try {
    const statRow = selectedStat ? stats.find((r) => r.key === selectedStat) : null;
    const fromPoint = !statRow && selectedPlotPoint ? selectedPlotPoint : null;
    if (!statRow && !fromPoint) return;

    // Resolve organization id (from context or fallback RPC)
    let orgId = profile?.organization_id || null;
    if (!orgId) {
      try {
        const { data: rpcOrg, error: rpcErr } = await supabase.rpc('get_my_org_id');
        if (!rpcErr && rpcOrg) orgId = rpcOrg;
      } catch {}
    }
    if (!orgId) {
      toast.error('Organization not found. Please sign in again.');
      return;
    }

    let L = null, a = null, b = null, hex = null;
    if (statRow) {
      L = Number(statRow.lab?.L);
      a = Number(statRow.lab?.a);
      b = Number(statRow.lab?.b);
      hex = (Number.isFinite(L) && Number.isFinite(a) && Number.isFinite(b)) ? labToHexD65(L, a, b, illuminantKey) : masterHex;
    } else if (fromPoint) {
      L = fromPoint.lab_l ?? null;
      a = fromPoint.lab_a ?? null;
      b = fromPoint.lab_b ?? null;
      hex = (Number.isFinite(L) && Number.isFinite(a) && Number.isFinite(b)) ? labToHexD65(L, a, b, illuminantKey) : masterHex;
    }

    const defaultName = '';
    const { data: colorRow, error } = await supabase
      .from('colors')
      .insert([{ name: defaultName, hex, standard_type: 'master', organization_id: orgId }])
      .select('id')
      .single();
    if (error) throw error;

    if (Number.isFinite(L) && Number.isFinite(a) && Number.isFinite(b)) {
      try {
        await supabase.from('color_measurements').insert([{ color_id: colorRow.id, mode: 'M1', lab: { L, a, b } }]);
      } catch (mErr) {
        console.warn('Could not attach measurement to new color:', mErr);
      }
    }

    toast.success('New color created. Please complete details.');
    try {
      sessionStorage.setItem('newColorReferrer', window.location.pathname + window.location.search);
    } catch {}
    navigate(`/colors/${colorRow.id}?mode=new&from=similar`);
  } catch (e) {
    console.error('Create color failed:', e);
    toast.error('Failed to create color');
  }
};
const handlePrint = () => {
  console.debug('[SimilarAnalysisPanel] Print clicked:', {
    mode,
    selectedSimilarId,
    selectedStat,
    selectedSampleColorId: selectedSampleColor?.id,
    selectedSampleColorMeasurementId: selectedSampleColor?.measurement_id,
    selectedSampleColorMatchMeasurementId: selectedSampleColor?.match_measurement_id
  });

  // In variation mode: require a similar color with id
  if (mode === 'variation') {
    if (!selectedSimilarId) {
      toast.error('Please select a similar color to print');
      return;
    }
  }
  
  // In distribution mode: only allow concrete matches (min/max with ids), not "avg"
  if (mode === 'distribution') {
    if (selectedStat === 'avg') {
      toast.error('Select a specific match to print (Min or Max)');
      return;
    }
    if (!selectedStat && !selectedSimilarId) {
      toast.error('Please select a color to print');
      return;
    }
  }
  
  setIsPrintPanelOpen(true);
};

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-md border bg-popover text-popover-foreground shadow p-2 text-xs max-w-[240px] whitespace-normal break-words">
        <div className="font-medium truncate">{d.name || 'Color'}</div>
        <div className="font-mono">L { (d.lab_l ?? 0).toFixed(1) }, a { (d.lab_a ?? 0).toFixed(1) }, b { (d.lab_b ?? 0).toFixed(1) }</div>
        <div className="font-mono">ΔE { (d.dE ?? 0).toFixed(2) }</div>
      </div>
    );
  };

  return (
    <Card className="h-full min-h-0 flex flex-col shadow-lg">
      <CardHeader className="p-3">
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v)} className="w-full grid grid-cols-2">
          <ToggleGroupItem value="variation" aria-label="Basic Difference">Basic Difference</ToggleGroupItem>
          <ToggleGroupItem value="distribution" aria-label="Advanced Compare">Advanced Compare</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="flex-grow min-h-0 flex flex-col p-2 gap-2">
        <div ref={containerRef} onMouseMove={handleMouseMove} className="flex-1 min-h-0 flex items-center justify-center">
          {loading ? (
            <div className="w-full h-full min-h-[180px] flex items-center justify-center">
              <Skeleton className="w-full h-full min-h-[180px] rounded" />
            </div>
          ) : mode === 'variation' ? (
            <div className="w-full px-4 py-6">
              {!selectedSampleColor ? (
                <div className="text-center text-muted-foreground py-8">
                  Select a similar color to see results
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-center mb-6">
                    Color Variation Analysis: {selectedSampleColor.name || 'Selected Color'}
                  </div>
                  
                  {/* Variation Table */}
                  <div className="space-y-0">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_auto_2fr] bg-background">
                      <div className="p-4 text-sm font-medium">Metric</div>
                      <div className="p-4 text-sm font-medium text-center">Δ</div>
                      <div className="p-4 text-sm font-medium text-center">Description</div>
                    </div>
                    
                    {/* Data Rows */}
                    {variationData && [
                      { 
                        label: `${deType}`, 
                        delta: variationData.deltas.deltaE.toFixed(2), 
                        description: ""
                      },
                      { 
                        label: 'ΔL*', 
                        delta: variationData.deltas.dL.toFixed(1), 
                        description: variationData.deltas.dL > 0 ? "Too Light" : variationData.deltas.dL < 0 ? "Too Dark" : ""
                      },
                      { 
                        label: 'Δa*', 
                        delta: variationData.deltas.da.toFixed(1), 
                        description: variationData.deltas.da > 0 ? "Too Red" : variationData.deltas.da < 0 ? "Too Green" : ""
                      },
                      { 
                        label: 'Δb*', 
                        delta: variationData.deltas.db.toFixed(1), 
                        description: variationData.deltas.db > 0 ? "Too Yellow" : variationData.deltas.db < 0 ? "Too Blue" : ""
                      },
                      { 
                        label: 'ΔC*', 
                        delta: variationData.deltas.dC.toFixed(1), 
                        description: variationData.deltas.dC > 0 ? "Too Saturated" : variationData.deltas.dC < 0 ? "Too Dull" : ""
                      },
                      { 
                        label: 'Δh*', 
                        delta: variationData.deltas.dH.toFixed(1), 
                        description: ""
                      }
                    ].map((row, idx) => (
                      <div key={idx} className="space-y-0">
                        <div className="grid grid-cols-[1fr_auto_2fr] min-h-[3rem]">
                          <div className="p-4 text-sm font-medium flex items-center">{row.label}</div>
                          <div className="p-4 text-sm text-center flex items-center justify-center">{row.delta}</div>
                          <div className="p-4 text-sm text-center flex items-center justify-center">{row.description}</div>
                        </div>
                        {idx < 5 && (
                          <div className="mx-4 border-t border-border"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div style={{ width: chartHeight, height: chartHeight, maxWidth: '100%', maxHeight: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 15, bottom: 16, left: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    dataKey="a"
                    name="Δa*"
                    domain={axisDomain}
                    ticks={labelTicks}
                    tickFormatter={formatTick}
                    interval={0}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickMargin={2}
                    height={20}
                    label={{ value: 'Δa*', position: 'insideBottom', offset: -16 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="b"
                    name="Δb*"
                    domain={axisDomain}
                    ticks={labelTicks}
                    tickFormatter={formatTick}
                    interval={0}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickMargin={2}
                    width={26}
                    label={{ value: 'Δb*', angle: -90, position: 'insideLeft', offset: 0 }}
                  />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={<CustomTooltip />}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ maxWidth: 240, whiteSpace: 'normal' }}
                  offset={12}
                  position={tooltipPos || undefined}
                />
                {/* Gray background dots for all points */}
                <Scatter 
                  name="All Points" 
                  data={allPoints} 
                  fill="#cbd5e1" 
                  shape="circle" 
                  isAnimationActive={false} 
                  onClick={handlePointClick} 
                />
                {/* Green dots for Best range */}
                {population === 'best' && (
                  <Scatter 
                    name="Best Range" 
                    data={highlightData} 
                    fill="#22c55e" 
                    shape="circle" 
                    isAnimationActive={false} 
                    onClick={handlePointClick} 
                  />
                )}
                {/* Red dots for Worst range */}
                {population === 'worst' && (
                  <Scatter 
                    name="Worst Range" 
                    data={highlightData} 
                    fill="#ef4444" 
                    shape="circle" 
                    isAnimationActive={false} 
                    onClick={handlePointClick} 
                  />
                )}
                {/* Blue dot for selected point */}
                {selectedPlotPoint && (
                  <Scatter 
                    name="Selected Point" 
                    data={[selectedPlotPoint]} 
                    fill="#2563eb" 
                    shape="circle" 
                    isAnimationActive={false} 
                    onClick={handlePointClick} 
                  />
                )}
                {/* Master at center (0,0): ring + dot */}
                <ReferenceDot x={0} y={0} r={6} fill="transparent" stroke="#111827" strokeWidth={2} style={{ pointerEvents: 'none' }} />
                <ReferenceDot x={0} y={0} r={2.5} fill="#111827" stroke="transparent" style={{ pointerEvents: 'none' }} />
                {/* Selected stat marker */}
                {selectedPoint && (
                  <>
                    <ReferenceDot x={selectedPoint.x} y={selectedPoint.y} r={7} fill="transparent" stroke="#2563eb" strokeWidth={2} style={{ pointerEvents: 'none' }} />
                    <ReferenceDot x={selectedPoint.x} y={selectedPoint.y} r={3} fill="#2563eb" stroke="transparent" style={{ pointerEvents: 'none' }} />
                  </>
                )}
                {/* Selected point (click) marker */}
                {selectedPlotPoint && (
                  <ReferenceDot x={selectedPlotPoint.a} y={selectedPlotPoint.b} r={7} fill="transparent" stroke={getPointColor(selectedPlotPoint)} strokeWidth={2} style={{ pointerEvents: 'none' }} />
                )}
              </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Sample Range Controls - only show in distribution mode */}
        {mode === 'distribution' && (
          <div className="flex items-center gap-3 px-2 py-2 border-t border-border">
            <span className="text-sm text-muted-foreground">Sample range:</span>
            <Select value={population} onValueChange={setPopulation}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="best">Best</SelectItem>
                <SelectItem value="worst">Worst</SelectItem>
              </SelectContent>
            </Select>
            {(population === 'best' || population === 'worst') && (
              <div className="flex items-center gap-2">
                <Popover open={isSliderOpen} onOpenChange={setIsSliderOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      type="number"
                      value={percent}
                      onChange={(e) => {
                        const value = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                        setPercent(value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setIsSliderOpen(false);
                        }
                      }}
                      onClick={() => setIsSliderOpen(true)}
                      className="w-16 h-8 text-center"
                      min="1"
                      max="100"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-12 p-2" side="top" align="center">
                    <div className="flex flex-col items-center gap-2">
                      <Slider
                        value={[percent]}
                        onValueChange={(value) => setPercent(value[0])}
                        max={100}
                        min={1}
                        step={1}
                        orientation="vertical"
                        className="h-32"
                      />
                      <span className="text-xs text-muted-foreground">{percent}%</span>
                    </div>
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}
          </div>
        )}

        {/* Stats table - only show in distribution mode */}
        {mode === 'distribution' && stats.length > 0 && (
          <div className="mt-2">
            <div className="text-sm">
              <div className="grid grid-cols-[72px_minmax(0,1fr)_64px_64px] gap-1 font-semibold text-gray-500 px-1 border-b border-gray-200 pb-1 mb-1">
                <div className="text-left">Variation</div>
                <div className="text-center">LAB</div>
                <div className="text-center">{deType}</div>
                <div className="text-center" aria-hidden="true"></div>
              </div>
              {stats.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => {
                    const next = selectedStat === row.key ? null : row.key;
                    setSelectedStat(next);
                    if (next) {
                      // If row has a colorId (min/max), select that match
                      if (row.colorId) {
                        onSelectSimilar?.(row.colorId);
                      } else {
                        // For avg, clear selection
                        onSelectSimilar?.(null);
                      }
                    } else {
                      // Deselecting the stat row
                      onSelectSimilar?.(null);
                    }
                  }}
                  className={`w-full grid grid-cols-[72px_minmax(0,1fr)_64px_64px] gap-1 items-center px-1 py-1 rounded text-left transition-colors cursor-pointer hover:bg-muted ${selectedStat === row.key ? 'bg-blue-50' : ''}`}
                >
                  <div className="font-medium text-gray-800 whitespace-nowrap">{row.label}</div>
                  <div className="text-center text-sm text-gray-600 whitespace-nowrap">{row.labStr}</div>
                  <div className="text-center text-sm text-gray-600 whitespace-nowrap">{row.dE}</div>
                  <div className="flex justify-center items-center gap-0" title={`Master vs ${row.label}`}>
                    <div className="w-4 h-4 rounded-l-sm border border-gray-300" style={{ backgroundColor: masterHex }}></div>
                    <div className="w-4 h-4 rounded-r-sm -ml-px border border-gray-300" style={{ backgroundColor: row.hex }}></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="mt-auto pt-2 grid grid-cols-2 gap-2">
          <Button onClick={handleSave} disabled={!selectedSimilarId && !selectedStat}>
            <Save className="w-4 h-4 mr-2" /> Save New Color
          </Button>
          <Button onClick={handlePrint} disabled={!selectedSimilarId && !selectedStat} variant="secondary">
            <Printer className="w-4 h-4 mr-2" /> Print Color Card
          </Button>
        </div>
      </CardContent>

      <PrintColorCardPanel
        isOpen={isPrintPanelOpen}
        onClose={() => setIsPrintPanelOpen(false)}
        colorData={{
          name: selectedSampleColor?.name || `Match ${selectedSampleColor?.id?.slice(0,8)}`,
          spectral_data: selectedSampleColor?.spectral_data || 
                         selectedSampleColor?.matched_spectral_data ||
                         selectedSampleColor?.measurements?.[0]?.spectral_data,
          illuminant: selectedSampleColor?.illuminant || 'D50',
          observer: selectedSampleColor?.observer || '2'
        }}
      />
    </Card>
  );
};

export default SimilarAnalysisPanel;
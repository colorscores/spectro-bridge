import React, { useMemo, useState, memo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

const SpectralPlot = ({ data, multipleSpectra = null, selectedTintIndex = null }) => {
    const [viewMode, setViewMode] = useState('plot');
    const lastNonEmptyDataRef = useRef(null);
    
    
    // Handle multiple spectra for ink tints
    const chartData = useMemo(() => {
        console.log('SpectralPlot: Processing data', { data, multipleSpectra, hasData: !!data, dataKeys: data ? Object.keys(data) : [] });
        
        if (multipleSpectra && Array.isArray(multipleSpectra)) {
            // Create combined data for multiple spectra
            const wavelengths = new Set();

            // Collect all wavelengths from any known spectral field
            multipleSpectra.forEach((spectrum) => {
                const s = spectrum?.spectralData || spectrum?.spectral_data || spectrum?.spectral;
                if (s && typeof s === 'object') {
                    Object.keys(s).forEach((wl) => {
                        const clean = parseInt(String(wl).replace('nm', ''));
                        if (!Number.isNaN(clean)) wavelengths.add(clean);
                    });
                }
            });

            const sortedWavelengths = Array.from(wavelengths).sort((a, b) => a - b);

            const chartData = sortedWavelengths.map((wavelength) => {
                const dataPoint = { wavelength };

                multipleSpectra.forEach((spectrum, index) => {
                    const s = spectrum?.spectralData || spectrum?.spectral_data || spectrum?.spectral;
                    let value = null;
                    if (s) {
                        value = s[wavelength] ?? s[String(wavelength)] ?? s[`${wavelength}nm`] ?? null;
                    }
                    dataPoint[`tint_${index}`] = value != null ? parseFloat(value) : null;
                    dataPoint[`tint_${index}_info`] = spectrum;
                });

                return dataPoint;
            });

            return chartData;
        } else if (data && typeof data === 'object') {
            // Single spectrum - ensure we handle the data correctly
            console.log('SpectralPlot: Processing single spectrum', { sampleEntries: Object.entries(data).slice(0, 5) });
            
            const result = Object.entries(data)
                .map(([wavelength, value]) => {
                    const wl = parseInt(String(wavelength).replace('nm', ''));
                    const refl = parseFloat(value);
                    if (isNaN(wl) || isNaN(refl)) {
                        console.warn('SpectralPlot: Invalid data point', { wavelength, value, parsedWl: wl, parsedRefl: refl });
                        return null;
                    }
                    return {
                        wavelength: wl,
                        reflectance: refl,
                    };
                })
                .filter(point => point !== null) // Remove invalid points
                .sort((a, b) => a.wavelength - b.wavelength);
                
            console.log('SpectralPlot: Processed result', { 
                length: result.length, 
                firstPoint: result[0], 
                lastPoint: result[result.length - 1],
                sampleValues: result.slice(0, 3).map(p => p.reflectance)
            });
            
            return result;
        }

        console.log('SpectralPlot: No valid data found');
        return [];
    }, [data, multipleSpectra]);
    
    // Generate colors based on tint color or fallback to distributed colors
    const getTintColor = (index, tintInfo, isSelected = false) => {
        if (isSelected) return '#ef4444'; // Red for selected
        
        // Use actual tint color if available
        if (tintInfo?.color) {
            return tintInfo.color;
        }
        
        // Use Lab color if available
        if (tintInfo?.lab) {
            // Convert Lab to RGB for display (simplified approximation)
            const { L, a, b } = tintInfo.lab;
            // This is a very basic Lab to RGB conversion - you may want to use a proper color library
            const r = Math.max(0, Math.min(255, L * 2.55 + a * 1.28));
            const g = Math.max(0, Math.min(255, L * 2.55 - a * 0.64 - b * 0.32));
            const bValue = Math.max(0, Math.min(255, L * 2.55 - b * 1.28));
            return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bValue)})`;
        }
        
        // Fallback to distributed colors around color wheel
        const hue = (index * 30) % 360;
        const saturation = 70;
        const lightness = 45 + (index % 3) * 10;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };
    
    // Prepare table data for selected tint
    const tableData = useMemo(() => {
        if (multipleSpectra && selectedTintIndex !== null && multipleSpectra[selectedTintIndex]) {
            const selectedSpectrum = multipleSpectra[selectedTintIndex];
            const s = selectedSpectrum?.spectralData || selectedSpectrum?.spectral_data || selectedSpectrum?.spectral;
            if (s && typeof s === 'object') {
                return Object.entries(s)
                    .map(([wavelength, reflectance]) => ({
                        wavelength: parseInt(String(wavelength).replace('nm', '')),
                        reflectance: parseFloat(reflectance)
                    }))
                    .sort((a, b) => a.wavelength - b.wavelength);
            }
        } else if (data) {
            return Object.entries(data)
                .map(([wavelength, reflectance]) => ({
                    wavelength: parseInt(String(wavelength).replace('nm', '')),
                    reflectance: parseFloat(reflectance)
                }))
                .sort((a, b) => a.wavelength - b.wavelength);
        }
        return [];
    }, [data, multipleSpectra, selectedTintIndex]);
    
    // Use stable key to prevent chart blanking - remove changing keys completely
    const dataKey = useMemo(() => {
        if (multipleSpectra && Array.isArray(multipleSpectra)) {
            return 'multi-spectra';
        }
        return 'single-spectra';
    }, [!!multipleSpectra]);

    // Determine if there is any spectral value to render
    const hasAnyValues = useMemo(() => {
        if (!chartData || chartData.length === 0) return false;
        if (multipleSpectra) {
            return chartData.some((dp) =>
                Object.keys(dp).some((k) => k.startsWith('tint_') && !k.endsWith('_info') && dp[k] != null)
            );
        }
        return chartData.some((dp) => dp.reflectance != null);
    }, [chartData, multipleSpectra]);

    // For smooth animations, use display data that doesn't reset during transitions
    const displayData = useMemo(() => {
        if (hasAnyValues && chartData.length > 0) {
            lastNonEmptyDataRef.current = chartData;
            return chartData;
        }
        // Return last valid data if current data is empty/loading
        return lastNonEmptyDataRef.current || chartData;
    }, [chartData, hasAnyValues]);
    
    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 h-16 flex-shrink-0">
                <CardTitle className="text-lg">Spectral Data</CardTitle>
                <Select value={viewMode} onValueChange={setViewMode}>
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="plot">Plot</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="flex-1 p-1 overflow-hidden">
                {viewMode === 'plot' ? (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                            data={displayData} 
                            margin={{ top: 5, right: 30, left: 30, bottom: 35 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis 
                                dataKey="wavelength" 
                                unit="nm" 
                                tick={{ fontSize: 12 }} 
                                label={{ value: 'Wavelength (nm)', position: 'insideBottom', offset: -10, fontSize: 12 }}
                                height={30}
                            />
                            <YAxis 
                                tick={{ fontSize: 12 }} 
                                domain={[0, 1]} 
                                label={{ value: '%R (or %T)', angle: -90, position: 'insideLeft', offset: -5, textAnchor: 'middle', style: { textAnchor: 'middle' }, fontSize: 12 }}
                                width={50}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (!active || !payload || !payload.length) return null;
                                    
                                    return (
                                        <div className="bg-white border border-gray-300 rounded px-3 py-2 shadow-lg text-xs text-gray-600">
                                            <div className="mb-1 font-medium">{label} nm</div>
                                            {payload.map((entry, index) => {
                                                if (entry.value == null) return null;
                                                
                                                let displayName = 'Reflectance';
                                                
                                                if (multipleSpectra) {
                                                    const tintIndex = parseInt(entry.dataKey.split('_')[1]);
                                                    const tintInfo = entry.payload[`tint_${tintIndex}_info`];
                                                    
                                                    // Handle tint percentage with proper validation
                                                    const percentage = tintInfo?.tintPercentage;
                                                    if (percentage !== undefined && percentage !== null && Number.isFinite(Number(percentage))) {
                                                        const validPercentage = Number(percentage);
                                                        displayName = validPercentage === 0 ? 'Substrate' : `${validPercentage}%`;
                                                    } else {
                                                        displayName = tintInfo?.name || `Tint ${tintIndex + 1}`;
                                                    }
                                                }
                                                
                                                return (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <div 
                                                            className="w-3 h-3 rounded-sm" 
                                                            style={{ backgroundColor: entry.color }}
                                                        />
                                                        <span>{displayName}: {entry.value.toFixed(6)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }}
                            />
                            
                            {multipleSpectra ? (
                                // Render multiple lines for tints
                                multipleSpectra.map((spectrum, index) => (
                                    <Line 
                                        key={index}
                                        type="monotone" 
                                        dataKey={`tint_${index}`} 
                                        stroke={getTintColor(index, spectrum, selectedTintIndex === index)}
                                        strokeWidth={selectedTintIndex === index ? 3 : 2}
                                        dot={false}
                                        isAnimationActive={true}
                                        animationDuration={800}
                                        animationBegin={index * 100} // Stagger animations
                                        animationEasing="ease-out"
                                        connectNulls={false}
                                        name={spectrum.name || `Tint ${index + 1}`}
                                    />
                                ))
                            ) : (
                                // Single line (original behavior)
                                <Line 
                                    type="monotone" 
                                    dataKey="reflectance" 
                                    stroke="#0ea5e9" 
                                    strokeWidth={2} 
                                    dot={false}
                                    isAnimationActive={true}
                                    animationDuration={1200}
                                    animationBegin={0}
                                    animationEasing="ease-out"
                                    connectNulls={false}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                    </div>
                ) : (
                    // Spectral List View
                    <div className="h-64 border rounded-md bg-background overflow-hidden">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background">
                                    <TableRow>
                                        <TableHead className="text-center text-sm font-medium">Wavelength (nm)</TableHead>
                                        <TableHead className="text-center text-sm font-medium">Reflectance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tableData.map((row, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="text-center text-sm">{row.wavelength}</TableCell>
                                            <TableCell className="text-center text-sm">{typeof row.reflectance === 'number' ? row.reflectance.toFixed(6) : row.reflectance}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default memo(SpectralPlot);
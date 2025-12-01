import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const ColorInfoItem = ({ label, value }) => (
    <div className="flex flex-col items-center space-y-1">
        <Label className="text-gray-600 text-sm font-medium">{label}</Label>
        <div className="bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm text-center min-w-[80px] h-10 flex items-center justify-center">
            {value !== null && value !== undefined ? value : ''}
        </div>
    </div>
);

const ColorInfoPanelHorizontal = ({ lab, ch, colorHex, showComparison = false, importLab, importCh, importColorHex }) => {
    // Calculate C* and h* if ch is missing but lab is available
    const calculatedCh = ch || (lab ? {
        C: Math.sqrt(lab.a * lab.a + lab.b * lab.b),
        h: (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360
    } : null);

    const calculatedImportCh = importCh || (importLab ? {
        C: Math.sqrt(importLab.a * importLab.a + importLab.b * importLab.b),
        h: (Math.atan2(importLab.b, importLab.a) * 180 / Math.PI + 360) % 360
    } : null);

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Color Information</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
                {showComparison ? (
                    <div className="space-y-4 pb-4">
                        {/* Import color values row */}
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground mb-2 block">Import color values</Label>
                            <div className="flex justify-around items-center space-x-4">
                                <ColorInfoItem label="L*" value={importLab?.L?.toFixed(2)} />
                                <ColorInfoItem label="a*" value={importLab?.a?.toFixed(2)} />
                                <ColorInfoItem label="b*" value={importLab?.b?.toFixed(2)} />
                                <ColorInfoItem label="C*" value={calculatedImportCh?.C?.toFixed(2)} />
                                <ColorInfoItem label="h*" value={calculatedImportCh?.h?.toFixed(2)} />
                                <div className="flex flex-col items-center space-y-1">
                                    <Label className="text-gray-600 text-sm font-medium">Color</Label>
                                    <div 
                                        className="w-10 h-10 rounded border border-gray-300"
                                        style={{ backgroundColor: importColorHex || '#f3f4f6' }}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Adapted color values row */}
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground mb-2 block">Adapted color values</Label>
                            <div className="flex justify-around items-center space-x-4">
                                <ColorInfoItem label="L*" value={lab?.L?.toFixed(2)} />
                                <ColorInfoItem label="a*" value={lab?.a?.toFixed(2)} />
                                <ColorInfoItem label="b*" value={lab?.b?.toFixed(2)} />
                                <ColorInfoItem label="C*" value={calculatedCh?.C?.toFixed(2)} />
                                <ColorInfoItem label="h*" value={calculatedCh?.h?.toFixed(2)} />
                                <div className="flex flex-col items-center space-y-1">
                                    <Label className="text-gray-600 text-sm font-medium">Color</Label>
                                    <div 
                                        className="w-10 h-10 rounded border border-gray-300"
                                        style={{ backgroundColor: colorHex || '#f3f4f6' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-around items-center space-x-4 pb-4">
                        <ColorInfoItem label="L*" value={lab?.L?.toFixed(2)} />
                        <ColorInfoItem label="a*" value={lab?.a?.toFixed(2)} />
                        <ColorInfoItem label="b*" value={lab?.b?.toFixed(2)} />
                        <ColorInfoItem label="C*" value={calculatedCh?.C?.toFixed(2)} />
                        <ColorInfoItem label="h*" value={calculatedCh?.h?.toFixed(2)} />
                        <div className="flex flex-col items-center space-y-1">
                            <Label className="text-gray-600 text-sm font-medium">Color</Label>
                            <div 
                                className="w-10 h-10 rounded border border-gray-300"
                                style={{ backgroundColor: colorHex || '#f3f4f6' }}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ColorInfoPanelHorizontal;
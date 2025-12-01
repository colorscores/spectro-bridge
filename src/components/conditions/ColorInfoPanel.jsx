import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ColorInfoItem = ({ label, value }) => {
  const displayValue = (value !== null && value !== undefined) ? Number(value).toFixed(2) : '—';
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
        <Label className="text-gray-600 text-sm font-medium">{label}</Label>
        <div className="bg-gray-50 border border-gray-300 rounded px-3 py-1 text-sm text-center min-w-[80px]">
            {displayValue}
        </div>
    </div>
  );
};

const ColorInfoPanel = ({ lab, ch }) => {
    // Debug: verify incoming values update
    console.debug('ColorInfoPanel debug', { lab, ch });
    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 h-16">
                <CardTitle className="text-lg whitespace-nowrap">Color Info</CardTitle>
                <div className="w-40"></div>
            </CardHeader>
            <CardContent className="space-y-1">
                <ColorInfoItem label="L*" value={lab?.L} />
                <ColorInfoItem label="a*" value={lab?.a} />
                <ColorInfoItem label="b*" value={lab?.b} />
                <ColorInfoItem label="C*" value={ch?.C} />
                <ColorInfoItem label="h*" value={ch?.h} />
            </CardContent>
        </Card>
    );
};

export default ColorInfoPanel;
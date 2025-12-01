import React from 'react';
import { UploadCloud } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ColorPanel = ({ title, color, isMaster = false }) => (
  <Card className={`flex flex-col overflow-hidden ${isMaster ? 'rounded-r-none' : 'rounded-l-none'}`}>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="flex-grow flex flex-col justify-between p-0">
      <div className="flex-grow p-6 flex flex-col justify-between" style={{ backgroundColor: color.hex }}>
        <div>
          <p className="font-bold text-lg text-white text-shadow-sm">{color.matchName || color.name}</p>
          {isMaster ? (
            <p className="font-medium text-white text-shadow-sm">{color.quality}</p>
          ) : (
            <p className="font-medium text-white text-shadow-sm">{color.name}</p>
          )}
        </div>
        <p className="text-white text-shadow-sm self-end">
          {color.lab ? `Lab: ${color.lab.L}, ${color.lab.a}, ${color.lab.b}` : ''}
        </p>
      </div>
    </CardContent>
  </Card>
);

const EmptyMatchPanel = ({ onImportClick }) => (
  <Card className="flex flex-col overflow-hidden rounded-l-none">
    <CardHeader>
      <CardTitle>Match</CardTitle>
    </CardHeader>
    <CardContent className="flex-grow flex flex-col justify-between p-0">
      <div className="p-6 h-full">
        <div
          className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg text-center p-8 cursor-pointer hover:border-blue-500 hover:bg-gray-50 transition-colors"
          onClick={onImportClick}
        >
          <UploadCloud className="h-12 w-12 text-gray-400 mb-4" />
          <p className="font-medium text-gray-600">Drag and drop your match result here</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const ColorComparison = ({ masterColor, matchedColor, onImportClick }) => {
  return (
    <div className="grid grid-cols-2 flex-grow">
      <ColorPanel title="Reference" color={masterColor} isMaster />
      {matchedColor ? (
        <ColorPanel title="Match" color={matchedColor} />
      ) : (
        <EmptyMatchPanel onImportClick={onImportClick} />
      )}
    </div>
  );
};

export default ColorComparison;
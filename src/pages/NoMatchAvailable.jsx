import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileX } from 'lucide-react';

const NoMatchAvailable = ({ colorName }) => {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <FileX className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle>No Match Available</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            No measurement data is available for {colorName || 'this color'}.
          </p>
          <p className="text-sm text-muted-foreground">
            Import measurement data or create a new match to see color analysis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NoMatchAvailable;
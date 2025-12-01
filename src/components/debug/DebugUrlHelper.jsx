import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink } from 'lucide-react';
import { isSimilarDebugEnabled } from '@/lib/similarDebug';

const DebugUrlHelper = () => {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    setDebugEnabled(isSimilarDebugEnabled());
    setCurrentUrl(window.location.href);
  }, []);

  const enableDebugUrl = () => {
    const url = new URL(window.location);
    url.searchParams.set('similarDebug', 'true');
    window.__SIMILAR_DEBUG__ = true; // Force enable immediately
    return url.href;
  };

  const handleEnableDebug = () => {
    window.__SIMILAR_DEBUG__ = true;
    setDebugEnabled(true);
    window.location.reload(); // Reload to trigger calculations with debug enabled
  };

  const copyDebugUrl = () => {
    navigator.clipboard.writeText(enableDebugUrl());
  };

  const forceEnableDebug = () => {
    window.__SIMILAR_DEBUG__ = true;
    setDebugEnabled(true);
    console.log('[SimilarDebug] Force enabled - refresh page to see detailed logs');
  };

  if (debugEnabled) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Debug Mode</CardTitle>
            <Badge variant="outline" className="bg-green-100 text-green-800">Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-green-700">
            SimilarDebug logging is enabled. Check console for detailed [SimilarDebug] messages.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-orange-50 border-orange-200">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Debug Mode</CardTitle>
          <Badge variant="outline" className="bg-orange-100 text-orange-800">Disabled</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <p className="text-xs text-orange-700">
          Enable debug logging to see detailed ASTM E308 calculation steps.
        </p>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={forceEnableDebug}
            className="text-xs"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Enable Now
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleEnableDebug}
            className="text-xs"
          >
            Enable & Reload
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={copyDebugUrl}
            className="text-xs"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy URL
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugUrlHelper;
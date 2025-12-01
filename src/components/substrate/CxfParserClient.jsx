import React, { useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { cxfParser } from '@/lib/cxfParser';

const CxfParserClient = ({ onDataUpdate, onDialogOpen, onColorsUpdate }) => {
  // Local, hook-free implementation to avoid dispatcher issues
  const cxfInputRef = useRef(null);
  const [isCxfLoading, setIsCxfLoading] = useState(false);
  const [cxfColors, setCxfColors] = useState([]);

  const handleCxfImportClick = () => {
    cxfInputRef.current?.click?.();
  };

  const clearParsedColors = () => setCxfColors([]);

  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });

  // Handle CxF file selection
  const handleCxfFileChangeWrapper = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    setIsCxfLoading(true);
    try {
      const xmlContent = await readFileAsText(file);
      const parseResult = cxfParser.parse(xmlContent, { astmTables: [], orgDefaults: {} });
      const colors = parseResult?.colors || parseResult || [];

      setCxfColors(colors);
      onColorsUpdate?.(colors);

      if (colors.length > 0) {
        // Always show selection dialog, even for single objects
        onDialogOpen?.(true);
      } else {
        toast({ title: 'Parse error', description: 'No colors found in CxF file.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('CxF parse error:', error);
      toast({
        title: 'Error Parsing CXF File',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCxfLoading(false);
      if (event?.target) event.target.value = '';
    }
  };

  return (
    <>
      <input
        type="file"
        ref={cxfInputRef}
        accept=".cxf,.CXF"
        onChange={handleCxfFileChangeWrapper}
        style={{ display: 'none' }}
      />
      {/* Export the functions and state for parent component */}
      {React.createElement('div', {
        ref: (el) => {
          if (el && el.parentElement) {
            el.parentElement._cxfParser = {
              handleCxfImportClick,
              isCxfLoading,
              cxfColors,
              clearParsedColors,
            };
          }
        },
        style: { display: 'none' },
      })}
    </>
  );
};

export default CxfParserClient;
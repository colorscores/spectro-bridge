import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import ColorCard from '@/components/ColorCard';

const ApprovedColors = ({ colors, selectedImageName }) => {
  const exportApprovedColors = () => {
    if (colors.length === 0) {
      toast({
        title: "No colors to export! 📭",
        description: "Please approve some colors first."
      });
      return;
    }

    const colorData = {
      projectName: selectedImageName || 'Color Palette',
      exportDate: new Date().toISOString(),
      approvedColors: colors.map(color => ({
        name: color.name || 'Untitled',
        hex: color.hex,
        rgb: color.rgb,
        library: color.library || 'Extracted',
        spectral: color.spectral || 'N/A'
      }))
    };

    const dataStr = JSON.stringify(colorData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `approved-colors-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    toast({
      title: "Colors exported! 📥",
      description: `${colors.length} approved colors downloaded as JSON.`
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-white rounded-lg p-6 border border-gray-200"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <Check className="mr-2 h-6 w-6 text-green-500" />
          Approved Colors ({colors.length})
        </h2>
        {colors.length > 0 && (
          <Button
            onClick={exportApprovedColors}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        )}
      </div>
      
      {colors.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Check className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Your approved colors will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          <AnimatePresence>
            {colors.map((color) => (
              <ColorCard key={color.id} color={color} variant="approved" />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default ApprovedColors;
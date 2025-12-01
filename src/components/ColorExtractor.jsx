import React from 'react';
import { motion } from 'framer-motion';
import { Palette, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ColorExtractor = ({ selectedImage, extractedColors, onApprove, onReject }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white rounded-lg p-6 border border-gray-200 h-full"
    >
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <Palette className="mr-2 h-6 w-6" />
        Color Extraction
      </h2>
      
      {!selectedImage ? (
        <div className="text-center py-12 text-gray-400 flex flex-col items-center justify-center h-full">
          <Palette className="mx-auto h-16 w-16 mb-4 opacity-30" />
          <p>Select an image to extract its dominant colors.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative rounded-md overflow-hidden">
            <img
              src={selectedImage.url}
              alt={selectedImage.name}
              className="w-full h-40 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-2 left-3">
              <p className="text-white font-medium text-sm">{selectedImage.name}</p>
            </div>
          </div>

          {extractedColors.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Extracted Colors</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-9 gap-3">
                {extractedColors.map((color) => (
                  <motion.div
                    key={color.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    layout
                    className="bg-white rounded-md p-2 border border-gray-200 flex flex-col"
                  >
                    <div
                      className="w-full h-12 rounded-sm mb-2 border border-gray-200"
                      style={{ backgroundColor: color.hex }}
                    />
                    <p className="text-gray-700 text-xs font-mono text-center mb-2 flex-grow">
                      {color.hex}
                    </p>
                    <div className="flex gap-1 justify-center">
                      <Button
                        onClick={() => onApprove(color.id)}
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white p-1 h-auto"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => onReject(color.id)}
                        size="sm"
                        variant="destructive"
                        className="flex-1 p-1 h-auto"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ColorExtractor;
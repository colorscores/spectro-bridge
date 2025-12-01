import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ImageUploader = ({ onFileUpload }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      onFileUpload(files);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
      className="bg-white rounded-lg p-6 border border-gray-200 h-full flex flex-col justify-center"
    >
      <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Upload Your Images</h2>
      <div className="flex flex-col items-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/*"
          className="hidden"
        />
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-base rounded-md shadow-sm hover:shadow-md transition-all duration-300"
          size="lg"
        >
          <Upload className="mr-2 h-5 w-5" />
          Upload Images
        </Button>
        
        <p className="text-gray-500 mt-3 text-sm">
          Or drop files here. Supports JPG, PNG, GIF.
        </p>
      </div>
    </motion.div>
  );
};

export default ImageUploader;
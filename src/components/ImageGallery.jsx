import React from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Eye } from 'lucide-react';

const ImageGallery = ({ images, selectedImage, onImageSelect }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-lg p-6 border border-gray-200 h-full"
    >
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <ImageIcon className="mr-2 h-6 w-6" />
        Image Gallery
      </h2>
      
      {images.length === 0 ? (
        <div className="text-center py-12 text-gray-400 flex flex-col items-center justify-center h-full">
          <ImageIcon className="mx-auto h-16 w-16 mb-4 opacity-30" />
          <p>No images uploaded yet.</p>
          <p className="text-sm">Your images will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[450px] overflow-y-auto pr-2">
          {images.map((image) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.03 }}
              layout
              className={`relative cursor-pointer rounded-md overflow-hidden border-2 transition-all duration-300 ${
                selectedImage?.id === image.id 
                  ? 'border-blue-500 shadow-md shadow-blue-500/20' 
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              onClick={() => onImageSelect(image)}
            >
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-32 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-white text-xs font-medium truncate">
                  {image.name}
                </p>
                <p className="text-gray-200 text-xs">
                  {image.uploadDate}
                </p>
              </div>
              {selectedImage?.id === image.id && (
                <motion.div 
                  initial={{opacity: 0, scale: 0.5}}
                  animate={{opacity: 1, scale: 1}}
                  className="absolute top-2 right-2 p-1 bg-blue-500 rounded-full"
                >
                  <Eye className="h-4 w-4 text-white" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ImageGallery;
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Puzzle } from 'lucide-react';

const Integrations = () => {
  return (
    <>
      <Helmet>
        <title>Integrations - Spectral Color Tool</title>
        <meta name="description" content="Manage integrations." />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="text-gray-900 px-6 pt-6 space-y-6"
      >
        <div className="flex items-center">
          <Puzzle className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 ml-3">
            Integrations
          </h1>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">Integrations management will be displayed here.</p>
          <p className="text-sm text-gray-400 mt-2">This feature is under construction.</p>
        </div>
      </motion.div>
    </>
  );
};

export default Integrations;
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Breadcrumb from '@/components/Breadcrumb';

const Profiles = () => {
  return (
    <>
      <Helmet>
        <title>Profiles - Spectral Color Tool</title>
        <meta name="description" content="Manage profiles." />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="text-gray-900"
      >
        <Breadcrumb />
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">Profiles management will be displayed here.</p>
          <p className="text-sm text-gray-400 mt-2">This feature is under construction.</p>
        </div>
      </motion.div>
    </>
  );
};

export default Profiles;
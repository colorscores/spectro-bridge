import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';

const MyCompany = () => {
  return (
    <>
      <Helmet>
        <title>My Company - Spectral</title>
        <meta name="description" content="Manage your company information." />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="p-6 sm:p-8 lg:p-10 space-y-6"
      >
        <h1 className="text-4xl text-gray-800">My Company</h1>
      </motion.div>
    </>
  );
};

export default MyCompany;
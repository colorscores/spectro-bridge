import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const PrintConditionsHeader = () => {
  const navigate = useNavigate();

  const handleNewCondition = () => {
    navigate('/print-conditions/new');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className="flex items-center justify-between mb-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Print Conditions</h1>
      </div>
      <Button onClick={handleNewCondition} className="bg-blue-600 hover:bg-blue-700 text-white">
        <Plus className="mr-2 h-4 w-4" />
        New Print Condition
      </Button>
    </motion.div>
  );
};

export default PrintConditionsHeader;
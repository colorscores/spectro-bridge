import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Edit2, Check, X, Loader2 } from 'lucide-react';


const MyCompanyHeader = ({ 
  organization, 
  locations, 
  isEditing, 
  canSave, 
  saving, 
  onEdit, 
  onCancel, 
  onSave,
  title = "My Company",
  description = "Manage your organization's details, locations, and tags."
}) => {
  

  return (
    <>
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">{title}</h1>
          <p className="text-gray-500 mt-1">{description}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button variant="default" onClick={onEdit}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={onCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={onSave} disabled={!canSave || saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default MyCompanyHeader;
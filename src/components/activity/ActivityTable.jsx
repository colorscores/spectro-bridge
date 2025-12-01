import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Table, TableBody } from '@/components/ui/table';
import ActivityTableHeader from '@/components/activity/ActivityTableHeader';
import ActivityTableRow from '@/components/activity/ActivityTableRow';

const ActivityTable = ({ activities, loading, error }) => {
  const [sortConfig, setSortConfig] = useState(null);

  const sortedActivities = useMemo(() => {
    if (!sortConfig || !activities) return activities;
    
    const sorted = [...activities].sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [activities, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="space-y-4">
          <div className="text-center py-8 text-muted-foreground">
            Loading activity...
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="space-y-4">
          <div className="text-center py-8 text-red-600">
            Error loading activity: {error.message}
          </div>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <div className="space-y-4">
        <div className="overflow-auto">
          <Table>
            <ActivityTableHeader sortConfig={sortConfig} onSort={handleSort} />
            <TableBody>
              {sortedActivities && sortedActivities.length > 0 ? (
                sortedActivities.map((activity, index) => (
                  <ActivityTableRow key={index} activity={activity} />
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-muted-foreground">
                    No activity to display.
                  </td>
                </tr>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </motion.div>
  );
};

export default ActivityTable;
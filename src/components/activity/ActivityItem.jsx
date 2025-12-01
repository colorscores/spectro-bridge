import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
    },
  },
};

const ActivityItem = ({ activity }) => {
  const { toast } = useToast();

  const handleViewDetails = () => {
    toast({
      title: "🚧 Feature in progress",
      description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <motion.div
      variants={itemVariants}
      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
            {activity.user.avatar}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-gray-800">
            <span className="font-semibold">{activity.user.name}</span> {activity.action}{' '}
            {activity.target && <span className="font-semibold">{activity.target}</span>}
          </p>
          <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleViewDetails}>
        View Details
      </Button>
    </motion.div>
  );
};

export default ActivityItem;
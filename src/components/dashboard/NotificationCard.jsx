import React from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const ConnectionRequestCard = ({ notification }) => {
  

  const handleAction = () => {
    toast({
      title: "🚧 Feature Not Implemented",
      description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center space-x-6">
      <div className="flex-shrink-0">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
          <Users className="w-8 h-8 text-blue-500" />
        </div>
      </div>
      <div className="flex-grow">
        <h3 className="font-semibold text-gray-800">New Connection Request From: {notification.from}</h3>
        <p className="text-sm text-gray-600 mt-1">{notification.details}</p>
        <p className="text-xs text-gray-400 mt-2">{notification.subtext}</p>
      </div>
      <div className="flex items-center space-x-3 flex-shrink-0">
        <Select onValueChange={handleAction}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select your location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new-york">New York</SelectItem>
            <SelectItem value="london">London</SelectItem>
            <SelectItem value="tokyo">Tokyo</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="destructive" className="bg-red-600 hover:bg-red-700" onClick={handleAction}>Decline</Button>
        <Button variant="secondary" onClick={handleAction}>Approve</Button>
      </div>
    </div>
  );
};

const NotificationCard = ({ notification }) => {
  switch (notification.type) {
    case 'connectionRequest':
      return <ConnectionRequestCard notification={notification} />;
    default:
      return null;
  }
};

export default NotificationCard;
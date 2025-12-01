import React from 'react';
import { Clock, CheckCircle, XCircle, Send, RotateCcw, Forward } from 'lucide-react';

const StatusIcon = ({ iconType, className = "h-4 w-4 mr-2" }) => {
  const iconMap = {
    Clock: Clock,
    CheckCircle: CheckCircle,
    XCircle: XCircle,
    Send: Send,
    RotateCcw: RotateCcw,
    Forward: Forward,
  };

  const IconComponent = iconMap[iconType];
  
  if (!IconComponent) {
    return <Clock className={className} />;
  }

  return <IconComponent className={className} />;
};

export default StatusIcon;
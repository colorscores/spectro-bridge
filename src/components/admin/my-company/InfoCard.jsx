import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const InfoCard = ({ icon: Icon, title, subtitle, value, titleClassName, valueClassName }) => (
  <Card className="bg-white shadow-none border-gray-200/80 w-full flex-grow">
    <CardContent className="p-4 flex items-center space-x-4">
      <div className="bg-blue-50 p-3 rounded-lg">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
      <div>
        <p className={cn("text-sm font-semibold text-gray-500", titleClassName)}>{title}</p>
        <p className={cn("text-lg font-bold text-gray-800 truncate", valueClassName)}>{value || subtitle}</p>
      </div>
    </CardContent>
  </Card>
);

export default InfoCard;

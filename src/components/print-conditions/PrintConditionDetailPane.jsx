import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const PrintConditionDetailPane = ({ condition, onClose }) => {
  if (!condition) return null;

  return (
    <div className="w-80 border-l bg-white flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Print Condition Details</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Name</label>
              <p className="text-sm text-gray-900">{condition.name}</p>
            </div>
            
            {condition.print_process && (
              <div>
                <label className="text-sm font-medium text-gray-500">Print Process</label>
                <div className="mt-1">
                  <Badge variant="outline">{condition.print_process}</Badge>
                </div>
              </div>
            )}
            
            {condition.pack_type && (
              <div>
                <label className="text-sm font-medium text-gray-500">Pack Type</label>
                <div className="mt-1">
                  <Badge variant="secondary">{condition.pack_type}</Badge>
                </div>
              </div>
            )}
            
            {condition.description && (
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="text-sm text-gray-900">{condition.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {condition.color_hex && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Color</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                <div 
                  className="w-12 h-12 rounded-md border"
                  style={{ backgroundColor: condition.color_hex }}
                />
                <div>
                  <p className="text-sm font-medium">{condition.color_hex}</p>
                  {condition.lab && (
                    <p className="text-xs text-gray-500">
                      L*: {condition.lab.L?.toFixed(2)} a*: {condition.lab.a?.toFixed(2)} b*: {condition.lab.b?.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium text-gray-500">Created</label>
              <p className="text-sm text-gray-900">
                {format(new Date(condition.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Last Modified</label>
              <p className="text-sm text-gray-900">
                {format(new Date(condition.updated_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrintConditionDetailPane;
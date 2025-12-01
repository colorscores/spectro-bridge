import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PrinterConditionsTab = ({ printerId }) => {
  const navigate = useNavigate();
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now
    const mockConditions = [
      {
        id: 'condition-1',
        name: 'Standard Print Condition',
        pack_type: 'Flexible',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-20T14:45:00Z'
      },
      {
        id: 'condition-2',
        name: 'High Quality Setting',
        pack_type: 'Rigid',
        created_at: '2024-01-18T09:15:00Z',
        updated_at: '2024-01-22T11:20:00Z'
      }
    ];
    
    console.log('🔍 Navigating to printer condition detail:', printerId, 'condition:', mockConditions);
    
    setTimeout(() => {
      setConditions(mockConditions);
      setLoading(false);
    }, 500);
  }, [printerId]);

  const handleAddCondition = () => {
    navigate(`/assets/printers/${printerId}/conditions/new`);
  };

  const handleViewCondition = (conditionId) => {
    console.log('🔍 handleViewCondition called with:', { printerId, conditionId });
    const targetUrl = `/assets/printers/${printerId}/conditions/${conditionId}`;
    console.log('🔍 Navigating to:', targetUrl);
    navigate(targetUrl);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading conditions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Printer Conditions</CardTitle>
          <Button onClick={handleAddCondition} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Condition
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {conditions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No printer conditions found.</p>
            <Button onClick={handleAddCondition} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create First Condition
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Pack Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditions.map((condition) => (
                <TableRow 
                  key={condition.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewCondition(condition.id)}
                >
                  <TableCell className="font-medium">{condition.name}</TableCell>
                  <TableCell>{condition.pack_type || '-'}</TableCell>
                  <TableCell>{new Date(condition.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(condition.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        console.log('🔍 View button clicked for condition:', condition.id);
                        handleViewCondition(condition.id);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PrinterConditionsTab;
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const TableHeaderButton = ({ children, className = "" }) => (
  <div className={cn("text-muted-foreground font-semibold", className)}>
    {children}
  </div>
);

const SubstrateConditionsTab = ({ substrateId }) => {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();

  const fetchConditions = useCallback(async () => {
    setLoading(true);
    if (!substrateId) {
      console.warn('SubstrateConditionsTab: No substrateId provided');
      setConditions([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('substrate_conditions')
        .select('*')
        .eq('substrate_id', substrateId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching substrate conditions:', error);
        toast({
          title: 'Error',
          description: 'Could not fetch conditions. ' + error.message,
          variant: 'destructive',
        });
        setConditions([]);
      } else {
        setConditions(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching substrate conditions:', err);
      toast({
        title: 'Error',
        description: 'Could not fetch conditions. ' + (err?.message || 'Unknown error'),
        variant: 'destructive',
      });
      setConditions([]);
    } finally {
      setLoading(false);
    }
  }, [substrateId, toast]);

  useEffect(() => {
    fetchConditions();
  }, [fetchConditions]);

  const handleRowClick = (conditionId) => {
    navigate(`/assets/substrates/${substrateId}/conditions/${conditionId}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Conditions</CardTitle>
        <Button asChild size="sm">
          <Link to={`/assets/substrates/${substrateId}/conditions/new`}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Condition
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-b-gray-200 hover:bg-transparent">
                <TableHead className="w-[50px] p-4" />
                <TableHead style={{ width: 'calc(50% - 50px)' }} className="p-4">
                  <TableHeaderButton>Name</TableHeaderButton>
                </TableHead>
                <TableHead style={{ width: '25%' }} className="p-4">
                  <TableHeaderButton>Pack Type</TableHeaderButton>
                </TableHead>
                <TableHead className="text-right p-4" style={{ width: '25%' }}>
                  <TableHeaderButton>Last Edited</TableHeaderButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditions.length > 0 ? (
                conditions.map((condition) => (
                  <TableRow
                    key={condition.id}
                    className="cursor-pointer group hover:bg-gray-50"
                    onClick={() => handleRowClick(condition.id)}
                  >
                    <TableCell className="w-[50px] p-4">
                      <div 
                        className="h-8 w-8 rounded-md border border-gray-200 flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: condition.color_hex || '#f3f4f6' }}
                      />
                    </TableCell>
                    <TableCell style={{ width: 'calc(50% - 50px)' }} className="p-4">
                      <span className="font-medium text-gray-800 truncate">{condition.name}</span>
                      {condition.description && (
                        <div className="text-sm text-gray-600 truncate mt-1">{condition.description}</div>
                      )}
                    </TableCell>
                    <TableCell style={{ width: '25%' }} className="p-4 text-gray-600">
                      {condition.pack_type && <Badge variant="secondary">{condition.pack_type}</Badge>}
                    </TableCell>
                    <TableCell className="text-right text-gray-500 p-4" style={{ width: '25%' }}>
                      {condition.updated_at ? format(new Date(condition.updated_at), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No conditions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default SubstrateConditionsTab;
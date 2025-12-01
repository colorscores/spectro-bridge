import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowUpDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import Breadcrumb from '@/components/Breadcrumb';
import { supabase } from '@/lib/customSupabaseClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import CenteredListToolbar from '@/components/common/CenteredListToolbar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import DeleteQualitySetsDialog from '@/components/quality-sets/DeleteQualitySetsDialog';
import { useProfile } from '@/context/ProfileContext';

const QualitySets = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [qualitySets, setQualitySets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchQualitySets = async () => {
    if (!profile?.organization_id) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('quality_sets')
      .select(`
        *,
        quality_rules (id),
        created_profile:profiles!created_by(full_name),
        edited_profile:profiles!last_edited_by(full_name)
      `)
      .eq('organization_id', profile.organization_id)
      .order('updated_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error fetching quality sets',
        description: error.message,
        variant: 'destructive',
      });
      console.error(error);
    } else {
      // Format the data to match expected structure
      const formattedData = data?.map(item => ({
        ...item,
        rules_summary: `${item.quality_rules?.length || 0} rule(s)`,
        editor_name: item.edited_profile?.full_name || item.created_profile?.full_name || 'Unknown'
      })) || [];
      setQualitySets(formattedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQualitySets();
  }, [profile?.organization_id]);

  const handleShowClick = (event, qualitySetId) => {
    event.stopPropagation();
    navigate(`/quality-sets/${qualitySetId}`);
  };

  const handleNewClick = () => {
    navigate('/quality-sets/new');
  };

  const handleDeleteClick = (event) => {
    event.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const handleQualitySetsDeleted = () => {
    setSelectedIds(new Set());
    fetchQualitySets();
  };

  const showToast = (event) => {
    event.stopPropagation();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };
  const filteredQualitySets = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();
    if (!term) return qualitySets;
    return (qualitySets || []).filter((q) =>
      [q.name, q.rules_summary, q.editor_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [qualitySets, searchTerm]);

  const allSelected = useMemo(() => (
    filteredQualitySets.length > 0 &&
    filteredQualitySets.every((q) => selectedIds.has(q.id))
  ), [filteredQualitySets, selectedIds]);

  return (
    <>
      <Helmet>
        <title>Quality Sets - Kontrol</title>
        <meta name="description" content="Manage quality sets and requirements for your match requests." />
      </Helmet>
      <div className="flex flex-col h-full px-6 pt-6 space-y-6">
        <Breadcrumb>
          <Button onClick={handleNewClick}>
            <Plus className="mr-2 h-4 w-4" /> New Quality Set
          </Button>
        </Breadcrumb>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 flex min-h-0 space-x-4"
        >
          <div className="flex-1 flex flex-col bg-white border border-border rounded-lg overflow-hidden">
            <CenteredListToolbar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Search quality sets..."
              leftChildren={
                <TooltipProvider>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Delete selected" onClick={handleDeleteClick} disabled={!selectedIds.size}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete selected</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="h-6" />
                  </div>
                </TooltipProvider>
              }
              rightChildren={<Button variant="outline" className="h-8" onClick={showToast}>Filter</Button>}
            />

            <div className="flex-1 overflow-auto">
              <div className="p-6">
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => {
                              const isChecked = Boolean(checked);
                              if (isChecked) {
                                setSelectedIds(new Set(filteredQualitySets.map((i) => i.id)));
                              } else {
                                setSelectedIds(new Set());
                              }
                            }}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead className="w-[250px]">
                          <Button variant="ghost" onClick={showToast}>
                            Set Name
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" onClick={showToast}>
                            Rules
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="w-[150px]">
                          <Button variant="ghost" onClick={showToast}>
                            Last Edited
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="w-[150px]">
                          <Button variant="ghost" onClick={showToast}>
                            Editor
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        ))
                      ) : (
                        filteredQualitySets.map((item) => (
                          <TableRow
                            key={item.id}
                            data-state={item.highlight ? 'selected' : undefined}
                            onClick={(e) => handleShowClick(e, item.id)}
                            className="cursor-pointer hover:bg-gray-50"
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(item.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(item.id);
                                    else next.delete(item.id);
                                    return next;
                                  });
                                }}
                                aria-label={`Select ${item.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.rules_summary}</TableCell>
                            <TableCell>{new Date(item.updated_at).toLocaleDateString()}</TableCell>
                            <TableCell>{item.editor_name}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        
        <DeleteQualitySetsDialog
          isOpen={isDeleteDialogOpen}
          setIsOpen={setIsDeleteDialogOpen}
          selectedQualitySetIds={Array.from(selectedIds)}
          onQualitySetsDeleted={handleQualitySetsDeleted}
        />
      </div>
    </>
  );
};

export default QualitySets;
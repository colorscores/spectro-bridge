import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { getDisplayHex } from '@/lib/colorUtils';

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-3 border-b border-gray-200">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-800 text-right">{value}</span>
  </div>
);

const ColorDetailPane = ({ color, onClose, onViewDetails }) => {
  const navigate = useNavigate();
  const [isAdditionalInfoOpen, setIsAdditionalInfoOpen] = useState(false);
  const [matchesCount, setMatchesCount] = useState(null);
  const [tagCategories, setTagCategories] = useState({});

  const handleViewDetails = React.useCallback(() => {
    navigate(`/colors/${color?.id}`);
    try { onViewDetails?.(color?.id); } catch {}
  }, [navigate, color?.id, onViewDetails]);

  useEffect(() => {
    if (!color?.id) return;
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('match_measurements')
        .select('id', { count: 'exact', head: true })
        .eq('color_id', color.id)
        .eq('status', 'Match Approved');
      if (!cancelled) setMatchesCount(error ? 0 : (count || 0));
    })();
    return () => { cancelled = true; };
  }, [color?.id]);

  useEffect(() => {
    const tags = color?.tags || [];
    const missing = tags.filter(t => !t?.category_name && !(t?.categories && t.categories.name) && t?.category_id);
    if (missing.length === 0) return;
    let cancelled = false;
    const ids = Array.from(new Set(missing.map(t => t.category_id)));
    (async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .in('id', ids);
      if (!cancelled && Array.isArray(data)) {
        const map = {};
        for (const c of data) map[c.id] = c.name;
        setTagCategories(prev => ({ ...prev, ...map }));
      }
    })();
    return () => { cancelled = true; };
  }, [color?.tags]);

  const [meta, setMeta] = useState({
    createdAt: color?.created_at || null,
    updatedAt: color?.updated_at || null,
    createdByName: null,
    lastEditedByName: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const needColorMeta = !color?.created_at || !color?.updated_at || !color?.created_by || !color?.last_edited_by;
        let createdAt = color?.created_at || null;
        let updatedAt = color?.updated_at || null;
        let createdBy = color?.created_by || null;
        let lastEditedBy = color?.last_edited_by || null;

        if (needColorMeta && color?.id) {
          const { data: row } = await supabase
            .from('colors')
            .select('created_at, updated_at, created_by, last_edited_by')
            .eq('id', color.id)
            .maybeSingle();
          if (row) {
            createdAt = createdAt || row.created_at || null;
            updatedAt = updatedAt || row.updated_at || null;
            createdBy = createdBy || row.created_by || null;
            lastEditedBy = lastEditedBy || row.last_edited_by || null;
          }
        }

        // Auto-backfill missing editor fields
        if (color?.id && (!createdBy || !lastEditedBy)) {
          console.log(`🔧 ColorDetailPane: Missing editor fields for color ${color.id}, attempting backfill...`);
          try {
            const { data: backfilled, error } = await supabase.rpc('backfill_color_editor_fields', {
              p_color_id: color.id
            });
            
            if (error) {
              console.warn('⚠️ ColorDetailPane: Backfill failed:', error);
            } else if (backfilled) {
              console.log('✅ ColorDetailPane: Editor fields backfilled, refetching color data...');
              // Refetch the color data after backfill
              const { data: refetched } = await supabase
                .from('colors')
                .select('created_at, updated_at, created_by, last_edited_by')
                .eq('id', color.id)
                .maybeSingle();
              if (refetched) {
                createdAt = refetched.created_at;
                updatedAt = refetched.updated_at;
                createdBy = refetched.created_by;
                lastEditedBy = refetched.last_edited_by;
              }
            }
          } catch (backfillError) {
            console.warn('⚠️ ColorDetailPane: Backfill exception:', backfillError);
          }
        }

        // Use existing names from color object if available
        let createdByName = color?.created_by_name || null;
        let lastEditedByName = color?.last_edited_by_name || null;
        
        // If not available, try RLS-safe join query
        if (!createdByName || !lastEditedByName) {
          const { data: colorWithProfiles } = await supabase
            .from('colors')
            .select(`
              created_by_profile:profiles!colors_created_by_fkey(full_name),
              last_edited_by_profile:profiles!colors_last_edited_by_fkey(full_name)
            `)
            .eq('id', color.id)
            .maybeSingle();
          
          if (colorWithProfiles) {
            createdByName = createdByName || colorWithProfiles.created_by_profile?.full_name || null;
            lastEditedByName = lastEditedByName || colorWithProfiles.last_edited_by_profile?.full_name || null;
          }
        }

        if (!cancelled) {
          setMeta({
            createdAt,
            updatedAt,
            createdByName,
            lastEditedByName,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setMeta(prev => ({ ...prev }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [color?.id, color?.created_at, color?.updated_at, color?.created_by, color?.last_edited_by]);

  if (!color) return null;

  const toggleAdditionalInfo = () => {
    setIsAdditionalInfoOpen(prev => !prev);
  };

  const formatDate = (d) => d ? format(new Date(d), 'MMM d, yyyy h:mm a') : 'N/A';

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 360, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-white z-10 shadow-xl flex-shrink-0 flex flex-col h-full rounded-lg border border-border overflow-hidden"
    >
      <div className="flex-shrink-0 h-20 p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 truncate pr-2">{color.name}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
          <X className="h-5 w-5 text-gray-500" />
        </Button>
      </div>
      <div className="flex-grow flex flex-col min-h-0">
        <ScrollArea className="flex-grow">
          <div className="p-4">
            <div 
                className="w-full h-32 rounded-lg mb-4 flex-shrink-0 border border-gray-200"
                style={{ backgroundColor: getDisplayHex(color) || '#E5E7EB' }}
             />
            <div className="space-y-1">
              <DetailRow label="Standard Type" value={color.standard_type ? (color.standard_type.charAt(0).toUpperCase() + color.standard_type.slice(1)) : 'N/A'} />
              <DetailRow label="Matches" value={matchesCount ?? 0} />
              <div className="flex justify-between items-start py-3 border-b border-gray-200">
                <span className="text-sm text-gray-500 pt-1">Tags</span>
                <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                  {color.tags && color.tags.length > 0 ? color.tags.map(tag => {
                    const categoryName = tag?.categories?.name || tag?.category_name || (tag?.category_id ? tagCategories[tag.category_id] : null);
                    const label = `${categoryName ? categoryName + ': ' : ''}${tag?.name || ''}`;
                    return (
                      <span key={tag.id || label} className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-md border border-gray-200">{label}</span>
                    );
                  }) : <span className="text-sm text-gray-500">No tags</span>}
                </div>
              </div>
              
              <div 
                className="flex justify-between items-center py-3 border-b border-gray-200 cursor-pointer"
                onClick={toggleAdditionalInfo}
              >
                <span className="text-sm text-gray-500">Additional Info</span>
                <motion.div
                  animate={{ rotate: isAdditionalInfoOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </motion.div>
              </div>

              <AnimatePresence initial={false}>
                {isAdditionalInfoOpen && (
                  <motion.div
                    key="additional-info"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pl-4 border-l-2 border-gray-200">
                      <DetailRow label="Created On" value={formatDate(meta.createdAt)} />
                      <DetailRow label="Created By" value={meta.createdByName || 'N/A'} />
                      <DetailRow label="Last Edited By" value={(meta.lastEditedByName || meta.createdByName) || 'N/A'} />
                      <DetailRow label="Last Edited" value={formatDate(meta.updatedAt)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <Link to={`/colors/${color?.id}`} className="block w-full">
            <Button 
              className="w-full"
              onClick={handleViewDetails}
            >
              View Details
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default ColorDetailPane;
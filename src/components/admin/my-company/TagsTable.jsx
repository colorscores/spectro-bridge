import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Pencil, PlusCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from 'react-hot-toast';

// Helper to validate UUID format
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const TagsTable = ({ tags, onEdit, onDelete, onAdd, showBelongsTo, parentCategoryName, onAssociationChange, editing = false, onEditComplete }) => {
  const [tagsWithParents, setTagsWithParents] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState(null);

  const fetchParentTags = useCallback(async () => {
    if (!tags || tags.length === 0) {
      setTagsWithParents([]);
      return;
    }

    // When not showing "Belongs To", just pass through with any pending display names
    if (!showBelongsTo) {
      setTagsWithParents(tags.map(t => ({
        ...t,
        parent_tags: t.displayParentTags || [],
        isPending: !!t.displayParentTags
      })));
      return;
    }

    try {
      const validTagIds = tags.filter(t => isUuid(t.id)).map(t => t.id);

      // No valid UUIDs -> fallback to local state only
      if (validTagIds.length === 0) {
        setTagsWithParents(tags.map(t => ({
          ...t,
          parent_tags: t.displayParentTags || [],
          isPending: !!t.displayParentTags
        })));
        return;
      }

      const { data: hierarchies, error } = await supabase
        .from('tag_hierarchies')
        .select('tag_id, parent_tag_id')
        .in('tag_id', validTagIds);

      if (error) throw error;

      const parentTagIds = [...new Set(hierarchies.map(h => h.parent_tag_id))];

      if (parentTagIds.length === 0) {
        setTagsWithParents(tags.map(t => ({
          ...t,
          parent_tags: t.displayParentTags || [],
          isPending: !!t.displayParentTags
        })));
        return;
      }

      const { data: parentTags, error: parentTagsError } = await supabase
        .from('tags')
        .select('id, name')
        .in('id', parentTagIds);

      if (parentTagsError) throw parentTagsError;

      const parentTagsMap = new Map(parentTags.map(t => [t.id, t.name]));

      const tagsWithParentsData = tags.map(tag => {
        // Pending local parent names for immediate feedback
        if (tag.displayParentTags) {
          return {
            ...tag,
            parent_tags: tag.displayParentTags,
            isPending: true
          };
        }
        // For non-UUID (e.g., temp) tags, just show none
        if (!isUuid(tag.id)) {
          return {
            ...tag,
            parent_tags: [],
            isPending: false
          };
        }
        const parentHierarchies = hierarchies.filter(h => h.tag_id === tag.id);
        const parent_names = parentHierarchies
          .map(ph => parentTagsMap.get(ph.parent_tag_id))
          .filter(Boolean);
        return {
          ...tag,
          parent_tags: parent_names,
          isPending: false
        };
      });

      setTagsWithParents(tagsWithParentsData);
    } catch (error) {
      // Fallback to avoid stale rows from previous category
      setTagsWithParents(tags.map(t => ({
        ...t,
        parent_tags: t.displayParentTags || [],
        isPending: !!t.displayParentTags
      })));
      toast.error(`Failed to fetch parent tags: ${error.message}`);
    }
  }, [tags, showBelongsTo]);


  useEffect(() => {
    fetchParentTags();
  }, [fetchParentTags]);

  return (
    <div className="border rounded-lg flex flex-col h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag Name</TableHead>
            {showBelongsTo && <TableHead>{`Related ${parentCategoryName || 'Category'}`}</TableHead>}
            <TableHead className="text-right">
              <Button 
                variant="link" 
                size="sm" 
                className={`text-blue-600 font-semibold transition-opacity ${
                  editing ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onAdd}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Tag
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      <div className="overflow-y-auto flex-grow">
        <Table>
          <TableBody>
            {tagsWithParents.map((tag) => (
              <TableRow 
                key={tag.id} 
                className={`h-[58px] cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedTagId === tag.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
              >
                <TableCell className="font-medium">{tag.name}</TableCell>
                {showBelongsTo && (
                  <TableCell>
                     <div className="flex flex-wrap gap-1 justify-start">
                       {tag.parent_tags && tag.parent_tags.length > 0 ? (
                         tag.parent_tags.map((parentName, index) => (
                           <Badge 
                             key={index} 
                             variant="secondary"
                             className={tag.isPending ? "italic opacity-75" : ""}
                           >
                             {parentName}
                           </Badge>
                         ))
                       ) : (
                         <span className="text-muted-foreground">None</span>
                       )}
                     </div>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className={`h-8 w-8 p-0 transition-opacity ${
                          editing ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                        disabled={!editing}
                      >
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(tag)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(tag.id)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TagsTable;
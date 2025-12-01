import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const MergeModesDialog = ({ isOpen, onOpenChange, selectedColors = [], onMerged }) => {
  // using direct toast API (no hooks)
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const defaultName = useMemo(() => {
    if (!selectedColors || selectedColors.length === 0) return '';
    const sorted = [...selectedColors].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return sorted[0]?.name || '';
  }, [selectedColors]);

  React.useEffect(() => {
    if (isOpen) setName(defaultName);
  }, [isOpen, defaultName]);

  const handleSave = async () => {
    try {
      if (!name.trim()) {
        toast({ title: 'Name required', description: 'Please enter a name for the merged color.', variant: 'destructive' });
        return;
      }
      setSaving(true);
      const colorIds = selectedColors.map(c => c.id);
      const { data, error } = await supabase.rpc('merge_colors_by_modes', {
        p_color_ids: colorIds,
        p_new_name: name.trim(),
      });
      if (error) throw error;

      // Refresh colors view if available
      try { await supabase.rpc('refresh_colors_with_full_details'); } catch {}

      toast({ title: 'Merged successfully', description: 'Selected colors were merged into a single color.' });
      onOpenChange(false);
      onMerged?.(data);
    } catch (e) {
      console.error('Merge failed', e);
      toast({ title: 'Merge failed', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge Modes</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Enter a name for the merged color.</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Merged color name" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Merging…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MergeModesDialog;

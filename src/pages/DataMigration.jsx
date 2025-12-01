import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const DataMigration = () => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleMigration = async () => {
    setIsMigrating(true);
    toast({
      title: 'Migration Started',
      description: 'Copying hard-coded data to the database. This may take a moment.',
    });

    try {
      if (!user) {
        throw new Error("User not authenticated.");
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Could not retrieve user profile or organization.");
      }

      const { data, error } = await supabase.functions.invoke('migrate-color-data', {
         body: JSON.stringify({ organization_id: profile.organization_id, user_id: user.id })
      });

      if (error) {
        throw error;
      }
      
      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Migration Successful!',
        description: data.message,
      });

    } catch (error) {
      console.error('Migration failed:', error);
      toast({
        title: 'Migration Failed',
        description: error.message || 'An unknown error occurred during migration.',
        variant: 'destructive',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRemoveSubstratePrefix = async () => {
    setIsRenaming(true);
    toast({
      title: 'Renaming Started',
      description: 'Removing substrate name prefixes from condition names...'
    });

    try {
      if (!user) throw new Error('User not authenticated.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) throw new Error('Could not retrieve user profile or organization.');

      const { data: substrates, error: subsError } = await supabase
        .from('substrates')
        .select('id, name')
        .eq('organization_id', profile.organization_id);

      if (subsError) throw subsError;
      if (!substrates || substrates.length === 0) {
        toast({ title: 'No substrates found', description: 'Nothing to rename.' });
        return;
      }

      const substrateMap = new Map(substrates.map(s => [s.id, (s.name || '').trim()]));

      const { data: conditions, error: condError } = await supabase
        .from('substrate_conditions')
        .select('id, name, substrate_id')
        .in('substrate_id', substrates.map(s => s.id));

      if (condError) throw condError;

      const updates = [];
      for (const c of conditions || []) {
        const sname = substrateMap.get(c.substrate_id) || '';
        if (!sname || !c?.name) continue;
        const prefix = `${sname} - `;
        if (c.name.startsWith(prefix)) {
          const newName = c.name.slice(prefix.length).trim();
          if (newName && newName !== c.name) {
            updates.push({ id: c.id, name: newName });
          }
        }
      }

      let updated = 0;
      const chunkSize = 10;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const slice = updates.slice(i, i + chunkSize);
        await Promise.all(
          slice.map(u => supabase.from('substrate_conditions').update({ name: u.name }).eq('id', u.id))
        );
        updated += slice.length;
      }

      toast({ title: 'Renaming Complete', description: `Updated ${updated} condition name(s).` });
    } catch (error) {
      console.error('Renaming failed:', error);
      toast({ title: 'Renaming Failed', description: error.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto mb-6">
        <CardHeader>
          <CardTitle>Data Migration</CardTitle>
          <CardDescription>
            Migrate hard-coded application data (color libraries, matches, etc.) to the Supabase database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            This is a one-time operation. Clicking the button below will transfer all built-in color libraries and sample color match data into your organization's database tables. This will only add data if the tables are empty for your organization.
          </p>
          <Button onClick={handleMigration} disabled={isMigrating}>
            {isMigrating ? 'Migrating Data...' : 'Start Data Migration'}
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Rename Substrate Condition Names</CardTitle>
          <CardDescription>
            Remove the substrate name prefix (e.g., “Substrate A - …”) from all condition names in your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            This will scan all substrate conditions and update names that start with the related substrate name followed by a hyphen.
          </p>
          <Button onClick={handleRemoveSubstratePrefix} disabled={isRenaming}>
            {isRenaming ? 'Renaming…' : 'Remove Substrate Name Prefixes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataMigration;
export const handleColorDataMigration = async (supabase, toast, userId, organizationId) => {
  const { count } = await supabase.from('colors').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId);
  if (count > 0) return;

  const { data, error } = await supabase.functions.invoke('migrate-color-data', {
    body: JSON.stringify({ organization_id: organizationId, user_id: userId }),
  });
  if (error) throw new Error(`Function migrate-color-data failed: ${error.message}`);
  if (data.error) throw new Error(`Function migrate-color-data returned an error: ${data.error}`);

  if (data.message && data.message.toLowerCase().includes('success')) {
    toast({
      title: 'Setup Complete!',
      description: 'Default color libraries have been loaded.',
    });
  }
};

export const handleColorMatchMigration = async (supabase, toast, organizationId) => {
  const { count } = await supabase.from('match_requests').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId);
  if (count > 0) return;

  const { data, error } = await supabase.functions.invoke('migrate-color-match-data', {
    body: JSON.stringify({ organization_id: organizationId }),
  });
  if (error) throw new Error(`Function migrate-color-match-data failed: ${error.message}`);
  if (data.error) throw new Error(`Function migrate-color-match-data returned an error: ${data.error}`);

  if (data.message && data.message.toLowerCase().includes('success')) {
    toast({
      title: 'Setup Complete!',
      description: 'Default color match requests have been loaded.',
    });
  }
};
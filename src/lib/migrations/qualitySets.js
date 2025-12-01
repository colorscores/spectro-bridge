import { qualitySetsData } from './seedData';

export const handleQualitySetMigration = async (supabase, toast, userId, organizationId) => {
  const { count } = await supabase.from('quality_sets').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId);
  if (count > 0) return;

  for (const qualitySet of qualitySetsData) {
    const { data: qsData, error: qsError } = await supabase
      .from('quality_sets')
      .insert({
        name: qualitySet.setName,
        organization_id: organizationId,
        created_by: userId,
        last_edited_by: userId,
      })
      .select()
      .single();
    
    if (qsError) throw qsError;

    for (const rule of qualitySet.rules) {
      const { data: ruleData, error: ruleError } = await supabase
        .from('quality_rules')
        .insert({
          quality_set_id: qsData.id,
          name: rule.name,
          reference: rule.reference,
        })
        .select()
        .single();

      if (ruleError) throw ruleError;

      const levelsToInsert = rule.levels.map(level => ({
        quality_rule_id: ruleData.id,
        name: level.name,
        range_from: parseFloat(level.rangeFrom),
        range_to: level.rangeTo === 'open' ? null : parseFloat(level.rangeTo),
        action: level.action,
      }));
      
      const { error: levelError } = await supabase.from('quality_levels').insert(levelsToInsert);
      if (levelError) throw levelError;
    }
  }
   toast({
    title: 'Setup Complete!',
    description: 'Default quality sets have been loaded.',
  });
};
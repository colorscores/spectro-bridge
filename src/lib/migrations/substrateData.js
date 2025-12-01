import { substrateOptionsData } from './seedData';

export const handleSubstrateOptionsMigration = async (supabase, toast, organizationId) => {
  // If no organization context, skip seeding (prevents null uuid errors and duplicates)
  if (!organizationId) return;

  // Get existing types to avoid duplicates
  const { data: existingTypes } = await supabase
    .from('substrate_types')
    .select('id, name')
    .eq('organization_id', organizationId);
  
  const insertedTypes = {};
  let insertedAnything = false;
  if (existingTypes) {
    existingTypes.forEach(type => {
      insertedTypes[type.name] = type.id;
    });
  }

  // Insert missing substrate types
  for (const typeName of substrateOptionsData.types) {
    if (!insertedTypes[typeName]) {
      try {
        const { data: typeData, error: typeError } = await supabase
          .from('substrate_types')
          .insert({ name: typeName, organization_id: organizationId })
          .select()
          .single();
        if (typeError) {
          // If it's a duplicate key error, try to fetch the existing one
          if (typeError.code === '23505') {
            const { data: existingType } = await supabase
              .from('substrate_types')
              .select('id')
              .eq('name', typeName)
              .eq('organization_id', organizationId)
              .single();
            if (existingType) {
              insertedTypes[typeName] = existingType.id;
            }
          } else {
            throw typeError;
          }
        } else {
          insertedTypes[typeName] = typeData.id;
          insertedAnything = true;
        }
      } catch (error) {
        console.error(`Error inserting substrate type ${typeName}:`, error);
      }
    }
  }

  // Insert materials for each type
  for (const [typeName, materials] of Object.entries(substrateOptionsData.materials)) {
    const typeId = insertedTypes[typeName];
    if (typeId) {
      // Get existing materials for this type
      const { data: existingMaterials } = await supabase
        .from('substrate_materials')
        .select('name')
        .eq('substrate_type_id', typeId)
        .eq('organization_id', organizationId);
      
      const existingMaterialNames = new Set(existingMaterials?.map(m => m.name) || []);
      
      // Only insert materials that don't exist
      const materialsToInsert = materials
        .filter(name => !existingMaterialNames.has(name))
        .map(name => ({ name, substrate_type_id: typeId, organization_id: organizationId }));
      
      if (materialsToInsert.length > 0) {
        const { error: materialError } = await supabase.from('substrate_materials').insert(materialsToInsert);
        if (materialError) console.error('Error inserting materials:', materialError);
      }
    }
  }

  // Insert surface qualities for each type
  for (const [typeName, qualities] of Object.entries(substrateOptionsData.surfaceQualities)) {
    const typeId = insertedTypes[typeName];
    if (typeId) {
      // Get existing qualities for this type
      const { data: existingQualities } = await supabase
        .from('substrate_surface_qualities')
        .select('name')
        .eq('substrate_type_id', typeId)
        .eq('organization_id', organizationId);
      
      const existingQualityNames = new Set(existingQualities?.map(q => q.name) || []);
      
      // Only insert qualities that don't exist
      const qualitiesToInsert = qualities
        .filter(name => !existingQualityNames.has(name))
        .map(name => ({ name, substrate_type_id: typeId, organization_id: organizationId }));
      
      if (qualitiesToInsert.length > 0) {
        const { error: qualityError } = await supabase.from('substrate_surface_qualities').insert(qualitiesToInsert);
        if (qualityError) console.error('Error inserting qualities:', qualityError);
      }
    }
  }

  if (insertedAnything) {
    toast({
      title: 'Setup Complete!',
      description: 'Default substrate options have been loaded.',
    });
  }
};

export const handleSubstrateMigration = async (supabase, toast, userId, organizationId) => {
  const { count } = await supabase.from('substrates').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId);
  if (count > 0) return;

  const { data: types } = await supabase.from('substrate_types').select('id, name').eq('organization_id', organizationId);
  const { data: materials } = await supabase.from('substrate_materials').select('id, name').eq('organization_id', organizationId);
  const { data: qualities } = await supabase.from('substrate_surface_qualities').select('id, name').eq('organization_id', organizationId);

  const findId = (arr, name) => arr.find(item => item.name === name)?.id;

  const substratesToInsert = [
    {
      name: 'Coated Paper Standard',
      type: findId(types, 'Coated Paper'),
      material: findId(materials, 'Standard'),
      surface_quality: findId(qualities, 'Glossy'),
      organization_id: organizationId,
      last_modified_by: userId,
    },
    {
      name: 'Uncoated Paper Premium',
      type: findId(types, 'Uncoated Paper'),
      material: findId(materials, 'Premium'),
      surface_quality: findId(qualities, 'SC/Smooth/Machine'),
      organization_id: organizationId,
      last_modified_by: userId,
    },
    {
      name: 'White Film',
      type: findId(types, 'Film'),
      material: findId(materials, 'White (Matte, Glossy, Semi)'),
      surface_quality: findId(qualities, 'High Gloss'),
      organization_id: organizationId,
      last_modified_by: userId,
    },
  ];

  const { error } = await supabase.from('substrates').insert(substratesToInsert);
  if (error) throw error;

  toast({
    title: 'Setup Complete!',
    description: 'Default substrates have been loaded.',
  });
};

export const handleSubstrateConditionMigration = async (supabase, toast, organizationId) => {
  const { count } = await supabase.from('substrate_conditions').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId);
  if (count > 0) return;

  const { data: substrates, error: substratesError } = await supabase
    .from('substrates')
    .select('id')
    .eq('organization_id', organizationId);

  if (substratesError) throw substratesError;
  if (!substrates || substrates.length === 0) return;

  const conditions = [
    { name: 'Primer', pack_type: 'Primer', color_hex: '#FFFFFF', is_part_of_structure: true },
    { name: 'Basecoat', pack_type: 'Basecoat', color_hex: '#FFFFFF', is_part_of_structure: true },
    { name: 'Special Coating', pack_type: 'Coating', color_hex: '#FFFFFF', is_part_of_structure: true },
    { name: 'White Ink', pack_type: 'Ink', color_hex: '#FFFFFF', is_part_of_structure: false },
  ];

  const conditionsToInsert = substrates.flatMap(substrate => 
    conditions.map(condition => ({
      ...condition,
      substrate_id: substrate.id,
      organization_id: organizationId,
    }))
  );

  if (conditionsToInsert.length > 0) {
    const { error: insertError } = await supabase.from('substrate_conditions').insert(conditionsToInsert);
    if (insertError) throw insertError;
  }

  toast({
    title: 'Setup Complete!',
    description: 'Default substrate conditions have been loaded.',
  });
};
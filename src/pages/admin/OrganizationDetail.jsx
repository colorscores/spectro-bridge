import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useProfile } from '@/context/ProfileContext';
import Breadcrumb from '@/components/Breadcrumb';

import { useOrganizationLogic } from '@/hooks/useOrganizationLogic';
import MyCompanyHeader from '@/components/admin/my-company/MyCompanyHeader';

import DefaultColorSettings from '@/components/admin/my-company/DefaultColorSettings';
import CategoriesTable from '@/components/admin/my-company/CategoriesTable';
import TagsTable from '@/components/admin/my-company/TagsTable';
import LocationsTable from '@/components/admin/my-company/LocationsTable';
import DialogsManager from '@/components/admin/my-company/DialogsManager';
import OrganizationTypes from '@/components/admin/my-company/OrganizationTypes';
import CompanyBrandPanel from '@/components/admin/my-company/CompanyBrandPanel';
import LicensingCard from '@/components/admin/my-company/LicensingCard';

const OrganizationDetail = () => {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();

  const {
    organization, setOrganization,
    locations,
    categories,
    selectedCategory, setSelectedCategory,
    loading,
    dialogs, openDialog, closeDialog, openDeleteConfirmation,
    activeItems,
    parentCategoryTags,
    refreshData,
    handleOrgTypeChange,
    handleDelete,
    closeTagDeleteConfirmation,
    checkTagAssociations,
    handleTagDelete,
    filteredTags,
    displayedCategories,
    showBelongsTo,
    parentCategory,
    orgAdmins,
    orgUsers,
  } = useOrganizationLogic(organizationId);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgTypesDirty, setOrgTypesDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  const orgTypesSaveRef = useRef(null);
  const orgTypesCancelRef = useRef(null);
  const settingsSaveRef = useRef(null);
  const settingsCancelRef = useRef(null);

  const canSave = orgTypesDirty || settingsDirty;

  // Security check: Only superadmin can access
  if (profile?.role !== 'Superadmin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only superadmins can access organization details.</p>
        </div>
      </div>
    );
  }

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    orgTypesCancelRef.current?.();
    settingsCancelRef.current?.();
    setIsEditing(false);
    setOrgTypesDirty(false);
    setSettingsDirty(false);
  };
  const handleSave = async () => {
    if (!canSave) { setIsEditing(false); return; }
    try {
      setSaving(true);
      const promises = [];
      if (orgTypesDirty && orgTypesSaveRef.current) promises.push(orgTypesSaveRef.current());
      if (settingsDirty && settingsSaveRef.current) promises.push(settingsSaveRef.current());
      await Promise.all(promises);
      setIsEditing(false);
      setOrgTypesDirty(false);
      setSettingsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{organization?.name || 'Organization'} - Spectral</title>
        <meta name="description" content="Manage organization information and sharing tags." />
      </Helmet>
      <div className="bg-gray-50/50 min-h-screen p-4 sm:p-6 lg:p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeInOut' }} className="max-w-7xl mx-auto">
          
          {/* Breadcrumb Navigation */}
          <Breadcrumb 
            items={[
              { label: 'Organizations', href: '/admin/organizations' },
              { label: organization?.name || 'Organization' }
            ]}
          />

          <MyCompanyHeader 
            organization={organization} 
            locations={locations} 
            isEditing={isEditing}
            canSave={canSave}
            saving={saving}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onSave={handleSave}
            title={organization?.name || 'Organization'}
            description="Manage organization details, locations, and sharing tags."
          />

          {/* Top Card: Company/Org/Logo + Organization Roles + Locations */}
          <Card className="bg-white p-6 rounded-xl shadow-none mb-8">
            <CardContent className="p-0 space-y-10">
              <CompanyBrandPanel organization={organization} setOrganization={setOrganization} />

              {/* Organization Roles */}
              <section>
                <Card className="bg-white p-6 rounded-xl shadow-none">
                  <CardHeader className="p-0 mb-6">
                    <h2 className="text-xl font-semibold text-gray-700">Organization Roles</h2>
                  </CardHeader>
                  <CardContent className="p-0">
                    <OrganizationTypes
                      selectedTypes={organization?.type || []}
                      onTypeChange={isEditing ? undefined : handleOrgTypeChange}
                      loading={loading}
                      organization={organization}
                      editing={isEditing}
                      hideLocalActions
                      hideTitle
                      onDirtyChange={setOrgTypesDirty}
                      registerSaveHandler={(fn) => { orgTypesSaveRef.current = fn; }}
                      registerCancelHandler={(fn) => { orgTypesCancelRef.current = fn; }}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* Locations */}
              <section>
                <Card className="bg-white p-6 rounded-xl shadow-none">
                  <CardHeader className="p-0 mb-6">
                    <h2 className="text-xl font-semibold text-gray-700">Locations</h2>
                  </CardHeader>
                  <CardContent className="p-0">
                    <LocationsTable
                      locations={locations}
                      loading={loading}
                      onAddLocation={isEditing ? () => openDialog('addLocation') : undefined}
                      onEditLocation={isEditing ? (location) => openDialog('editLocation', location) : undefined}
                      onDeleteLocation={isEditing ? openDeleteConfirmation : undefined}
                      activeActionId={activeItems.activeActionId}
                      editing={isEditing}
                    />
                  </CardContent>
                </Card>
              </section>
            </CardContent>
          </Card>

          {/* Second Card: Default Color Settings */}
          <Card className="bg-white p-6 rounded-xl shadow-none mb-8">
            <CardContent className="p-0">
              <section>
        <DefaultColorSettings 
          organization={organization}
          onUpdate={(updatedOrg) => {
            // Update the organization state directly instead of refetching
            setOrganization(updatedOrg);
          }}
          editing={isEditing}
          hideLocalActions
          withinPanel
          onDirtyChange={setSettingsDirty}
          registerSaveHandler={(fn) => { settingsSaveRef.current = fn; }}
          registerCancelHandler={(fn) => { settingsCancelRef.current = fn; }}
        />
              </section>
            </CardContent>
          </Card>

          {/* Third Card: Sharing Tags */}
          <Card className="bg-white p-6 rounded-xl shadow-none mb-8">
            <CardContent className="p-0">
              {/* Sharing Tags */}
              <section>
                <div className="p-0 mb-6">
                  <h2 className="text-xl font-semibold text-gray-700">Sharing Tags</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 h-full">
                    <CategoriesTable
                      displayedCategories={displayedCategories}
                      selectedCategory={selectedCategory}
                      onSelectCategory={setSelectedCategory}
                      onAddCategory={isEditing ? () => openDialog('addCategory') : undefined}
                      onEditCategory={isEditing ? (category) => openDialog('editCategory', category) : undefined}
                      onDeleteCategory={isEditing ? openDeleteConfirmation : undefined}
                      activeActionId={activeItems.activeActionId}
                      editing={isEditing}
                    />
                  </div>
                  <div className="lg:col-span-2 h-full">
                    <TagsTable
                      tags={filteredTags}
                      loading={loading}
                      showBelongsTo={showBelongsTo}
                      parentCategoryName={parentCategory?.name}
                      onAdd={isEditing ? () => openDialog('addTag') : undefined}
                      onEdit={isEditing ? (tag) => openDialog('editTag', tag) : undefined}
                      onDelete={isEditing ? (e, id) => openDeleteConfirmation(e, 'tag', id) : undefined}
                      onAssociationChange={() => refreshData('tags')}
                      editing={isEditing}
                    />
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>

          {/* Fourth Card: Licensing */}
          <LicensingCard 
            organizationId={organizationId} 
            organization={organization}
          />
        </motion.div>
      </div>
      <DialogsManager
        dialogs={dialogs}
        closeDialog={closeDialog}
        activeItems={activeItems}
        categories={categories}
        selectedCategory={selectedCategory}
        parentCategoryTags={parentCategoryTags}
        parentCategory={parentCategory}
        organization={organization}
        onRefresh={refreshData}
        onDelete={handleDelete}
        onTagDelete={handleTagDelete}
        closeTagDeleteConfirmation={closeTagDeleteConfirmation}
      />
    </>
  );
};

export default OrganizationDetail;
import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import { useMyCompanyLogic } from '@/components/admin/my-company/hooks/useMyCompanyLogic';
import DefaultColorSettings from '@/components/admin/my-company/DefaultColorSettings';
import CategoriesTable from '@/components/admin/my-company/CategoriesTable';
import TagsTable from '@/components/admin/my-company/TagsTable';
import LocationsTable from '@/components/admin/my-company/LocationsTable';
import LocationDialogsManager from '@/components/admin/my-company/LocationDialogsManager';
import OrganizationTypes from '@/components/admin/my-company/OrganizationTypes';
import CompanyBrandPanel from '@/components/admin/my-company/CompanyBrandPanel';
import LicensingCard from '@/components/admin/my-company/LicensingCard';
import SectionHeader from '@/components/admin/my-company/CardHeader';
import MyCompanyHelpDialog from '@/components/admin/my-company/help/MyCompanyHelpDialog';
import SharingTagsManager from '@/components/admin/my-company/SharingTagsManager';

const MyCompany = () => {
  const {
    organization, setOrganization,
    locations,
    categories,
    selectedCategory, setSelectedCategory,
    loading,
    dialogs, openDialog, closeDialog, openDeleteConfirmation, closeTagDeleteConfirmation,
    activeItems,
    parentCategoryTags,
    refreshData,
    handleOrgTypeChange,
    handleDelete,
    handleTagDelete,
    filteredTags,
    displayedCategories,
    showBelongsTo,
    parentCategory,
    orgAdmins,
    orgUsers,
  } = useMyCompanyLogic();

  // Help dialog state
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [helpSection, setHelpSection] = useState(null);

  // Individual card edit states
  const [orgTypesEditing, setOrgTypesEditing] = useState(false);
  const [locationsEditing, setLocationsEditing] = useState(false);
  const [settingsEditing, setSettingsEditing] = useState(false);
  const [tagsEditing, setTagsEditing] = useState(false);
  
  // Saving states
  const [orgTypesSaving, setOrgTypesSaving] = useState(false);
  const [locationsSaving, setLocationsSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [tagsSaving, setTagsSaving] = useState(false);
  
  // Can save states (track if changes were made)
  const [orgTypesCanSave, setOrgTypesCanSave] = useState(false);
  const [locationsCanSave, setLocationsCanSave] = useState(false);
  const [settingsCanSave, setSettingsCanSave] = useState(false);
  const [tagsCanSave, setTagsCanSave] = useState(false);

  // Sharing tags state
  const [sharingTagsChanges, setSharingTagsChanges] = useState(null);
  const sharingTagsManagerRef = React.useRef(null);

  const openHelpDialog = (section) => {
    setHelpSection(section);
    setHelpDialogOpen(true);
  };

  // Sharing tags handlers
  const handleSharingTagsStateChange = (hasChanges, changes) => {
    setTagsCanSave(hasChanges);
    setSharingTagsChanges(changes);
  };

  const handleSharingTagsSave = async () => {
    if (sharingTagsManagerRef.current && sharingTagsManagerRef.current.saveChanges) {
      setTagsSaving(true);
      try {
        await sharingTagsManagerRef.current.saveChanges();
        setTagsEditing(false);
        setTagsCanSave(false);
      } catch (error) {
        // Error already handled in saveChanges
      } finally {
        setTagsSaving(false);
      }
    }
  };

  const handleSharingTagsDiscard = () => {
    if (sharingTagsManagerRef.current && sharingTagsManagerRef.current.discardChanges) {
      sharingTagsManagerRef.current.discardChanges();
      setTagsEditing(false);
      setTagsCanSave(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>My Company - Spectral</title>
        <meta name="description" content="Manage company organizational information and sharing tags." />
      </Helmet>
      <div className="bg-gray-50/50 min-h-screen p-4 sm:p-6 lg:p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeInOut' }} className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">My Company</h1>
              <button
                onClick={() => setHelpDialogOpen(true)}
                className="text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                aria-label="Learn about My Company features"
              >
                <GraduationCap className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-600 mt-2">Manage your organization settings and configuration</p>
          </div>

          {/* Top Card: Company/Org/Logo + Organization Roles + Locations */}
          <Card className="bg-white p-6 rounded-xl shadow-none mb-8">
            <CardContent className="p-0 space-y-10">
              <CompanyBrandPanel organization={organization} setOrganization={setOrganization} />

              {/* Organization Roles */}
              <section>
                <Card className="bg-white p-6 rounded-xl shadow-none">
                  <CardContent className="p-0">
                    <SectionHeader
                      title="Organization Roles"
                      subtitle="Define your organization's role in the supply chain"
                      onEdit={() => setOrgTypesEditing(true)}
                      onSave={() => {
                        // OrganizationTypes component handles its own save
                        setOrgTypesEditing(false);
                        setOrgTypesCanSave(false);
                      }}
                      onCancel={() => {
                        setOrgTypesEditing(false);
                        setOrgTypesCanSave(false);
                      }}
                      showLearn={false}
                      isEditing={orgTypesEditing}
                      canSave={orgTypesCanSave}
                      saving={orgTypesSaving}
                      className="p-0"
                    />
                    <OrganizationTypes
                      selectedTypes={organization?.type || []}
                      onTypeChange={handleOrgTypeChange}
                      loading={loading}
                      organization={organization}
                      editing={orgTypesEditing}
                      hideLocalActions={false}
                      hideTitle={true}
                      onEditComplete={() => setOrgTypesEditing(false)}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* Locations */}
              <section>
                <Card className="bg-white p-6 rounded-xl shadow-none">
                  <CardContent className="p-0">
                    <SectionHeader
                      title="Locations"
                      subtitle="Manage your organization's physical locations and facilities"
                      onEdit={() => setLocationsEditing(true)}
                      onSave={() => {
                        setLocationsEditing(false);
                        setLocationsCanSave(false);
                      }}
                      onCancel={() => {
                        setLocationsEditing(false);
                        setLocationsCanSave(false);
                      }}
                      showLearn={false}
                      isEditing={locationsEditing}
                      canSave={locationsCanSave}
                      saving={locationsSaving}
                      className="p-0"
                    />
                    <LocationsTable
                      locations={locations}
                      loading={loading}
                      onAddLocation={locationsEditing ? () => openDialog('addLocation') : undefined}
                      onEditLocation={locationsEditing ? (location) => openDialog('editLocation', location) : undefined}
                      onDeleteLocation={locationsEditing ? openDeleteConfirmation : undefined}
                      activeActionId={activeItems.activeActionId}
                      editing={locationsEditing}
                      onEditComplete={() => setLocationsEditing(false)}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* Default Color Settings */}
              <section>
                <Card className="bg-white p-6 rounded-xl shadow-none">
                  <CardContent className="p-0">
                    <SectionHeader
                      title="Default Color Settings"
                      subtitle="Configure measurement standards for consistent color evaluation"
                      onEdit={() => setSettingsEditing(true)}
                      onSave={() => {
                        // DefaultColorSettings component handles its own save
                        setSettingsEditing(false);
                        setSettingsCanSave(false);
                      }}
                      onCancel={() => {
                        setSettingsEditing(false);
                        setSettingsCanSave(false);
                      }}
                      showLearn={false}
                      isEditing={settingsEditing}
                      canSave={settingsCanSave}
                      saving={settingsSaving}
                      className="p-0"
                    />
                    <DefaultColorSettings 
                      organization={organization}
                      onUpdate={(updatedOrg) => {
                        setOrganization(updatedOrg);
                      }}
                      editing={settingsEditing}
                      hideLocalActions={false}
                      withinPanel={true}
                      hideTitle={true}
                      onEditComplete={() => setSettingsEditing(false)}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* Sharing Tags */}
              <section>
                <Card className="bg-white p-6 rounded-xl shadow-none">
                  <CardContent className="p-0">
                    <SectionHeader
                      title="Sharing Tags"
                      subtitle="Organize and categorize content for easy discovery and sharing"
                      onEdit={() => setTagsEditing(true)}
                      onSave={handleSharingTagsSave}
                      onCancel={handleSharingTagsDiscard}
                      showLearn={false}
                      isEditing={tagsEditing}
                      canSave={tagsCanSave}
                      saving={tagsSaving}
                      className="p-0"
                    />
                    <SharingTagsManager
                      ref={sharingTagsManagerRef}
                      organization={organization}
                      editing={tagsEditing}
                      onStateChange={handleSharingTagsStateChange}
                      onEditComplete={() => setTagsEditing(false)}
                    />
                  </CardContent>
                </Card>
              </section>
            </CardContent>
          </Card>

          {/* Fourth Card: Licensing */}
          <LicensingCard />
        </motion.div>
      </div>
      <LocationDialogsManager
        dialogs={dialogs}
        closeDialog={closeDialog}
        activeItems={activeItems}
        organization={organization}
        onRefresh={refreshData}
        onDelete={handleDelete}
      />

      {/* Help Dialog */}
      <MyCompanyHelpDialog
        isOpen={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        initialSection={helpSection}
      />
    </>
  );
};

export default MyCompany;
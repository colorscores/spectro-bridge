
// Phase 2 eager loading complete - routes updated
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Route guards MUST be eagerly loaded to avoid React context issues
import MatchingRouteGuard from '@/components/matching/MatchingRouteGuard';
import MatchMeasurementRedirect from '@/components/matching/MatchMeasurementRedirect';

// All components eagerly loaded - no lazy loading
import Dashboard from '@/pages/Dashboard';
import AssetDashboard from '@/pages/AssetDashboard';
import BrandColors from '@/pages/BrandColors';
import ColorMatches from '@/pages/ColorMatches';
import Printers from '@/pages/Printers';
import QualitySets from '@/pages/QualitySets';
import Activity from '@/pages/Activity';
import MyProfile from '@/pages/MyProfile';
import Inks from '@/pages/Inks';
import InkDetail from '@/pages/InkDetail';
import InkConditionDetail from '@/pages/InkConditionDetail';
import Substrates from '@/pages/Substrates';
import SubstrateDetail from '@/pages/SubstrateDetail';
import SubstrateConditionDetail from '@/pages/SubstrateConditionDetail';
import Testcharts from '@/pages/Testcharts';
import TestchartDetail from '@/pages/TestchartDetail';
import PrintConditions from '@/pages/PrintConditions';
import PrintConditionDetail from '@/pages/PrintConditionDetail';
import ColorDetail from '@/pages/ColorDetail';
import PrinterDetail from '@/pages/PrinterDetail';
import PrinterConditionDetail from '@/pages/PrinterConditionDetail';
import ColorMatchDetail from '@/pages/ColorMatchDetail';
import Matching from '@/pages/Matching';
import QualitySetDetail from '@/pages/QualitySetDetail';
import Curves from '@/pages/Curves';
import Characterizations from '@/pages/Characterizations';
import Profiles from '@/pages/Profiles';
import Integrations from '@/pages/Integrations';
import Partners from '@/pages/admin/Partners';
import MyCompany from '@/pages/admin/MyCompany';
import Users from '@/pages/admin/Users';
import Organizations from '@/pages/admin/Organizations';
import OrganizationDetail from '@/pages/admin/OrganizationDetail';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import DataMigration from '@/pages/DataMigration';
import SynthesizeColors from '@/pages/SynthesizeColors';
import ColorMatchAnalysis from '@/pages/ColorMatchAnalysis';

const AppRoutes = () => {
  
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/health" element={<div className="p-4">OK</div>} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/assets/dashboard" element={<AssetDashboard />} />
      <Route path="/colors" element={<BrandColors />} />
      <Route path="/assets/colors" element={<BrandColors />} />
      <Route path="/assets/colors/synthesize" element={<SynthesizeColors />} />
      <Route path="/assets/printers" element={<Printers />} />
      <Route path="/assets/printers/new" element={<PrinterDetail />} />
      <Route path="/assets/printers/:printerId" element={<PrinterDetail />} />
      <Route path="/assets/printers/:printerId/conditions/new" element={<PrinterConditionDetail />} />
      <Route path="/assets/printers/:printerId/conditions/:conditionId" element={<PrinterConditionDetail />} />
      <Route path="/assets/inks" element={<Inks />} />
      <Route path="/assets/inks/new" element={<InkDetail />} />
      <Route path="/assets/inks/:inkId" element={<InkDetail />} />
      <Route path="/assets/inks/:inkId/conditions/new" element={<InkConditionDetail />} />
      <Route path="/assets/inks/:inkId/conditions/:conditionId" element={<InkConditionDetail />} />
      <Route path="/assets/curves" element={<Curves />} />
      <Route path="/assets/characterizations" element={<Characterizations />} />
      <Route path="/assets/profiles" element={<Profiles />} />
      <Route path="/assets/substrates" element={<Substrates />} />
      <Route path="/assets/substrates/new" element={<SubstrateDetail />} />
      <Route path="/assets/substrates/:substrateId" element={<SubstrateDetail />} />
      <Route path="/assets/substrates/:substrateId/conditions/:conditionId" element={<SubstrateConditionDetail />} />
      <Route path="/assets/testcharts" element={<Testcharts />} />
      <Route path="/assets/testcharts/new" element={<TestchartDetail />} />
      <Route path="/assets/testcharts/:id" element={<TestchartDetail />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/integrations" element={<Integrations />} />
      <Route path="/admin/my-company" element={<MyCompany />} />
      <Route path="/admin/users" element={<Users />} />
      <Route path="/admin/organizations" element={<Organizations />} />
      <Route path="/admin/organizations/:organizationId" element={<OrganizationDetail />} />
      <Route path="/admin/partners" element={<Partners />} />
      <Route path="/colors/:colorId" element={<ColorDetail />} />
      <Route path="/assets/colors/:colorId" element={<ColorDetail />} />
      <Route path="/color-matches" element={<ColorMatches />} />
      <Route path="/color-matches/:matchId" element={<ColorMatchDetail />} />
      <Route path="/color-matches/:matchId/matching/:colorId" element={
        <MatchingRouteGuard>
          <Matching />
        </MatchingRouteGuard>
      } />
      <Route path="/match-measurements/:id" element={<MatchMeasurementRedirect />} />
      <Route path="/color-matches/analysis/:colorId" element={<ColorMatchAnalysis />} />
      <Route path="/quality-sets" element={<QualitySets />} />
      <Route path="/quality-sets/:qualitySetId" element={<QualitySetDetail />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/my-profile" element={<MyProfile />} />
      <Route path="/data-migration" element={<DataMigration />} />
      <Route path="/print-conditions" element={<PrintConditions />} />
      <Route path="/print-conditions/new" element={<PrintConditionDetail />} />
      <Route path="/print-conditions/:id" element={<PrintConditionDetail />} />
    </Routes>
  );
};

export default AppRoutes;
  
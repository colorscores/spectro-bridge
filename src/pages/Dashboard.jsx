
import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Plus, Users, FileText, Beaker, Palette, Briefcase, UserCheck, GitBranch, Bell, Palette as PaletteIcon, CheckCircle2, AlertTriangle, ChevronDown, Sparkles, PlusCircle, Share2, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import RecentActivityTable from '@/components/dashboard/RecentActivityTable';
import Notifications from '@/components/dashboard/Notifications';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useActivityData } from '@/hooks/useActivityData';
import { cxfParser } from '@/lib/cxfParser';
import { useCxfImport } from '@/hooks/useCxfImport';
import { useCgatsImport } from '@/hooks/useCgatsImport';
import CxfAddColorDialog from '@/components/colors/CxfAddColorDialog';

import LargeFileWarningDialog from '@/components/colors/LargeFileWarningDialog';

import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useWeightingTools } from '@/context/WeightingToolsContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatInTimeZone } from 'date-fns-tz';
import { getJobStatusForOrg } from '@/lib/matchStatusUtils';

const ActionButton = ({ icon: Icon, text, onClick, dropdownItems }) => {
  const defaultClick = () => {
    toast({
      title: "🚧 Feature Not Implemented",
      description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };
  
  if (dropdownItems) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="bg-white h-auto py-3 px-4 w-full flex items-center justify-start text-left">
            <Icon className="h-5 w-5 mr-3 text-blue-500" />
            <span className="font-semibold flex-1">{text}</span>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {dropdownItems.map((item, index) => (
            <DropdownMenuItem key={index} onClick={item.onClick || defaultClick}>
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.text}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  return (
    <Button 
      variant="outline" 
      className="bg-white h-auto py-3 px-4 w-full flex items-center justify-start text-left" 
      onClick={onClick || defaultClick}
    >
      <Icon className="h-5 w-5 mr-3 text-blue-500" />
      <span className="font-semibold">{text}</span>
    </Button>
  );
};

const DashboardStatCard = React.memo(({ icon: Icon, title, value, valueColor, onClick }) => (
  <Card className={`w-full ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : ''}`} onClick={onClick}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-full bg-blue-100">
          <Icon className="h-6 w-6 text-blue-500" />
        </div>
        <div className={`text-4xl font-bold ${valueColor || ''}`}>{value}</div>
      </div>
    </CardContent>
  </Card>
));

const MatchingDashboard = () => {
  const { profile } = useProfile();
  const { isSuperadmin } = useRoleAccess();
  const { isEnabled: weightingToolsEnabled, toggleWeightingTools } = useWeightingTools();
  const firstName = profile?.full_name?.split(' ')[0] || '';
  const { colors, loading: colorsLoading } = useAppContext();

  const derivedSharedCount = useMemo(() => {
    if (!Array.isArray(colors) || !profile?.organization_id) return null;
    const count = colors.filter(c => c?.organization_id && c.organization_id !== profile.organization_id).length;
    return count;
  }, [colors, profile?.organization_id]);

  const [counts, setCounts] = useState({ colors: 0, jobs: 0, overdue: 0, isPartnerOrg: false });
  const [showMatchRequestDialog, setShowMatchRequestDialog] = useState(false);
  const navigate = useNavigate();

  // Import functionality - unified with Colors page
  const handleDataChanged = () => {
    // Refresh counts after successful import
    if (profile?.organization_id) {
      fetchCounts();
    }
    // Navigate to colors list page after successful import from Dashboard
    navigate('/colors');
  };

  // Use the same hooks as Colors page
  const {
    fileInputRef: cgatsFileInputRef,
    isCgatsAddOpen,
    cgatsColors,
    setIsCgatsAddOpen,
    handleAddCgatsClick,
    handleFileChange: handleCgatsFileChange,
    handleAddColorsFromCgats,
    isLoading: isCgatsLoading,
    isTransforming: isCgatsTransforming,
    fileMetadata: cgatsFileMetadata,
    showLargeFileWarning: cgatsShowLargeFileWarning,
    processingStage: cgatsProcessingStage
  } = useCgatsImport(handleDataChanged);

  const {
    fileInputRef: cxfFileInputRef,
    isCxfAddOpen,
    cxfColors,
    setIsCxfAddOpen,
    handleAddColorClick: handleAddCxfClick,
    handleFileChange: handleCxfFileChange,
    handleAddColorsFromCxf,
    parseProgress: cxfParseProgress,
    isTransforming: isCxfTransforming,
    fileMetadata: cxfFileMetadata,
    resetAllImportState: resetCxfImportState
  } = useCxfImport(handleDataChanged, profile);

  // Extract fetchCounts function to be reusable with caching and progressive loading
  const fetchCounts = useCallback(async () => {
    if (!profile?.organization_id) {
      return;
    }

    const cacheKey = `dashboard_stats_v7_${profile.organization_id}`;
    const cacheTTL = 60000; // 60 seconds
    
    // Load cached values immediately if fresh
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTTL) {
          setCounts(data);
        }
      }
    } catch (e) {
      console.warn('Cache read failed:', e);
    }

    const estToday = formatInTimeZone(new Date(), 'America/New_York', 'yyyy-MM-dd');
    const metricTimeout = 5000; // 5s timeout per metric
    
    // Helper to create timeout promise for each metric
    const withTimeout = (promise, name) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${name} timeout`)), metricTimeout)
        )
      ]);
    };

    // Revert to single batched fetch for all metrics (including shared colors)
    const results = await Promise.allSettled([
      // 1. Total colors
      withTimeout(
        (async () => {
          const res = await supabase
            .from('colors')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', profile.organization_id);
          return { colors: res.count ?? 0 };
        })(),
        'Total colors'
      ),
      
      // 2. Jobs + overdue (scoped + calculated)
      withTimeout(
        (async () => {
          const res = await supabase.rpc('get_match_requests_for_current_user');
          if (res.error) throw res.error;
          const requests = Array.isArray(res.data) ? res.data : [];
          const jobs = requests.length;
          const overdue = requests.reduce((acc, req) => {
            return acc + (getJobStatusForOrg(req, profile.organization_id) === 'Overdue' ? 1 : 0);
          }, 0);
          return { jobs, overdue };
        })(),
        'Jobs + overdue (scoped + calculated)'
      ),
      
      // 4. Partners check (bidirectional)
      withTimeout(
        (async () => {
          const res = await supabase
            .from('partners')
            .select('id', { count: 'exact', head: true })
            .or(`organization_id.eq.${profile.organization_id},partner_organization_id.eq.${profile.organization_id}`)
            .in('status', ['connected', 'accepted'])
            .limit(1);
          return { isPartnerOrg: (res.count ?? 0) > 0 };
        })(),
        'Partners check'
      ),
    ]);

    // Merge all successful results
    const finalCounts = results.reduce((acc, result, index) => {
      if (result.status === 'fulfilled') {
        return { ...acc, ...result.value };
      } else {
        console.warn(`Metric ${index} failed:`, result.reason?.message);
        return acc;
      }
    }, { colors: 0, jobs: 0, overdue: 0, isPartnerOrg: false });

    // Update state with fresh data once
    setCounts(finalCounts);
    
    // Cache the results atomically
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data: finalCounts,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchCounts();
    }
  }, [profile?.organization_id, fetchCounts]);

  // Determine user role and organization type for dashboard buttons
  const isPartnerOrg = counts.isPartnerOrg || profile?.type?.includes('Print Supplier');
  
  const actionButtons = isPartnerOrg ? [
    { 
      icon: Palette, 
      text: "Add new Color",
      dropdownItems: [
        { icon: PlusCircle, text: "Import from CXF", onClick: handleAddCxfClick },
        { icon: FileText, text: "Import from CGATS", onClick: handleAddCgatsClick },
      ]
    },
    { 
      icon: Briefcase, 
      text: "Add new Matches", 
      onClick: () => navigate('/color-matches?jobStatus=Pending,Overdue&matchStatus=Match Requested')
    },
    { 
      icon: CheckCircle2, 
      text: "Review Saved Matches", 
      onClick: () => navigate('/color-matches?jobStatus=Pending,Overdue&matchStatus=Match Saved')
    },
  ] : [
    { 
      icon: Palette, 
      text: "Add new Color",
      dropdownItems: [
        
        { icon: PlusCircle, text: "Import from CXF", onClick: handleAddCxfClick },
        { icon: FileText, text: "Import from CGATS", onClick: handleAddCgatsClick },
      ]
    },
    { 
      icon: Briefcase, 
      text: "Request New Matches", 
      onClick: () => setShowMatchRequestDialog(true)
    },
    { 
      icon: CheckCircle2, 
      text: "Approve Matches", 
      onClick: () => navigate('/color-matches?jobStatus=Ready for Approval')
    },
  ];

  // Format color count display - just show total without shared info
  const formatColorCount = () => {
    
    return counts.colors;
  };

  // Hide Shared Colors card for brand organizations
  const isBrandOwner = profile?.organization?.type?.includes('Brand Owner');
  const sharedColorsCount = derivedSharedCount ?? 0;
  const totalColorsWithShared = counts.colors + sharedColorsCount;
  
  // Show spinner for shared colors while loading
  const sharedColorsDisplay = colorsLoading ? (
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  ) : (
    sharedColorsCount
  );
  
  const baseStats = [
    { title: "Total Colors", value: totalColorsWithShared, icon: Palette, onClick: () => navigate('/colors') },
    { title: "Total Matching Jobs", value: counts.jobs, icon: Briefcase, onClick: () => navigate('/color-matches') },
    { title: "Overdue Matching jobs", value: counts.overdue, icon: AlertTriangle, valueColor: "text-red-500", onClick: () => navigate('/color-matches?jobStatus=Overdue') },
  ];
  
  const stats = isBrandOwner 
    ? baseStats 
    : [
        ...baseStats.slice(0, 1),
        { title: "Shared Colors", value: sharedColorsDisplay, icon: Share2 },
        ...baseStats.slice(1)
      ];

  const { processedNotifications, dismiss } = useNotifications();
  
  // Re-enable activity feed with error handling
  let activities = [];
  try {
    const activityData = useActivityData();
    activities = activityData.activities || [];
  } catch (error) {
    console.warn('Dashboard: useActivityData failed:', error);
    activities = [];
  }

  // Get the last 4 activities for the dashboard with proper field mapping
  const recentActivities = useMemo(() => {
    return activities.slice(0, 4).map(activity => ({
      description: activity.activity, // Map activity to description
      action: activity.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Activity',
      user: activity.user,
      company: activity.company,
      details: activity.details || (activity.receiver !== '-' ? `To: ${activity.receiver}` : ''),
      date: activity.date,
    }));
  }, [activities]);

  return (
    <>
      <Helmet>
        <title>Matching Dashboard - Overview</title>
        <meta name="description" content="Dashboard overview with system status and quick actions." />
      </Helmet>
      <div className="flex flex-col h-full px-6 pt-6 space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Hi {firstName}.</h1>
              <p className="text-lg text-gray-600">Here is your color matching job info at a glance.</p>
            </div>
            {isSuperadmin && (
              <Button
                variant={weightingToolsEnabled ? "default" : "outline"}
                onClick={toggleWeightingTools}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {weightingToolsEnabled ? "Hide Weighting Card" : "Show Weighting Card"}
              </Button>
            )}
          </div>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {actionButtons.map((btn, index) => (
            <ActionButton 
              key={index} 
              icon={btn.icon} 
              text={btn.text} 
              onClick={btn.onClick} 
              dropdownItems={btn.dropdownItems}
            />
          ))}
        </motion.div>

        <motion.div 
          className={`grid gap-6 ${stats.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {stats.map((stat, index) => (
            <DashboardStatCard key={index} {...stat} />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
            <Notifications />
        </motion.div>

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
        >
            <h2 className="text-xl font-medium text-gray-600 mb-4">Recent Activity</h2>
            <RecentActivityTable activities={recentActivities} />
        </motion.div>
        
      </div>


      <AlertDialog open={showMatchRequestDialog} onOpenChange={setShowMatchRequestDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request New Matches</AlertDialogTitle>
            <AlertDialogDescription>
              Let's get matching! The page will now switch to the Colors view where you can select a set of colors to be matched. Once your colors are selected, click the <strong>Request Color Match</strong> button to start the Match Request Wizard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/colors')}>
              Let's Go!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden file inputs for import */}
      <input
        type="file"
        ref={cxfFileInputRef}
        style={{ display: 'none' }}
        accept=".cxf"
        onChange={handleCxfFileChange}
      />
      <input
        type="file"
        ref={cgatsFileInputRef}
        style={{ display: 'none' }}
        accept=".txt"
        onChange={handleCgatsFileChange}
      />

      {/* Import progress dialogs - Unified large file warning */}
      <LargeFileWarningDialog
        isOpen={cgatsShowLargeFileWarning || isCgatsLoading || isCgatsTransforming}
        fileMetadata={cgatsFileMetadata}
        currentStage={
          isCgatsLoading && cgatsProcessingStage === 'reading' ? 'reading' :
          isCgatsTransforming || cgatsProcessingStage === 'parsing' ? 'parsing' :
          null
        }
        progress={null}
      />
      <LargeFileWarningDialog
        isOpen={
          cxfParseProgress?.stage && 
          cxfParseProgress.stage !== 'complete'
        }
        fileMetadata={cxfFileMetadata}
        currentStage={
          cxfParseProgress?.stage === 'parsing' ? 'parsing' :
          isCxfTransforming ? 'transforming' :
          'reading'
        }
        progress={cxfParseProgress?.progress}
      />

      {/* Import dialogs */}
      <CxfAddColorDialog
        isOpen={isCxfAddOpen}
        setIsOpen={setIsCxfAddOpen}
        cxfColors={cxfColors}
        onAddColors={handleDataChanged}
        onRefresh={handleDataChanged}
        diagnostics={null}
        onCancel={resetCxfImportState}
      />
      <CxfAddColorDialog
        isOpen={isCgatsAddOpen}
        setIsOpen={setIsCgatsAddOpen}
        cxfColors={cgatsColors}
        onAddColors={handleAddColorsFromCgats}
        onRefresh={handleDataChanged}
        importSource="cgats"
      />
    </>
  );
};
export default MatchingDashboard;

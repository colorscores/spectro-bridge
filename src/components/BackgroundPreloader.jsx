import React, { useEffect, useRef } from 'react';

// List of all lazy-loaded components to preload
const PRELOAD_COMPONENTS = [
  () => import('@/pages/Dashboard'),
  () => import('@/pages/AssetDashboard'),
  () => import('@/pages/BrandColors'),
  () => import('@/pages/Printers'),
  () => import('@/pages/PrinterDetail'),
  () => import('@/pages/PrinterConditionDetail'),
  () => import('@/pages/Inks'),
  () => import('@/pages/InkDetail'),
  () => import('@/pages/InkConditionDetail'),
  () => import('@/pages/ColorDetail'),
  
  () => import('@/pages/ColorMatchDetail'),
  () => import('@/pages/Matching'),
  () => import('@/pages/QualitySets'),
  () => import('@/pages/QualitySetDetail'),
  () => import('@/pages/Activity'),
  () => import('@/pages/Curves'),
  () => import('@/pages/Characterizations'),
  () => import('@/pages/Profiles'),
  () => import('@/pages/Integrations'),
  () => import('@/pages/Substrates'),
  () => import('@/pages/SubstrateDetail'),
  () => import('@/pages/SubstrateConditionDetail'),
  () => import('@/pages/admin/Partners'),
  () => import('@/pages/admin/MyCompany'),
  () => import('@/pages/admin/Users'),
  () => import('@/pages/admin/Organizations'),
  () => import('@/pages/admin/OrganizationDetail'),
  () => import('@/pages/admin/AdminDashboard'),
  () => import('@/pages/MyProfile'),
  () => import('@/pages/Testcharts'),
  () => import('@/pages/TestchartDetail'),
  () => import('@/pages/DataMigration'),
  () => import('@/pages/SynthesizeColors'),
  () => import('@/pages/PrintConditions'),
  () => import('@/pages/PrintConditionDetail'),
  () => import('@/pages/ColorMatchAnalysis'),
];

const BackgroundPreloader = () => {
  const preloadedRef = useRef(new Set());
  const isPreloadingRef = useRef(false);

  useEffect(() => {
    const startPreloading = async () => {
      // Only start preloading once
      if (isPreloadingRef.current) return;
      isPreloadingRef.current = true;

      // Wait for initial render to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('🚀 Background preloader: Starting component preload');

      // Preload components one by one with small delays
      for (let i = 0; i < PRELOAD_COMPONENTS.length; i++) {
        const componentLoader = PRELOAD_COMPONENTS[i];
        
        try {
          // Use requestIdleCallback if available, otherwise setTimeout
          const schedulePreload = () => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(async () => {
                try {
                  await componentLoader();
                  preloadedRef.current.add(i);
                } catch (err) {
                  console.warn('Background preloader: component preload failed', err);
                }
              });
            } else {
              setTimeout(async () => {
                try {
                  await componentLoader();
                  preloadedRef.current.add(i);
                } catch (err) {
                  console.warn('Background preloader: component preload failed', err);
                }
              }, 0);
            }
          };

          schedulePreload();

          // Small delay between each component to avoid overwhelming the browser
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.warn(`Background preloader: Failed to preload component ${i}:`, error);
        }
      }

      console.log('🚀 Background preloader: All components queued for preload');
      
      // After components are preloaded, trigger color views computation
      // Wait for the color-views-ready event to confirm computation is complete
      console.log('🎨 Background preloader: Waiting for color views computation');
    };

    startPreloading();
  }, []);

  // This component renders nothing, it just runs the preloading logic
  return null;
};

export default BackgroundPreloader;
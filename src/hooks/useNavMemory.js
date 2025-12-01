import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';

const navConfig = {
    matching: [
        { path: '/dashboard' },
        { path: '/colors' },
        { path: '/color-matches' },
        { path: '/print-conditions' },
        { path: '/quality-sets' },
        { path: '/activity' },
    ],
    admin: [
        { path: '/admin/dashboard' },
        { path: '/admin/my-company' },
        { path: '/admin/users' },
        { path: '/admin/organizations' },
        { path: '/admin/partners' },
        { path: '/admin/integrations' },
    ],
    assets: [
        { path: '/assets/dashboard' },
        { path: '/assets/printers' },
        { path: '/assets/inks' },
        { path: '/assets/substrates' },
        { path: '/assets/testcharts' },
        { path: '/assets/curves' },
        { path: '/assets/characterizations' },
        { path: '/assets/profiles' },
    ],
};

// Dashboard paths for each nav group (first visit destination)
const dashboardPaths = {
    matching: '/dashboard',
    admin: '/admin/dashboard',
    assets: '/assets/dashboard',
};

// Session storage key for tracking visited nav groups
const VISITED_GROUPS_KEY = 'nav_visited_groups';

// Get visited groups from session storage
const getVisitedGroups = () => {
    try {
        const visited = sessionStorage.getItem(VISITED_GROUPS_KEY);
        return visited ? JSON.parse(visited) : [];
    } catch {
        return [];
    }
};

// Mark a nav group as visited in this session
const markGroupAsVisited = (group) => {
    try {
        const visited = getVisitedGroups();
        if (!visited.includes(group)) {
            visited.push(group);
            sessionStorage.setItem(VISITED_GROUPS_KEY, JSON.stringify(visited));
        }
    } catch {
        // Silently fail if sessionStorage is unavailable
    }
};

// Transient routes that should not be remembered in navigation
const transientRoutes = [
  '/match-request/new',
  '/match-request/wizard',
];

const whichGroupForPath = (path) => {
  if (!path) return null;
  for (const [group, items] of Object.entries(navConfig)) {
    if (items.some(i => path.startsWith(i.path))) return group;
  }
  return null;
};

// Check if a path is valid for a specific group
const isValidPathForGroup = (path, group) => {
  if (!path || !group || !navConfig[group]) return false;
  return navConfig[group].some(item => path.startsWith(item.path));
};

export const useNavMemory = () => {
  const { appMode, setAppMode, navGroupSelections, setNavGroupSelections } = useAppContext();
  
  // Guard against router context not being available
  let navigate, location;
  try {
    navigate = useNavigate();
    location = useLocation();
  } catch (error) {
    console.warn('Router context not available in useNavMemory:', error);
    return { updateLastVisited: () => {}, clearWizardFromNavMemory: () => {} };
  }
  
  const isInitialMount = useRef(true);
  const prevAppMode = useRef(appMode);

  useEffect(() => {
    console.log('🧭 useNavMemory effect triggered:', {
      isInitialMount: isInitialMount.current,
      appModeChanged: prevAppMode.current !== appMode,
      currentAppMode: appMode,
      previousAppMode: prevAppMode.current,
      currentPath: location.pathname,
      navGroupSelections
    });

    if (isInitialMount.current || prevAppMode.current !== appMode) {
      const visitedGroups = getVisitedGroups();

      // Fresh session guard: if landing on dashboard with no visited groups, enforce matching mode
      const isFreshSession = visitedGroups.length === 0;
      const isOnMatchingDashboard = location.pathname === '/dashboard';
      if (isFreshSession && isOnMatchingDashboard && appMode !== 'matching') {
        console.log('🎯 Fresh session on dashboard detected. Forcing appMode to matching.');
        setAppMode('matching');
        return; // wait for appMode update
      }

      const isFirstVisitToGroup = !visitedGroups.includes(appMode);
      const lastSelectedPath = navGroupSelections[appMode];
      const isValidStoredPath = isValidPathForGroup(lastSelectedPath, appMode);
      
      console.log('🎯 Navigation decision factors:', {
        visitedGroups,
        isFirstVisitToGroup,
        lastSelectedPath,
        isValidStoredPath,
        appMode
      });
      
      // Determine target path: dashboard for first visit, then memory, then fallback to first config item
      let targetPath;
      if (isFirstVisitToGroup) {
        targetPath = dashboardPaths[appMode];
        console.log('📍 First visit to group, targeting dashboard:', targetPath);
      } else {
        targetPath = isValidStoredPath ? lastSelectedPath : navConfig[appMode]?.[0]?.path;
        console.log('🔄 Returning visitor, targeting stored/fallback path:', targetPath);
      }

      // Check if current path is a transient route that shouldn't be redirected
      const isOnTransientRoute = transientRoutes.some(route => location.pathname.includes(route));
      
      // Check if we're already on a valid path within this group (prevents redirect from deep routes)
      const currentGroup = whichGroupForPath(location.pathname);
      const isCurrentPathValidForGroup = currentGroup === appMode && isValidPathForGroup(location.pathname, appMode);

      console.log('🚦 Navigation guards:', {
        isOnTransientRoute,
        currentGroup,
        isCurrentPathValidForGroup,
        shouldNavigate: targetPath && location.pathname !== targetPath && !isOnTransientRoute && !isCurrentPathValidForGroup
      });


      if (targetPath && location.pathname !== targetPath && !isOnTransientRoute && !isCurrentPathValidForGroup) {
        console.log('🚀 Navigating from', location.pathname, 'to', targetPath, 'for appMode:', appMode);
        
        // Parse targetPath to preserve its existing search params
        const url = new URL(targetPath, window.location.origin);
        // Only add location search/hash if targetPath doesn't already have them
        if (!url.search && location.search) {
          url.search = location.search;
        }
        if (!url.hash && location.hash) {
          url.hash = location.hash;
        }
        const targetWithParams = url.pathname + url.search + url.hash;
        
        navigate(targetWithParams);
        
        // Mark the nav group as visited after navigation is initiated
        markGroupAsVisited(appMode);
        console.log('✅ Navigation initiated and group marked as visited:', appMode);
      } else {
        console.log('⏸️ Navigation skipped for appMode', appMode, '- Reason:', {
          hasTargetPath: !!targetPath,
          alreadyOnTarget: location.pathname === targetPath,
          isTransient: isOnTransientRoute,
          currentPathValidForGroup: isCurrentPathValidForGroup,
          currentPath: location.pathname,
          targetPath
        });
        
        // If we're already on a valid path for this group AND it's the first visit, mark it as visited
        // This handles the case where user lands directly on a valid deep route
        if (isCurrentPathValidForGroup && isFirstVisitToGroup) {
          markGroupAsVisited(appMode);
          console.log('✅ Group marked as visited for current valid path (first visit):', appMode);
        }
      }
      
      isInitialMount.current = false;
      prevAppMode.current = appMode;
    }
  }, [appMode, navigate, navGroupSelections, location.pathname, location.search, location.hash]);

  const updateLastVisited = (path) => {
    // Don't store transient routes in navigation memory
    if (transientRoutes.some(route => path.includes(route))) {
      console.log('🚫 Skipping transient route storage:', path);
      return;
    }
    
    const group = whichGroupForPath(path);
    // Only store if path is valid for the determined group
    if (group && isValidPathForGroup(path, group) && navGroupSelections?.[group] !== path) {
      console.log('💾 Storing navigation memory for group', group, ':', path);
      setNavGroupSelections(prev => ({
        ...prev,
        [group]: path,
      }));
    } else {
      console.log('⏭️ Skipping navigation storage:', { group, path, isValid: isValidPathForGroup(path, group), alreadyStored: navGroupSelections?.[group] === path });
    }
  };

  const clearWizardFromNavMemory = () => {
    // Reset matching mode to a safe default when closing wizard
    if (navGroupSelections?.matching === '/match-request/new') {
      setNavGroupSelections(prev => ({
        ...prev,
        matching: '/color-matches',
      }));
    }
  };

  return { updateLastVisited, clearWizardFromNavMemory };
};
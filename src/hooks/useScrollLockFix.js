import { useEffect, useCallback } from 'react';

export const useScrollLockFix = (dialogStates = {}) => {
  // Force unlock scroll by removing any scroll lock classes/styles
  const forceUnlockScroll = useCallback(() => {
    // Remove any data attributes that might be causing scroll locks
    document.body.removeAttribute('data-scroll-locked');
    document.documentElement.removeAttribute('data-scroll-locked');
    
    // Remove overflow hidden that might be stuck
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    // Remove any classes that might be locking scroll
    document.body.classList.remove('overflow-hidden', 'scroll-locked');
    document.documentElement.classList.remove('overflow-hidden', 'scroll-locked');
    
    // Force scroll to work
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    
    console.log('🔓 Forced scroll unlock executed');
  }, []);

  // Monitor dialog states and cleanup when all are closed
  useEffect(() => {
    const allDialogsClosed = Object.values(dialogStates).every(state => !state);
    
    if (allDialogsClosed) {
      // Small delay to ensure Radix cleanup has completed
      const timer = setTimeout(() => {
        forceUnlockScroll();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [dialogStates, forceUnlockScroll]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      forceUnlockScroll();
    };
  }, [forceUnlockScroll]);

  // Debug logging for dialog state changes
  useEffect(() => {
    const dialogNames = Object.keys(dialogStates);
    const openDialogs = dialogNames.filter(name => dialogStates[name]);
    
    if (openDialogs.length > 0) {
      console.log('📋 Open dialogs:', openDialogs);
    }
  }, [dialogStates]);

  return { forceUnlockScroll };
};
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

const ScrollResetButton = ({ onResetScroll }) => {
  const [isStuck, setIsStuck] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    let timeoutId;
    
    const checkScrollLock = () => {
      const isBodyLocked = document.body.style.overflow === 'hidden' || 
                          document.body.classList.contains('overflow-hidden') ||
                          document.body.hasAttribute('data-scroll-locked');
      
      const isHtmlLocked = document.documentElement.style.overflow === 'hidden' ||
                          document.documentElement.classList.contains('overflow-hidden') ||
                          document.documentElement.hasAttribute('data-scroll-locked');
      
      const scrollLocked = isBodyLocked || isHtmlLocked;
      
      if (scrollLocked && !isStuck) {
        // If scroll has been locked for more than 2 seconds, show reset button
        timeoutId = setTimeout(() => {
          setIsStuck(true);
          setShowButton(true);
          console.log('🚨 Scroll lock detected - showing reset button');
        }, 2000);
      } else if (!scrollLocked && isStuck) {
        setIsStuck(false);
        setShowButton(false);
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    // Check immediately and then every 500ms
    checkScrollLock();
    const interval = setInterval(checkScrollLock, 500);

    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isStuck]);

  const handleReset = () => {
    onResetScroll();
    setIsStuck(false);
    setShowButton(false);
  };

  if (!showButton) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-pulse">
      <Button
        onClick={handleReset}
        variant="destructive"
        size="sm"
        className="shadow-lg border-2 border-white"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset Scroll
      </Button>
    </div>
  );
};

export default ScrollResetButton;
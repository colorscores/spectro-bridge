// Utility functions for color-related operations

// Map numeric printing channels to readable channel names
export const getChannelName = (printingChannels) => {
  const channelMap = {
    1: 'K',
    2: 'GS', // Grayscale
    3: 'RGB',
    4: 'CMYK',
    5: 'CMYK+',
    6: 'CMYK+2',
    7: 'CMYK+3',
    8: 'CMYK+4'
  };
  
  return channelMap[printingChannels] || `${printingChannels}-channel`;
};

// Format patch count with proper pluralization
export const formatPatchCount = (count) => {
  if (!count) return '0 patches';
  return `${count} ${count === 1 ? 'patch' : 'patches'}`;
};
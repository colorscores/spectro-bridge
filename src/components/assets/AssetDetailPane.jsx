import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const DetailRow = ({ label, value, children }) => (
  <div className="flex justify-between items-center py-3 border-b border-gray-200">
    <span className="text-sm text-gray-500">{label}</span>
    {value && <span className="text-sm font-medium text-gray-800 text-right">{value}</span>}
    {children}
  </div>
);

const AssetDetailPane = ({ asset, onClose, assetType }) => {
  if (!asset) return null;

  const showToast = () => {
    toast({
      title: "🚧 Feature not implemented",
      description: "This feature is coming soon!",
    });
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-[360px] bg-white border-l border-gray-200 flex flex-col h-full"
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{asset.name}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-5 w-5 text-gray-500" />
        </Button>
      </div>
      <div className="p-4 flex-grow overflow-y-auto">
        {asset.hex && (
          <div 
            className="w-full h-32 rounded-lg mb-4"
            style={{ backgroundColor: asset.hex }}
          />
        )}
        <div className="space-y-1">
          <DetailRow label="Asset Type" value={asset.assetType || assetType} />
          <DetailRow label="Matches" value={String(asset.matches || 0)} />
          <DetailRow label="Tags">
            <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
              {asset.tags.map(tag => (
                <span key={tag} className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-md border border-gray-200">{tag}</span>
              ))}
            </div>
          </DetailRow>
          <DetailRow label="Created On" value={asset.createdOn ? asset.createdOn.replace(/-/g, '.') : 'N/A'} />
          <DetailRow label="Created By" value={asset.createdBy || 'N/A'} />
          <DetailRow label="Last Edited By" value={asset.lastEditedBy || 'N/A'} />
        </div>
      </div>
      <div className="p-4 border-t border-gray-200">
        <Button className="w-full" onClick={showToast}>
          View Details
        </Button>
      </div>
    </motion.div>
  );
};

export default AssetDetailPane;
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Layers, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getSubstrateIconColor, labToHexD65 } from '@/lib/colorUtils';

const DetailItem = ({ label, value }) => (
  <div className="mb-4">
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="text-base text-gray-800">{value || 'N/A'}</p>
  </div>
);

const SubstrateDetailPane = ({ item, onClose }) => {
  const navigate = useNavigate();
  
  if (!item) return null;

  const isCondition = !!item.substrate_id;
  const navigateUrl = isCondition
    ? `/assets/substrates/${item.substrate_id}/conditions/${item.id}`
    : `/assets/substrates/${item.id}`;
  const title = item.name;

  const displayColor = (() => {
    if (item.substrate_id) {
      // Condition
      return item.color_hex
        || (item.lab ? labToHexD65(item.lab.L, item.lab.a, item.lab.b) : null)
        || '#f3f4f6';
    } else {
      // Substrate: use first condition color if available
      const first = item.conditions?.[0];
      return first?.color_hex
        || (first?.lab ? labToHexD65(first.lab.L, first.lab.a, first.lab.b) : null)
        || (item.color || '#f3f4f6');
    }
  })();
  const iconColorClass = getSubstrateIconColor(displayColor);

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-white border rounded-lg shadow-sm h-full flex flex-col overflow-hidden"
    >
      <div className="flex-shrink-0 h-20 p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md" style={{ backgroundColor: displayColor }}>
            {isCondition ? 
              (<div className="w-6 h-6 rounded-full border border-gray-300" style={{backgroundColor: displayColor}}></div>) :
              (<Layers className={`h-6 w-6 ${iconColorClass}`} />)
            }
          </div>
          <h2 className="text-lg font-semibold text-gray-800 truncate">{title}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-6 space-y-4">
          {isCondition ? (
            <>
              {/* Large color block at the top */}
              <div className="w-full h-24 rounded-lg border-2 border-gray-200 mb-6" 
                   style={{ backgroundColor: displayColor }}>
              </div>
              
              <DetailItem label="Description" value={item.description} />
              <DetailItem label="Pack Type" value={item.pack_type ? <Badge variant="secondary">{item.pack_type}</Badge> : 'N/A'} />
              <div className="flex items-center gap-4">
                <DetailItem label="Color" value={displayColor} />
                <div className="w-10 h-10 rounded-md border" style={{ backgroundColor: displayColor }}></div>
              </div>
              {/* Lab values not computed without spectral weighting; kept minimal for speed */}
            </>
          ) : (
            <>
              <DetailItem label="Printing Side" value={item.printing_side ? item.printing_side.charAt(0).toUpperCase() + item.printing_side.slice(1) : 'N/A'} />
              <DetailItem label="Use White Ink" value={item.use_white_ink ? 'Yes' : 'No'} />
              <DetailItem 
                label="Contrast" 
                value={
                  item.contrast === 'medium' 
                    ? 'Medium (default)' 
                    : item.contrast 
                      ? item.contrast.charAt(0).toUpperCase() + item.contrast.slice(1)
                      : 'Medium (default)'
                } 
              />
              <DetailItem 
                label="Ink Adhesion" 
                value={
                  item.ink_adhesion === 100 
                    ? '100% (default)' 
                    : item.ink_adhesion === 69
                      ? '<70%'
                      : item.ink_adhesion 
                        ? `${item.ink_adhesion}%` 
                        : '100% (default)'
                } 
              />
              
              {(item.manufacturer || item.product_name || item.weight || item.thickness) && (
                <>
                  <h3 className="text-md font-semibold text-gray-700 mb-2 mt-6">Specifications</h3>
                  {item.manufacturer && <DetailItem label="Manufacturer" value={item.manufacturer} />}
                  {item.product_name && <DetailItem label="Product Name" value={item.product_name} />}
                  {item.weight && <DetailItem label="Weight" value={`${item.weight} GSM`} />}
                  {item.thickness && <DetailItem label="Thickness" value={`${item.thickness} ${item.thickness_unit || 'mil'}`} />}
                </>
              )}
              
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-2 mt-6">Conditions</h3>
                {item.conditions && item.conditions.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {item.conditions.map(condition => (
                      <li key={condition.id}>{condition.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No conditions defined for this substrate.</p>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
        <Button className="w-full" onClick={() => navigate(navigateUrl)}>
          <Edit className="mr-2 h-4 w-4" /> View Details
        </Button>
      </div>
    </motion.div>
  );
};

export default SubstrateDetailPane;
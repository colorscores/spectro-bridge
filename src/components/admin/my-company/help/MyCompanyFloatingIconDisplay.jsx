import React from 'react';
import { motion } from 'framer-motion';
import { 
  Lock, Shield, Star, Crown, 
  Factory, Printer, Palette, Users,
  Settings, Sun, Eye, Grid,
  MapPin, Plus, Edit, Trash,
  Tags, FolderOpen,
  Library, Zap, Target, Paintbrush
} from 'lucide-react';

// Icon mapping for different groups and features
const iconMap = {
  // Licensing icons
  "Library License": Library,
  "Printer Kiosk License": Printer,
  "Match Pack License": Target,
  "Create Pack": Paintbrush,
  
  // Sharing Tags icons  
  "Categories": FolderOpen,
  "Tags": Tags,
  
  // Default Color Settings icons
  "Mode": Settings,
  "Illuminant": Sun,
  "Observer": Eye,
  "Table": Grid,
  "ΔE Method": Zap,
  
  // Organization Roles icons
  "Available Role Types": Users,
  "Brand Owner": Crown,
  "Print Supplier": Factory,
  "Premedia Agency": Palette,
  "Design Agency": Paintbrush,
  "Vendor": Shield,
  "Ink Supplier": Zap,
  
  // Locations icons
  "Location Management": MapPin,
  "Add Location": Plus,
  "Edit Location": Edit,
  "Delete Location": Trash
};

const MyCompanyFloatingIconDisplay = ({ features, selectedFeatureIndex, onFeatureSelect, groupName }) => {

  return (
    <div className="relative">
      {/* Icon Row */}
      <div className="flex items-center justify-center gap-6 overflow-x-auto pb-4 relative">
        {features.map((feature, index) => {
          const IconComponent = iconMap[feature.name] || Settings;
          const isSelected = index === selectedFeatureIndex;
          
          return (
            <div key={index} className="relative flex-shrink-0">
              {/* Icon */}
              <button
                className={`relative w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all duration-200 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  isSelected 
                    ? 'border-primary/20 bg-primary/5 text-primary' 
                    : 'border-muted bg-background text-muted-foreground hover:border-primary/50 hover:text-primary/70'
                }`}
                onClick={() => onFeatureSelect(index)}
              >
                {/* Focus Highlight - anchored to button */}
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none z-10 border-4 border-primary rounded-lg animate-pulse"
                    style={{ 
                      boxShadow: '0 0 0 4px hsl(var(--primary) / 0.2), 0 0 20px hsl(var(--primary) / 0.4)' 
                    }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 300, 
                      damping: 20,
                      duration: 0.4 
                    }}
                  />
                )}
                <IconComponent size={24} />
              </button>
            </div>
          );
        })}
      </div>
      
      {/* Selected Feature Name */}
      <div className="text-center mt-4">
        <h4 className="text-lg font-semibold text-foreground">
          {features[selectedFeatureIndex]?.name}
        </h4>
        <p className="text-sm text-muted-foreground mt-1">
          {features[selectedFeatureIndex]?.description}
        </p>
      </div>
    </div>
  );
};

export default MyCompanyFloatingIconDisplay;
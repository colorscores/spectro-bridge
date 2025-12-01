import React from 'react';
import { motion } from 'framer-motion';
import { 
  Pencil, Tag, Shuffle, Book, Copy, Layers, Trash, Download,
  Search, Filter, List, GitBranch
} from 'lucide-react';

// Icon mapping for each feature
const iconMap = {
  // Color Tools
  "Edit Tool": Pencil,
  "Tag Tool": Tag,
  "Change Type": Shuffle,
  "Add to Book": Book,
  "Remove Duplicates": Copy,
  "Merge Modes": Layers,
  "Delete": Trash,
  "Export": Download,
  
  // Search & Filter
  "Search Bar": Search,
  "Advanced Filter": Filter,
  "Filter by Tags": Tag,
  "Filter by Standard Type": Shuffle,
  "Filter by Date": Filter,
  "Filter by Owner": Filter,
  "Filter by Sharing": Filter,
  
  // Color Views
  "Flat View": List,
  "Book View": Book,
  "Dependent View": GitBranch,
  "Color Detail Pane": List,
  "Selection System": List,
  "Sorting Options": List
};

const FloatingIconDisplay = ({ features, selectedFeatureIndex, onFeatureSelect }) => {
  return (
    <div className="relative py-8">
      {/* Icon Row */}
      <div className="flex items-center justify-center gap-6 mb-8">
        {features.map((feature, index) => {
          const IconComponent = iconMap[feature.name];
          const isSelected = index === selectedFeatureIndex;
          
          return (
            <div key={index} className="relative">
              {/* Focus Circle */}
              {isSelected && (
                <motion.div
                  layoutId="focus-circle"
                  className="absolute inset-0 rounded-full border-4 border-primary"
                  style={{
                    boxShadow: '0 0 0 4px hsl(var(--primary) / 0.2), 0 0 20px hsl(var(--primary) / 0.4)'
                  }}
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25
                  }}
                />
              )}
              
              {/* Icon */}
              <button
                onClick={() => onFeatureSelect(index)}
                className={`
                  relative p-4 rounded-full transition-all duration-200
                  hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20
                  ${isSelected ? 'bg-primary/5' : ''}
                `}
              >
                {IconComponent && (
                  <IconComponent 
                    size={48} 
                    className={`
                      transition-colors duration-200
                      ${isSelected 
                        ? 'text-primary' 
                        : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
      
      {/* Selected Feature Name */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-semibold text-primary">
          {features[selectedFeatureIndex]?.name}
        </h3>
      </div>
    </div>
  );
};

export default FloatingIconDisplay;
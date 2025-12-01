import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const ConstructionLayer = ({ label, bgColor, textColor = 'black', bold = false, className = '' }) => {
    const isTransparent = bgColor === 'transparent';
    const displayBgColor = isTransparent ? 'transparent' : bgColor;
    const borderStyle = isTransparent ? 'border border-gray-600' : 'border border-gray-400';
    
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className={cn('text-center text-xs py-1 overflow-hidden', borderStyle, bold && 'font-bold', className)}
            style={{ backgroundColor: displayBgColor }}
        >
            <span style={{ color: textColor }}>{label}</span>
        </motion.div>
    );
};

const Spacer = () => (
    <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="h-4"
    />
);

const LayerVisualization = ({ 
    printSide, 
    useWhiteInk, 
    varnish, 
    laminate,
    baseSubstrate,
    isMetallic,
    className = ''
}) => {
    
    // Create layers array based on print side and selected options (top to bottom order)
    const createLayers = () => {
        const layers = [];
        
        if (printSide === 'surface') {
            // Surface printing: Top to bottom (positions 1-6)
            // Position 1: Varnish (conditional)
            if (varnish) {
                layers.push({
                    key: 'varnish',
                    label: 'Varnish',
                    bgColor: 'transparent',
                    textColor: 'black'
                });
            }
            
            // Position 2: Laminate (conditional)
            if (laminate) {
                layers.push({
                    key: 'laminate',
                    label: 'Laminate',
                    bgColor: '#F3F4F6',
                    textColor: 'black'
                });
            }
            
            // Position 3: Space (always present)
            layers.push({
                key: 'spacer',
                type: 'spacer'
            });
            
            // Position 4: Ink (always present)
            layers.push({
                key: 'ink',
                label: 'Ink',
                bgColor: '#000000',
                textColor: 'white',
                bold: true
            });
            
            // Position 5: White Ink (conditional)
            if (useWhiteInk) {
                layers.push({
                    key: 'white-ink',
                    label: 'White Ink',
                    bgColor: '#FFFFFF',
                    textColor: 'black',
                    bold: true
                });
            }
            
            // Position 6: Substrate (always present)
            layers.push({
                key: 'substrate',
                label: isMetallic ? 'Metallic Substrate' : 'Substrate',
                bgColor: isMetallic ? '#C0C0C0' : '#D1D5DB',
                textColor: 'black'
            });
        } else {
            // Reverse printing: Top to bottom (positions 1-6)
            // Position 1: Varnish (conditional)
            if (varnish) {
                layers.push({
                    key: 'varnish',
                    label: 'Varnish',
                    bgColor: 'transparent',
                    textColor: 'black'
                });
            }
            
            // Position 2: Substrate (always present, never metallic in reverse mode)
            layers.push({
                key: 'substrate',
                label: 'Substrate',
                bgColor: '#D1D5DB',
                textColor: 'black'
            });
            
            // Position 3: Ink (always present)
            layers.push({
                key: 'ink',
                label: 'Ink',
                bgColor: '#000000',
                textColor: 'white',
                bold: true
            });
            
            // Position 4: White Ink (conditional)
            if (useWhiteInk) {
                layers.push({
                    key: 'white-ink',
                    label: 'White Ink',
                    bgColor: '#FFFFFF',
                    textColor: 'black',
                    bold: true
                });
            }
            
            // Position 5: Space (always present)
            layers.push({
                key: 'spacer',
                type: 'spacer'
            });
            
            // Position 6: Base Substrate (conditional, can be metallic in reverse mode)
            if (baseSubstrate) {
                layers.push({
                    key: 'base-substrate',
                    label: isMetallic ? 'Metallic Base Substrate' : 'Base Substrate',
                    bgColor: isMetallic ? '#C0C0C0' : '#F3F4F6',
                    textColor: 'black'
                });
            }
        }
        
        return layers;
    };
    
    const layers = createLayers();
    
    return (
        <div className={cn('w-full bg-gray-200 p-4 border border-gray-300 flex flex-col justify-center h-48 space-y-[-1px]', className)}>
            <AnimatePresence>
                {layers.map((layer) => (
                    <motion.div
                        key={layer.key}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.3 }}
                    >
                        {layer.type === 'spacer' ? (
                            <Spacer />
                        ) : (
                            <ConstructionLayer 
                                label={layer.label}
                                bgColor={layer.bgColor}
                                textColor={layer.textColor}
                                bold={layer.bold}
                            />
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default LayerVisualization;
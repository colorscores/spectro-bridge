import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const WizardStepper = ({ steps, currentStep }) => {
  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2">
      {/* First row: Circles and connecting lines */}
      <div className="flex items-center justify-center w-full">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center w-24">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 flex-shrink-0',
                  currentStep > step.id ? 'bg-blue-600 border-blue-600 text-white' : '',
                  currentStep === step.id ? 'border-blue-600 bg-white' : 'border-gray-300 bg-gray-100',
                )}
              >
                {currentStep > step.id ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <div className={cn(
                    'w-3 h-3 rounded-full transition-all duration-300',
                    currentStep === step.id ? 'bg-blue-600' : 'bg-gray-300'
                  )}></div>
                )}
              </div>
            </div>
            {/* Connecting line (if not last) */}
            {index < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2 transition-all duration-300',
                currentStep > index + 1 ? 'bg-blue-600' : 'bg-gray-300'
              )}></div>
            )}
          </React.Fragment>
        ))}
      </div>
      
      {/* Second row: Labels */}
      <div className="flex items-center justify-center w-full mt-2">
        {steps.map((step, index) => (
          <React.Fragment key={`label-${step.id}`}>
            <div className="flex flex-col items-center w-24">
              <p className={cn(
                'text-xs font-semibold text-center leading-tight',
                currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
              )}>
                {step.name}
              </p>
            </div>
            {/* Spacer for alignment with connecting lines */}
            {index < steps.length - 1 && (
              <div className="flex-1"></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default WizardStepper;
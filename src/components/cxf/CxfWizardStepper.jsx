import React from 'react';
import { Check, Circle } from 'lucide-react';

const CxfWizardStepper = ({ activeSteps, currentStep }) => {
  return (
    <div className="w-full mb-4 px-4 pt-2">
      {/* First row: Circles and connecting lines */}
      <div className="flex items-center justify-center w-full">
        {activeSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center w-24">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                  currentStep > step.id ? 'bg-blue-600 border-blue-600 text-white' : 
                  currentStep === step.id ? 'border-blue-600' : 'border-gray-300'
                }`}
              >
                {currentStep > step.id ? (
                  <Check size={16} />
                ) : (
                  <Circle 
                    size={12} 
                    className={currentStep === step.id ? 'text-blue-600' : 'text-gray-300'} 
                    fill={currentStep === step.id ? 'currentColor' : 'transparent'} 
                  />
                )}
              </div>
            </div>
            {/* Connecting line (if not last) */}
            {index < activeSteps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>
      
      {/* Second row: Labels */}
      <div className="flex items-center justify-center w-full mt-2">
        {activeSteps.map((step, index) => (
          <React.Fragment key={`label-${step.id}`}>
            <div className="flex flex-col items-center w-24">
              <p className={`text-sm text-center leading-tight ${currentStep >= step.id ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {step.name}
              </p>
            </div>
            {/* Spacer for alignment with connecting lines */}
            {index < activeSteps.length - 1 && (
              <div className="flex-1"></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default CxfWizardStepper;
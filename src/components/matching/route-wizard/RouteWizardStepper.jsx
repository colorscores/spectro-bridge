import React from 'react';
import { Check, Circle } from 'lucide-react';

const RouteWizardStepper = ({ currentStep }) => {
  const steps = ['Select Colors', 'Choose Partner'];
  return (
    <div className="w-full mb-8 px-4 pt-2">
      {/* First row: Circles and connecting lines */}
      <div className="flex items-center justify-center w-full">
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center w-24">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                  currentStep > index + 1 || currentStep === steps.length && index + 1 === steps.length
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : currentStep === index + 1
                    ? 'border-blue-600'
                    : 'border-gray-300'
                }`}
              >
                {currentStep > index + 1 || currentStep === steps.length && index + 1 === steps.length ? (
                  <Check size={16} />
                ) : (
                  <Circle 
                    size={12} 
                    className={currentStep === index + 1 ? 'text-blue-600' : 'text-gray-300'} 
                    fill={currentStep === index + 1 ? 'currentColor' : 'transparent'} 
                  />
                )}
              </div>
            </div>
            {/* Connecting line (if not last) */}
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${currentStep > index + 1 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>
      
      {/* Second row: Labels */}
      <div className="flex items-center justify-center w-full mt-2">
        {steps.map((step, index) => (
          <React.Fragment key={`label-${step}`}>
            <div className="flex flex-col items-center w-24">
              <p className={`text-sm text-center leading-tight ${currentStep >= index + 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {step}
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

export default RouteWizardStepper;
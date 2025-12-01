import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const Step3Summary = ({ formData, tags, categories }) => {
  const summaryTags = useMemo(() => {
    if (!tags || !categories) return [];
    return tags.filter(tag => formData.sharingTags.includes(tag.id)).map(tag => {
        const category = categories.find(c => c.id === tag.category_id);
        return { ...tag, categoryName: category?.name || 'Unknown' };
    });
  }, [formData.sharingTags, tags, categories]);

  return (
    <div className="space-y-6 max-w-lg mx-auto pt-8">
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b">
            <Label className="text-gray-500 font-normal">First Name</Label>
            <p className="font-medium text-gray-800">{formData.firstName}</p>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
            <Label className="text-gray-500 font-normal">Last Name</Label>
            <p className="font-medium text-gray-800">{formData.lastName}</p>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
            <Label className="text-gray-500 font-normal">Email</Label>
            <p className="font-medium text-gray-800">{formData.email}</p>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
            <Label className="text-gray-500 font-normal">Location</Label>
            <p className="font-medium text-gray-800">{formData.location} {formData.allowOtherLocations && <span className="text-gray-500 font-normal text-sm">(access to other locations)</span>}</p>
        </div>
        <div className="flex justify-between items-center pb-2 border-b">
            <Label className="text-gray-500 font-normal">Role</Label>
            <p className="font-medium text-gray-800">{formData.role}</p>
        </div>
        {formData.limitByTags && (
            <div className="flex justify-between items-start pt-2">
                <Label className="text-gray-500 font-normal mt-1">Sharing Tags</Label>
                <div className="flex flex-wrap gap-2 justify-end max-w-xs">
                    {summaryTags.length > 0 ? summaryTags.map(tag => (
                        <Badge key={tag.id} variant="secondary" className="bg-gray-100 text-gray-700 font-normal px-2 py-1">{tag.categoryName}: {tag.name}</Badge>
                    )) : <p className="text-gray-500 text-sm">No tags selected.</p>}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Step3Summary;
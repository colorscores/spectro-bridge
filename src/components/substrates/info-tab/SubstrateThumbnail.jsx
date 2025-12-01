import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';

const SubstrateThumbnail = ({
  selectedTypeId,
  selectedMaterialId,
  thumbnailUrl,
  isUploading,
  handleThumbnailUpload,
  getSelectedTypeName,
  getSelectedMaterialName,
}) => {
  const fileInputRef = useRef(null);

  return (
    <div className="relative aspect-square w-full h-full flex items-center justify-center bg-gray-100 border border-dashed rounded-lg p-4">
      {selectedTypeId && selectedMaterialId ? (
        <>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              className="max-w-full max-h-full object-contain"
              alt={`Thumbnail for ${getSelectedMaterialName()} ${getSelectedTypeName()}`}
            />
          ) : (
            <img
              className="max-w-full max-h-full object-contain"
              alt={`Clipart of ${getSelectedMaterialName()} ${getSelectedTypeName()}`}
              src="https://images.unsplash.com/photo-1659981358302-ffa186b4a815"
            />
          )}
          <Input
            id="thumbnail-upload"
            type="file"
            accept="image/bmp"
            ref={fileInputRef}
            onChange={handleThumbnailUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload Thumbnail
          </Button>
        </>
      ) : (
        <span className="text-muted-foreground text-center">Select type and material to see a preview</span>
      )}
    </div>
  );
};

export default SubstrateThumbnail;
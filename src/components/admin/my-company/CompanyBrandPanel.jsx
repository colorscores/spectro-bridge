import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Hash } from 'lucide-react';
import LogoCropEditor from './LogoCropEditor';
import { withLogoVersion } from '@/lib/logoUtils';

const PreviewBox = ({ image, scale, offset, setOffset, onSize }) => {
  const boxRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const [boxSize, setBoxSize] = useState(0);
  const fit = image && boxSize ? Math.min(boxSize / (image.naturalWidth || image.width || 1), boxSize / (image.naturalHeight || image.height || 1)) : 1;

  const onMouseDown = (e) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy });
  };
  const onMouseUp = () => setDragging(false);
  const onMouseLeave = () => setDragging(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mouseleave', onMouseLeave);
    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mouseleave', onMouseLeave);
    };
  });

  useEffect(() => {
    const resize = () => {
      if (boxRef.current) {
        const w = boxRef.current.clientWidth;
        setBoxSize(w);
        onSize?.(w);
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [onSize]);

  return (
    <div
      ref={boxRef}
      className="relative w-full aspect-square bg-muted/40 border border-muted rounded-lg overflow-hidden cursor-move"
      onMouseDown={onMouseDown}
      role="img"
      aria-label="Company logo preview area"
    >
      {image ? (
        <img
          src={image.src}
          alt="Logo being edited"
          className="select-none pointer-events-none"
          style={{
            position: 'absolute',
            left: `${offset.x}px`,
            top: `${offset.y}px`,
            transform: `scale(${scale * fit})`,
            transformOrigin: 'top left',
            userSelect: 'none',
          }}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
          No image loaded
        </div>
      )}
    </div>
  );
};

const CompanyBrandPanel = ({ organization, setOrganization }) => {
  const [loading, setLoading] = useState(false);
  const [imgEl, setImgEl] = useState(null);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const hasLogo = !!organization?.logo_url;

  const STANDARD_LOGO_HEIGHT = 192;

  const companyCardRef = useRef(null);
  const [logoBoxSize, setLogoBoxSize] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (companyCardRef.current) {
        setLogoBoxSize(companyCardRef.current.offsetHeight);
      }
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined' && companyCardRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(companyCardRef.current);
    }
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      if (ro) ro.disconnect();
    };
  }, [organization]);


  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isBmp = /\.bmp$/i.test(file.name) || file.type === 'image/bmp';
    const isPng = /\.png$/i.test(file.name) || file.type === 'image/png';
    if (!isBmp && !isPng) {
      toast({ title: 'Invalid file type', description: 'Please select a BMP or PNG image.', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
    };
    img.onerror = () => toast({ title: 'Failed to load image', description: 'Please try another image file (BMP or PNG).', variant: 'destructive' });
    img.src = url;
  };

  const handleUpload = async (blob) => {
    if (!blob || !organization?.id) {
      toast({ title: 'No image to save', description: 'Load and crop an image (BMP or PNG) before saving.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const path = `${organization.id}/logo.png`;
      const { error: upErr } = await supabase.storage.from('org-logos').upload(path, blob, {
        upsert: true,
        contentType: 'image/png',
      });
      if (upErr) throw upErr;

      const { data: publicUrlData } = supabase.storage.from('org-logos').getPublicUrl(path);
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) throw new Error('Failed to get public URL');

      const { error: updErr } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', organization.id);
      if (updErr) throw updErr;

      const now = Date.now().toString();
      try { localStorage.setItem(`org-logo-version:${organization.id}`, now); } catch {}
      const versionedUrl = withLogoVersion(publicUrl, organization.id);
      setOrganization?.({ ...organization, logo_url: versionedUrl });
      window.dispatchEvent(new CustomEvent('org-logo-updated', { detail: versionedUrl }));
      toast({ title: 'Logo saved', description: 'Your company logo has been updated.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const currentPreviewImage = useMemo(() => {
    if (imgEl) return imgEl;
    if (hasLogo) {
      const img = new Image();
      img.src = withLogoVersion(organization.logo_url, organization.id);
      return img;
    }
    return null;
  }, [imgEl, hasLogo, organization?.logo_url]);

  return (
    <section>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-6">
        <Card ref={companyCardRef}>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Company</p>
              {organization ? (
                <p className="text-lg font-bold text-gray-800 truncate">{organization.name}</p>
              ) : (
                <Skeleton className="h-5 w-40" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <Hash className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Org ID</p>
              {organization ? (
                <p className="text-lg font-bold text-gray-800 truncate">{organization.id}</p>
              ) : (
                <Skeleton className="h-5 w-60" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:justify-self-end" style={{ width: logoBoxSize || undefined, height: logoBoxSize || undefined }}>
          <CardContent className="p-0 h-full">
            <div
              className="group relative w-full h-full mx-auto bg-muted/40 hover:bg-muted/60 border border-muted hover:border-muted-foreground/20 rounded-lg overflow-hidden cursor-pointer flex items-center justify-center transition-all duration-200 hover:shadow-md"
              onClick={() => setIsSelectOpen(true)}
              role="button"
              aria-label={hasLogo ? 'Edit company logo' : 'Add company logo'}
            >
              {hasLogo && (
                <img
                  src={withLogoVersion(organization.logo_url, organization.id)}
                  alt="Company logo"
                  className="w-full h-auto block group-hover:opacity-0 transition-opacity duration-200"
                  loading="lazy"
                />
              )}
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <span className={`text-sm text-muted-foreground ${hasLogo ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-200' : ''}`}>
                  {hasLogo ? 'Edit logo' : 'Add logo'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Select file */}
      <Dialog open={isSelectOpen} onOpenChange={setIsSelectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Logo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose a BMP or PNG image to upload as your company logo.</p>
            <input
              type="file"
              accept=".bmp,.png,image/bmp,image/png"
              onChange={(e) => {
                onFileChange(e);
                setIsSelectOpen(false);
                setIsEditorOpen(true);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editor */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Logo</DialogTitle>
          </DialogHeader>
          {currentPreviewImage ? (
            <LogoCropEditor
              image={currentPreviewImage}
              standardHeight={STANDARD_LOGO_HEIGHT}
              onCancel={() => { setIsEditorOpen(false); setImgEl(null); }}
              onSave={async (blob) => {
                await handleUpload(blob);
                setIsEditorOpen(false);
                setImgEl(null);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No image loaded.</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default CompanyBrandPanel;

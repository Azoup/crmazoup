import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useResolvedAvatar } from '@/components/ui/user-avatar';

interface ImageUploadProps {
  currentImage: string | null;
  onImageChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
}

export function ImageUpload({ 
  currentImage, 
  onImageChange, 
  bucket = 'avatars',
  folder 
}: ImageUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: 'Erro', 
        description: 'Por favor, selecione uma imagem válida', 
        variant: 'destructive' 
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: 'Erro', 
        description: 'Imagem muito grande. Máximo 5MB.', 
        variant: 'destructive' 
      });
      return;
    }

    setUploading(true);

    try {
      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${folder ? `${folder}/` : ''}${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      onImageChange(publicUrl);
      setPreview(publicUrl);
      
      toast({ title: 'Sucesso', description: 'Imagem enviada com sucesso!' });
    } catch (error) {
      console.error('Upload error:', error);
      setPreview(currentImage);
      toast({ 
        title: 'Erro', 
        description: 'Erro ao enviar imagem', 
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-border">
        {preview ? (
          <>
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
            <button
              onClick={handleRemove}
              className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Upload size={24} />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id="image-upload"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 size={14} className="mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Upload size={14} className="mr-2" />
            {preview ? 'Trocar Foto' : 'Enviar Foto'}
          </>
        )}
      </Button>
    </div>
  );
}

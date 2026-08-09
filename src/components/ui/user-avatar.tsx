import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserCircle } from 'lucide-react';

const signedCache = new Map<string, string>();

/** Extrai o caminho dentro do bucket a partir de uma URL pública/assinada do storage. */
function extractStoragePath(url: string, bucket = 'avatars'): string | null {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split('?')[0];
}

/**
 * Resolve a URL da foto. O bucket é privado, então geramos uma URL assinada
 * (cacheada) sempre que a imagem apontar para o storage.
 */
export function useResolvedAvatar(url?: string | null, bucket = 'avatars') {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved(null);
      return;
    }
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setResolved(url);
      return;
    }
    const path = extractStoragePath(url, bucket);
    if (!path) {
      setResolved(url);
      return;
    }
    const cached = signedCache.get(path);
    if (cached) {
      setResolved(cached);
      return;
    }
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!active) return;
        if (data?.signedUrl) {
          signedCache.set(path, data.signedUrl);
          setResolved(data.signedUrl);
        } else {
          setResolved(null);
        }
      });
    return () => {
      active = false;
    };
  }, [url, bucket]);

  return resolved;
}

interface UserAvatarProps {
  url?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({ url, name, className = 'w-10 h-10', fallbackClassName = '' }: UserAvatarProps) {
  const resolved = useResolvedAvatar(url);
  const initials = (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={name || 'Perfil'}
        className={`${className} rounded-full object-cover shadow-md`}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center font-bold bg-primary/15 text-primary ${fallbackClassName}`}
    >
      {initials || <UserCircle className="opacity-70" size={22} />}
    </div>
  );
}

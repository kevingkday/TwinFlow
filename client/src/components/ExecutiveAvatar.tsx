import React, { useState } from 'react';

interface ExecutiveAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function getInitials(name?: string): string {
  if (!name) return 'EX';
  const clean = name.replace(/[^\w\s]/gi, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EX';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Returns a stable color gradient based on the executive's name
 * for consistent, aesthetic initials presentation without fake photos.
 */
function getAvatarGradient(name?: string): string {
  const safeName = (name || 'Executive').trim() || 'Executive';
  const gradients = [
    'from-indigo-600/40 via-purple-600/30 to-indigo-950/80 border-indigo-500/40 text-indigo-200',
    'from-cyan-600/40 via-teal-600/30 to-slate-950/80 border-cyan-500/40 text-cyan-200',
    'from-purple-600/40 via-pink-600/30 to-slate-950/80 border-purple-500/40 text-purple-200',
    'from-emerald-600/40 via-teal-600/30 to-slate-950/80 border-emerald-500/40 text-emerald-200',
    'from-amber-600/40 via-orange-600/30 to-slate-950/80 border-amber-500/40 text-amber-200',
  ];
  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export const ExecutiveAvatar: React.FC<ExecutiveAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-11 h-11 text-xs',
    lg: 'w-16 h-16 text-base',
  };

  const ringClasses = {
    sm: 'ring-1 ring-white/10',
    md: 'ring-2 ring-indigo-500/30',
    lg: 'ring-2 ring-indigo-500/40 shadow-glow-brand',
  };

  const cleanUrl = (avatarUrl || '').trim();
  // Filter out known generic placeholders or stock dummy URLs
  const isGenericPlaceholder =
    !cleanUrl ||
    cleanUrl.includes('licdn.com/aero-v1/sc/h/') ||
    cleanUrl.includes('ghost_person') ||
    cleanUrl.includes('default-avatar') ||
    cleanUrl.includes('photo-1534528741775-53994a69daeb') ||
    cleanUrl.includes('photo-1573496359142-b8d87734a5a2') ||
    cleanUrl.includes('photo-1580489944761-15a19d654956');

  if (!isGenericPlaceholder && !imgError) {
    return (
      <img
        src={cleanUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} ${ringClasses[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  const initials = getInitials(name);
  const gradient = getAvatarGradient(name);

  return (
    <div
      className={`${sizeClasses[size]} ${ringClasses[size]} rounded-full bg-gradient-to-tr ${gradient} border flex items-center justify-center font-bold tracking-wider select-none flex-shrink-0 shadow-inner ${className}`}
      title={name}
      aria-label={name}
    >
      <span>{initials}</span>
    </div>
  );
};

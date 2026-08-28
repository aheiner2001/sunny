'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getHomePath } from '@/lib/roleHome';

export function HomeRedirect() {
  const { role, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(getHomePath(role));
  }, [hydrated, role, router]);

  return null;
}

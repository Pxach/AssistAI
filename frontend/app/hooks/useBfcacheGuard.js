"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useBfcacheGuard() {
  const router = useRouter();

  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) {
        router.replace('/');
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [router]);
}
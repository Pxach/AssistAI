"use client";

import { useBfcacheGuard } from '@/app/hooks/useBfcacheGuard';

export default function ProtectedLayout({ children }) {
  useBfcacheGuard();
  return <>{children}</>;
}
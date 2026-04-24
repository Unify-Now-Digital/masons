import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/shared/lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) {
          setStatus('error');
          return;
        }
        if (session) {
          setStatus('ok');
          navigate('/dashboard/inbox', { replace: true });
        } else {
          setStatus('error');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gardens-page">
        <p className="text-gardens-tx">Signing you in…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gardens-page p-4">
        <div className="text-center">
          <p className="text-gardens-tx">Could not complete sign-in.</p>
          <a href="/login" className="mt-2 inline-block text-gardens-blu-dk hover:underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return null;
}

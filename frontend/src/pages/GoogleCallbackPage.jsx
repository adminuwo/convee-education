import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const { loginWithGoogleCode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const processedRef = useRef(false);

  useEffect(() => {
    const oauthError = params.get('error') || params.get('error_description');
    if (oauthError) {
      setError(oauthError === 'access_denied' ? 'Sign in with Google was cancelled.' : oauthError);
      return;
    }

    const code = params.get('code');
    if (!code) {
      setError('No authorization code provided from Google.');
      return;
    }

    if (processedRef.current) return;
    processedRef.current = true;

    (async () => {
      try {
        await loginWithGoogleCode(code);
        toast.success('Signed in with Google');
        navigate('/app/home', { replace: true });
      } catch (e) {
        setError(e?.response?.data?.error || 'Sign in failed');
      }
    })();
  }, [params, loginWithGoogleCode, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      {!error ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Completing sign in with Google…</span>
        </div>
      ) : (
        <div className="max-w-md text-center space-y-4">
          <div className="text-lg font-semibold text-destructive">{error}</div>
          <button className="text-sm font-medium text-primary hover:underline" onClick={() => navigate('/login')}>
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}


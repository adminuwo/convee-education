import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Sparkles, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }
    authApi.verifyEmail(token)
      .then((data) => {
        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.error || 'Verification failed. The link may be expired or invalid.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 font-display text-2xl font-semibold mb-8">
          <div className="h-9 w-9 rounded-md gradient-brand flex items-center justify-center text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          Convee
        </div>
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            {status === 'loading' && (
              <>
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <p className="text-muted-foreground">Verifying your email…</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                <h2 className="text-xl font-semibold text-foreground">Email verified!</h2>
                <p className="text-muted-foreground text-sm">{message}</p>
                <Button className="mt-2" onClick={() => navigate('/login')}>
                  Continue to login
                </Button>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 mx-auto text-destructive" />
                <h2 className="text-xl font-semibold text-foreground">Verification failed</h2>
                <p className="text-muted-foreground text-sm">{message}</p>
                <div className="flex flex-col gap-2 mt-2">
                  <Button variant="outline" asChild>
                    <Link to="/login">Back to login</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/shared/lib/supabase';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      navigate('/dashboard/inbox', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (err) throw err;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gardens-page p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gardens-tx">Sign in</h1>
          <p className="mt-1 text-sm text-gardens-tx">Memorial Mason Management</p>
        </div>
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-gardens-red-dk" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in with email'}
          </Button>
        </form>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gardens-bdr" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-gardens-page px-2 text-gardens-txs">Or</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          Continue with Google
        </Button>
        <p className="text-center text-sm text-gardens-tx">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-gardens-blu-dk hover:underline">
            Register
          </Link>
        </p>
        <p className="text-center text-sm">
          <Link to="/" className="text-gardens-txs hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

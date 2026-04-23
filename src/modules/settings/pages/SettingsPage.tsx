import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { GmailConnectionStatus } from '@/modules/inbox/components/GmailConnectionStatus';
import { WhatsAppConnectionStatus } from '@/modules/inbox/components/WhatsAppConnectionStatus';
import { useRevolutConnection } from '@/modules/payments/hooks/useRevolutConnection';
import { syncRevolutTransactions, refreshRevolutToken } from '@/modules/payments/api/revolut.api';
import { RefreshCw, LogOut, CreditCard } from 'lucide-react';
import { CreateOrganizationModal, OrganizationMembersPanel } from '@/modules/organizations';
import { DeleteOrganizationModal } from '@/modules/settings/components/DeleteOrganizationModal';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId, organizationName, isOrgAdmin } = useOrganization();
  const [user, setUser] = useState<User | null>(null);

  // Account form state
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Revolut
  const { data: revolutConn, isLoading: revolutLoading } = useRevolutConnection();
  const [syncingRevolut, setSyncingRevolut] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);

  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      setDisplayName(u?.user_metadata?.display_name ?? '');
    });
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName },
    });
    setSavingProfile(false);
    if (error) {
      toast({ title: 'Could not update profile', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated' });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Password too short', description: 'Must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: 'Could not update password', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password updated' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const handleRevolutSync = async () => {
    setSyncingRevolut(true);
    try {
      const result = await syncRevolutTransactions();
      toast({ title: `Revolut synced`, description: `${result.synced} transactions imported.` });
    } catch (err) {
      toast({ title: 'Sync failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
    setSyncingRevolut(false);
  };

  const handleRevolutRefresh = async () => {
    setRefreshingToken(true);
    try {
      await refreshRevolutToken();
      toast({ title: 'Revolut token refreshed' });
    } catch (err) {
      toast({ title: 'Refresh failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
    setRefreshingToken(false);
  };

  const revolutStatus = revolutConn?.status ?? 'not connected';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h2 className="font-head text-lg font-semibold text-gardens-tx mb-1">Settings</h2>
          <p className="text-sm text-gardens-txs">Manage integrations, account, and preferences.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gardens-bdr bg-gardens-surf p-4">
          <p className="text-sm text-gardens-txs">
            Create an additional organisation for another site or trading name. You will be its admin.
          </p>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setCreateOrgOpen(true)}>
            Create organisation
          </Button>
        </div>

        {isOrgAdmin && organizationId && organizationName && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-destructive/30 bg-gardens-surf p-4">
            <p className="text-sm text-gardens-txs">
              Permanently delete this organisation and all its data.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => setDeleteOrgOpen(true)}
            >
              Delete organisation
            </Button>
          </div>
        )}

        <CreateOrganizationModal open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
        {organizationId && organizationName && (
          <DeleteOrganizationModal
            open={deleteOrgOpen}
            onOpenChange={setDeleteOrgOpen}
            organizationId={organizationId}
            organizationName={organizationName}
          />
        )}

        <OrganizationMembersPanel />

        {/* ─── Integrations ─── */}
        <div className="bg-gardens-surf border border-gardens-bdr rounded-lg p-5 space-y-4">
          <h3 className="font-head text-base font-semibold text-gardens-tx">Integrations</h3>
          <p className="text-sm text-gardens-txs">Connect external services to your workspace.</p>

          <div className="flex flex-col gap-3">
            {/* Gmail */}
            <div className="flex items-center justify-between p-3 border border-gardens-bdr rounded-lg bg-gardens-surf2">
              <div>
                <div className="text-sm font-medium text-gardens-tx">Gmail</div>
                <div className="text-xs text-gardens-txs">Sync emails into the unified inbox</div>
              </div>
              <GmailConnectionStatus />
            </div>

            {/* WhatsApp */}
            <div className="flex items-center justify-between p-3 border border-gardens-bdr rounded-lg bg-gardens-surf2">
              <div>
                <div className="text-sm font-medium text-gardens-tx">WhatsApp</div>
                <div className="text-xs text-gardens-txs">Receive WhatsApp messages in your inbox</div>
              </div>
              <WhatsAppConnectionStatus isAdmin={isOrgAdmin} />
            </div>

            {/* Revolut */}
            <div className="p-3 border border-gardens-bdr rounded-lg bg-gardens-surf2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gardens-tx">Revolut</div>
                  <div className="text-xs text-gardens-txs">
                    {revolutLoading
                      ? 'Checking connection...'
                      : revolutConn
                        ? `Status: ${revolutStatus} · Token expires ${new Date(revolutConn.token_expires_at).toLocaleDateString()}`
                        : 'Not connected'}
                  </div>
                </div>
                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded ${
                  revolutStatus === 'active'
                    ? 'bg-gardens-grn-lt text-gardens-grn-dk'
                    : revolutStatus === 'expired'
                      ? 'bg-gardens-amb-lt text-gardens-amb-dk'
                      : 'bg-[#F0EEDE] text-[#585040]'
                }`}>
                  {revolutStatus === 'active' ? 'Connected' : revolutStatus === 'expired' ? 'Expired' : 'Not connected'}
                </span>
              </div>
              {revolutConn && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevolutSync}
                    disabled={syncingRevolut}
                    className="text-xs"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1.5 ${syncingRevolut ? 'animate-spin' : ''}`} />
                    {syncingRevolut ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevolutRefresh}
                    disabled={refreshingToken}
                    className="text-xs"
                  >
                    {refreshingToken ? 'Refreshing...' : 'Refresh Token'}
                  </Button>
                </div>
              )}
            </div>

            {/* Stripe */}
            <div className="flex items-center justify-between p-3 border border-gardens-bdr rounded-lg bg-gardens-surf2">
              <div>
                <div className="text-sm font-medium text-gardens-tx">Stripe</div>
                <div className="text-xs text-gardens-txs">Payment processing for invoices</div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-gardens-grn-lt text-gardens-grn-dk">
                <CreditCard className="h-3 w-3" />
                Configured
              </span>
            </div>
          </div>
        </div>

        {/* ─── Account ─── */}
        <div className="bg-gardens-surf border border-gardens-bdr rounded-lg p-5 space-y-5">
          <h3 className="font-head text-base font-semibold text-gardens-tx">Account</h3>

          {/* Profile */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="settings-email" className="text-xs text-gardens-txs">Email</Label>
              <Input
                id="settings-email"
                value={user?.email ?? ''}
                disabled
                className="bg-gardens-page text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-name" className="text-xs text-gardens-txs">Display Name</Label>
              <Input
                id="settings-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>

          {/* Divider */}
          <div className="border-t border-gardens-bdr" />

          {/* Password */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gardens-tx">Change Password</h4>
            <div className="space-y-1.5">
              <Label htmlFor="settings-pw" className="text-xs text-gardens-txs">New Password</Label>
              <Input
                id="settings-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-pw-confirm" className="text-xs text-gardens-txs">Confirm Password</Label>
              <Input
                id="settings-pw-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={handleChangePassword}
              disabled={savingPassword || !newPassword}
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>

          {/* Divider */}
          <div className="border-t border-gardens-bdr" />

          {/* Sign Out */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gardens-tx">Sign Out</div>
              <div className="text-xs text-gardens-txs">End your current session</div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

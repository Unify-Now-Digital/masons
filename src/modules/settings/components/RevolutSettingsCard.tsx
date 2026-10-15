import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useToast } from '@/shared/hooks/use-toast';
import { disconnectRevolut, syncRevolutTransactions } from '@/modules/payments/api/revolut.api';
import { revolutKeys, useRevolutConnection } from '@/modules/payments/hooks/useRevolutConnection';
import { useRevolutConnect } from '@/modules/payments/hooks/useRevolutConnect';
import { formatLondonDateTime } from '@/modules/finance/londonTime';

export type RevolutOauthNotice =
  | { kind: 'connected' }
  | { kind: 'warning'; code: string }
  | { kind: 'error'; code: string }
  | null;

const DAY = 86_400_000;
const WARN_DAYS = 14;

const OAUTH_ERROR: Record<string, string> = {
  missing_code_or_state: 'Revolut did not return a code. Start Connect again.',
  invalid_state: 'That connect link has expired. Start Connect again.',
  server_config: 'Revolut is not configured on the server.',
  jwt_sign_failed: 'The Revolut certificate could not be used. Check the private key.',
  token_exchange_failed: 'Revolut refused the connection. Start Connect again.',
  no_tokens: 'Revolut did not return a token. Start Connect again.',
  no_org: 'No organisation was selected.',
  not_finance: 'Only an admin or member can connect Revolut.',
  client_in_use: 'This Revolut account is already connected to another organisation.',
  db_error: 'The connection could not be saved.',
};

const SYNC_ERROR: Record<string, string> = {
  refresh_expired: 'The Revolut token has expired. Connect again.',
  webhook_registration_failed: 'Connected, but Revolut did not register the webhook. Sync now still imports transactions.',
  sync_failed: 'The last sync did not finish.',
};

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  return Math.ceil((at - Date.now()) / DAY);
}

function explain(code: string | null | undefined, table: Record<string, string>): string | null {
  if (!code) return null;
  return table[code] ?? code.replace(/_/g, ' ');
}

export const RevolutSettingsCard: React.FC<{ notice?: RevolutOauthNotice }> = ({ notice = null }) => {
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const connection = useRevolutConnection();
  const connect = useRevolutConnect();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const row = connection.data ?? null;
  const status = row?.status ?? null;
  const active = status === 'active';
  const expired = status === 'expired';
  const revoked = status === 'revoked';
  const refreshDays = daysUntil(row?.refresh_token_expires_at);
  const tokenExpiring = active && refreshDays != null && refreshDays <= WARN_DAYS;
  const tokenExpired = active && refreshDays != null && refreshDays <= 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: revolutKeys.connection(organizationId ?? null) });
    qc.invalidateQueries({ queryKey: ['brand-data'] });
  };

  const onSync = async () => {
    if (!organizationId) return;
    setSyncing(true);
    setActionError(null);
    try {
      const result = await syncRevolutTransactions(organizationId);
      toast({ title: 'Revolut synced', description: `${result.synced} new transactions.` });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setActionError(message);
      toast({ title: 'Sync failed', description: message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const onDisconnect = async () => {
    if (!organizationId) return;
    setDisconnecting(true);
    setActionError(null);
    try {
      await disconnectRevolut(organizationId);
      toast({ title: 'Revolut disconnected' });
      setConfirmDisconnect(false);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not disconnect';
      setActionError(message);
      toast({ title: 'Disconnect failed', description: message, variant: 'destructive' });
    }
    setDisconnecting(false);
  };

  const badge = expired || tokenExpired
    ? 'Token expired'
    : revoked
      ? 'Disconnected'
      : active
        ? 'Connected'
        : 'Not connected';
  const badgeClass = active && !tokenExpired
    ? 'bg-gardens-na-green-lt text-gardens-na-green'
    : expired || tokenExpired
      ? 'bg-gardens-na-amber-lt text-gardens-na-amber'
      : 'bg-gardens-page text-gardens-txs';

  const oauthError = notice?.kind === 'error' ? explain(notice.code, OAUTH_ERROR) : null;
  const oauthWarning = notice?.kind === 'warning' ? explain(notice.code, { webhook: SYNC_ERROR.webhook_registration_failed }) : null;
  const syncError = explain(row?.last_sync_error, SYNC_ERROR);

  return (
    <div className="p-3 border border-gardens-bdr rounded-lg bg-gardens-surf2 space-y-3" data-testid="revolut-settings">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gardens-tx">Revolut</div>
          <div className="text-xs text-gardens-txs">
            {connection.isLoading
              ? 'Checking connection…'
              : active
                ? `Last synced ${formatLondonDateTime(row?.last_synced_at)}`
                : revoked
                  ? 'Disconnected. Connect again to import payments.'
                  : 'Import customer payments into Reconcile.'}
          </div>
        </div>
        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded ${badgeClass}`}>{badge}</span>
      </div>

      {connection.isError && (
        <p role="alert" className="m-0 text-xs text-gardens-na-red">
          Could not load the Revolut connection. {(connection.error as Error).message}
        </p>
      )}
      {notice?.kind === 'connected' && !oauthWarning && (
        <p className="m-0 text-xs text-gardens-na-green">Revolut is connected for this organisation.</p>
      )}
      {oauthWarning && <p role="status" className="m-0 text-xs text-gardens-na-amber">{oauthWarning}</p>}
      {oauthError && <p role="alert" className="m-0 text-xs text-gardens-na-red">{oauthError}</p>}
      {connect.isError && (
        <p role="alert" className="m-0 text-xs text-gardens-na-red">{(connect.error as Error).message}</p>
      )}
      {syncError && active && <p role="status" className="m-0 text-xs text-gardens-na-amber">{syncError}</p>}
      {actionError && <p role="alert" className="m-0 text-xs text-gardens-na-red">{actionError}</p>}
      {tokenExpiring && (
        <p role="status" className="m-0 text-xs text-gardens-na-amber">
          {tokenExpired
            ? 'The Revolut connection token has expired. Connect again.'
            : `Token expiring in ${refreshDays} day${refreshDays === 1 ? '' : 's'}. Connect again before it lapses.`}
        </p>
      )}
      {row?.environment && (
        <p className="m-0 text-[11px] text-gardens-txs">
          {row.environment === 'sandbox' ? 'Sandbox' : 'Production'}
          {row.token_expires_at ? ` · access refreshes ${formatLondonDateTime(row.token_expires_at)}` : ''}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(!row || revoked || expired || tokenExpired) && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={!organizationId || connect.isPending}
            onClick={() => { setActionError(null); connect.mutate(); }}
          >
            {connect.isPending ? 'Connecting…' : active ? 'Connect again' : 'Connect'}
          </Button>
        )}
        {active && !tokenExpired && (
          <Button variant="outline" size="sm" className="text-xs" onClick={onSync} disabled={syncing || !organizationId}>
            <RefreshCw className={`h-3 w-3 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        )}
        {tokenExpiring && !tokenExpired && (
          <Button variant="outline" size="sm" className="text-xs" disabled={!organizationId || connect.isPending} onClick={() => connect.mutate()}>
            {connect.isPending ? 'Connecting…' : 'Connect again'}
          </Button>
        )}
        {row && !revoked && !confirmDisconnect && (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setConfirmDisconnect(true)}>
            Disconnect
          </Button>
        )}
        {confirmDisconnect && (
          <>
            <Button variant="destructive" size="sm" className="text-xs" onClick={onDisconnect} disabled={disconnecting}>
              {disconnecting ? 'Disconnecting…' : 'Confirm disconnect'}
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setConfirmDisconnect(false)} disabled={disconnecting}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { GmailConnectionStatus } from '@/modules/inbox/components/GmailConnectionStatus';
import { WhatsAppConnectionStatus } from '@/modules/inbox/components/WhatsAppConnectionStatus';

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-8">
        <div>
          <h2 className="font-head text-lg font-semibold text-gardens-tx mb-1">Settings</h2>
          <p className="text-sm text-gardens-txs">Manage your account and integrations.</p>
        </div>

        <div className="bg-gardens-surf border border-gardens-bdr rounded-lg p-5 space-y-4">
          <h3 className="font-head text-base font-semibold text-gardens-tx">Integrations</h3>
          <p className="text-sm text-gardens-txs">Connect your email and messaging accounts.</p>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-3 border border-gardens-bdr rounded-lg bg-gardens-surf2">
              <div>
                <div className="text-sm font-medium text-gardens-tx">Gmail</div>
                <div className="text-xs text-gardens-txs">Sync emails into the unified inbox</div>
              </div>
              <GmailConnectionStatus />
            </div>

            <div className="flex items-center justify-between p-3 border border-gardens-bdr rounded-lg bg-gardens-surf2">
              <div>
                <div className="text-sm font-medium text-gardens-tx">WhatsApp</div>
                <div className="text-xs text-gardens-txs">Receive WhatsApp messages in your inbox</div>
              </div>
              <WhatsAppConnectionStatus />
            </div>
          </div>
        </div>

        <div className="bg-gardens-surf border border-gardens-bdr rounded-lg p-5 space-y-4">
          <h3 className="font-head text-base font-semibold text-gardens-tx">Account</h3>
          <p className="text-sm text-gardens-txs">Account management features coming soon.</p>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Trash2,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../theme.jsx';
import { Button, Modal, ProviderMark, cx } from '../components/ui.jsx';
import RuleManagerModal from '../components/RuleManagerModal.jsx';

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const nav = useNavigate();

  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'mailboxes' | 'security' | 'verification' | 'rules' | 'admin'
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Assistant verification form
  const [verForm, setVerForm] = useState({
    companyName: user?.companyName || '',
    employeeId: user?.employeeId || '',
    companyEmail: user?.companyEmail || '',
  });
  const [verLoading, setVerLoading] = useState(false);
  const [verResult, setVerResult] = useState(null);

  // E2E Encryption toggle
  const [e2eEnabled, setE2eEnabled] = useState(user?.e2eEncryptionEnabled ?? true);
  const [e2eLoading, setE2eLoading] = useState(false);

  // Admin Data (for iambrook2007@gmail.com)
  const isSuperAdmin = user?.email === 'iambrook2007@gmail.com' || Boolean(user?.isAdmin);
  const [adminOverview, setAdminOverview] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);

  // Modals
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const loadAccounts = async () => {
    try {
      if (user?.role === 'assistant') {
        const d = await api.get('/accounts');
        setAccounts(d.accounts || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAdminData = async () => {
    if (!isSuperAdmin) return;
    setAdminLoading(true);
    try {
      const data = await api.get('/admin/system-overview');
      setAdminOverview(data);
    } catch (e) {
      console.error('Failed to load admin data:', e);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAccounts(), loadAdminData()]).finally(() => setLoading(false));
  }, []);

  const handleToggleE2e = async () => {
    setE2eLoading(true);
    const next = !e2eEnabled;
    try {
      await api.patch('/admin/preferences', { e2eEncryptionEnabled: next });
      setE2eEnabled(next);
      showToast(`End-to-End Encryption ${next ? 'Enabled' : 'Disabled'}`);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setE2eLoading(false);
    }
  };

  const handleRequestVerification = async (e) => {
    e.preventDefault();
    setVerLoading(true);
    setErrorMsg('');
    try {
      const res = await api.post('/admin/request-verification', verForm);
      setVerResult(res);
      showToast(res.message);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setVerLoading(false);
    }
  };

  const handleAdminVerifyUser = async (userId, status) => {
    try {
      await api.post(`/admin/verify-user/${userId}`, { status });
      showToast(`User status updated to ${status}`);
      await loadAdminData();
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const handleRemoveAccount = async (id, isGlobalAdmin = false) => {
    try {
      if (isGlobalAdmin) {
        await api.del(`/admin/accounts/${id}`);
        showToast('Account removed by super admin');
        await loadAdminData();
      } else {
        await api.del(`/accounts/${id}`);
        showToast('Mailbox removed successfully');
        await loadAccounts();
      }
      setDeleteAccountTarget(null);
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-[#171717] transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#EBEBEB] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => nav(user?.role === 'client' ? '/client' : '/assistant')}
              className="flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#171717] hover:border-[#D4D4D8]"
            >
              <ArrowLeft className="h-4 w-4" /> Return to Dashboard
            </button>
            <h1 className="title-2 text-[#171717]">Workspace Settings & Customization</h1>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#F59E0B]/30 bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-bold text-[#B45309]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#B45309]" /> SUPER ADMIN
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#D4D4D8]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-[#F59E0B]" /> : <Moon className="h-4 w-4 text-[#6366F1]" />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {toastMsg && (
          <div className="mb-6 animate-fade-up rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-sm font-medium text-[#065F46]">
            ✓ {toastMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm font-medium text-[#DC2626]">
            ✕ {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Settings Sidebar Tabs */}
          <nav className="space-y-1.5 md:col-span-1">
            {[
              { id: 'general', label: 'General & Theme', icon: Sun },
              { id: 'mailboxes', label: 'Connected IDs', icon: Mail },
              { id: 'security', label: 'End-to-End Encryption', icon: Lock },
              { id: 'verification', label: 'Assistant Verifier', icon: Building },
              { id: 'rules', label: 'Rules & Categories', icon: Zap },
              ...(isSuperAdmin ? [{ id: 'admin', label: 'Admin Privileges', icon: Shield }] : []),
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(t.id);
                    setErrorMsg('');
                  }}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition',
                    active
                      ? 'bg-[#0070F3] text-white shadow-sm'
                      : 'border border-transparent text-[#73706D] hover:bg-white hover:text-[#171717]'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Tab Content Panel */}
          <section className="space-y-6 md:col-span-3">
            {/* General & Theme Tab */}
            {activeTab === 'general' && (
              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6 shadow-sm">
                <h2 className="title-2 text-[#171717]">Appearance & Identity</h2>
                <p className="body-6 mt-1 text-[#73706D]">Choose your preferred theme and visual layout.</p>

                <div className="mt-6 flex items-center justify-between border-t border-[#EBEBEB] pt-6">
                  <div>
                    <p className="title-4 text-[#171717]">Interface Theme</p>
                    <p className="caption-2 text-[#73706D]">Switch between High-Contrast Light and Executive Dark mode.</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex items-center gap-2 rounded-xl border border-[#D4D4D8] bg-[#FAFAFA] px-4 py-2 text-xs font-semibold text-[#171717]"
                  >
                    {theme === 'dark' ? <Moon className="h-4 w-4 text-[#6366F1]" /> : <Sun className="h-4 w-4 text-[#F59E0B]" />}
                    <span>{theme === 'dark' ? 'Dark Mode (Active)' : 'Light Mode (Active)'}</span>
                  </button>
                </div>

                <div className="mt-6 border-t border-[#EBEBEB] pt-6">
                  <p className="title-4 text-[#171717]">Account Role & Work Identity</p>
                  <p className="caption-2 mt-1 text-[#73706D]">
                    Logged in as <b>{user?.name}</b> ({user?.email}) · Role: <b>{user?.role}</b>
                  </p>
                </div>
              </div>
            )}

            {/* Connected Mailboxes Tab */}
            {activeTab === 'mailboxes' && (
              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="title-2 text-[#171717]">Connected Mailbox Identities</h2>
                    <p className="body-6 mt-1 text-[#73706D]">Remove any connected ID or inspect synchronization status.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {user?.role === 'client' && (
                    <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-xs text-[#1E40AF]">
                      Connected mailbox identities for your executive portal are linked and synchronized via your personal assistant workspace. To disconnect or add new identities, request your assistant or super administrator.
                    </div>
                  )}
                  {user?.role !== 'client' && accounts.length === 0 && (
                    <p className="caption-2 text-[#73706D]">No mailboxes connected to this workspace.</p>
                  )}
                  {accounts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-4 transition hover:border-[#D4D4D8]"
                    >
                      <div className="flex items-center gap-3">
                        <ProviderMark provider={a.provider} size="md" />
                        <div>
                          <p className="title-4 text-[#171717]">{a.clientEmail}</p>
                          <p className="caption-3 text-[#73706D]">
                            {a.clientName} · {a.connectionType === 'imap_live' ? 'Live IMAP Sync' : 'Sandbox Demo'} ·{' '}
                            {a.syncedCount || 0} conversations
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Trash2}
                        className="text-[#DC2626] hover:bg-[#FEF2F2]"
                        onClick={() => setDeleteAccountTarget(a)}
                      >
                        Remove ID
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* End-to-End Encryption Tab */}
            {activeTab === 'security' && (
              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF5FF] text-[#0070F3]">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="title-2 text-[#171717]">End-to-End Encryption (E2E)</h2>
                    <p className="body-6 text-[#73706D]">Protect sensitive client email messages and draft replies at rest.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4 border-t border-[#EBEBEB] pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="title-4 text-[#171717]">AES-256-GCM Hardware-Accelerated Encryption</p>
                      <p className="caption-2 max-w-md text-[#73706D]">
                        When enabled, all inbound email message bodies and executive drafts are encrypted before writing to the database
                        and decrypted in memory only for authenticated workspace owners.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={e2eLoading}
                      onClick={handleToggleE2e}
                      className={cx(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        e2eEnabled ? 'bg-[#0070F3]' : 'bg-[#D4D4D8]'
                      )}
                    >
                      <span
                        className={cx(
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                          e2eEnabled ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>

                  <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 text-xs text-[#065F46]">
                    <div className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="h-4 w-4" /> Cryptographic State: Active
                    </div>
                    <p className="mt-1">
                      Stored IMAP credentials and email message payloads use 256-bit Galois/Counter Mode with 96-bit unique IVs and 128-bit authentication tags.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Assistant Verifier Tab */}
            {activeTab === 'verification' && (
              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="title-2 text-[#171717]">Assistant Company Verification</h2>
                    <p className="body-6 text-[#73706D]">
                      Cold email verification flow for personal assistants representing a company.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4 border-t border-[#EBEBEB] pt-6">
                  <div className="flex items-center gap-2">
                    <span className="caption-3 uppercase tracking-wider text-[#73706D]">Current Status:</span>
                    <span
                      className={cx(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        user?.verificationStatus === 'verified'
                          ? 'border border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
                          : user?.verificationStatus === 'pending'
                          ? 'border border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]'
                          : 'border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]'
                      )}
                    >
                      {user?.verificationStatus === 'verified' ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" /> Verified Employee
                        </>
                      ) : user?.verificationStatus === 'pending' ? (
                        <>
                          <Clock className="h-3.5 w-3.5 text-[#B45309]" /> Pending Company Confirmation
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3.5 w-3.5" /> Unverified Assistant
                        </>
                      )}
                    </span>
                  </div>

                  <form onSubmit={handleRequestVerification} className="space-y-3.5 pt-2">
                    <div>
                      <label className="caption-2 block font-semibold text-[#171717]">Company / Organization Name</label>
                      <input
                        type="text"
                        value={verForm.companyName}
                        onChange={(e) => setVerForm((f) => ({ ...f, companyName: e.target.value }))}
                        placeholder="e.g. Lumen Labs Inc."
                        className="body-5 mt-1 w-full rounded-lg border border-[#D4D4D8] bg-white p-2.5 text-[#171717] outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="caption-2 block font-semibold text-[#171717]">Employee ID</label>
                        <input
                          type="text"
                          value={verForm.employeeId}
                          onChange={(e) => setVerForm((f) => ({ ...f, employeeId: e.target.value }))}
                          placeholder="e.g. EMP-8021"
                          className="body-5 mt-1 w-full rounded-lg border border-[#D4D4D8] bg-white p-2.5 text-[#171717] outline-none"
                        />
                      </div>
                      <div>
                        <label className="caption-2 block font-semibold text-[#171717]">Company Work / HR Email</label>
                        <input
                          type="email"
                          value={verForm.companyEmail}
                          onChange={(e) => setVerForm((f) => ({ ...f, companyEmail: e.target.value }))}
                          placeholder="hr@company.com"
                          className="body-5 mt-1 w-full rounded-lg border border-[#D4D4D8] bg-white p-2.5 text-[#171717] outline-none"
                        />
                      </div>
                    </div>

                    <Button type="submit" variant="primary" loading={verLoading} className="mt-2">
                      <Send className="h-4 w-4" /> Drop Cold Verification Email to Company
                    </Button>
                  </form>

                  {verResult?.simulatedVerificationUrl && (
                    <div className="mt-4 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-xs text-[#1E40AF]">
                      <p className="font-semibold">Simulated Cold Email Dispatched:</p>
                      <p className="mt-1">
                        In live production, an authorization email is sent to <b>{verForm.companyEmail}</b>. For testing, click the verification URL directly:
                      </p>
                      <a
                        href={verResult.simulatedVerificationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block truncate font-mono text-[#0070F3] hover:underline"
                      >
                        {verResult.simulatedVerificationUrl}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rules & Categories Tab */}
            {activeTab === 'rules' && (
              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="title-2 text-[#171717]">Client Routing Rules & Custom Categories</h2>
                    <p className="body-6 mt-1 text-[#73706D]">
                      Group incoming emails by sender or subject into Important, Action Required, Waiting for Response, or custom topics.
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => setRuleModalOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Manage Rules
                  </Button>
                </div>

                <div className="mt-6 rounded-xl border border-dashed border-[#D4D4D8] p-6 text-center">
                  <Zap className="mx-auto h-8 w-8 text-[#0070F3]" />
                  <p className="title-4 mt-2 text-[#171717]">AI Auto-Routing Engine</p>
                  <p className="caption-2 mt-1 text-[#73706D]">
                    Rules automatically apply to real incoming IMAP messages, simulation threads, and client audio briefs.
                  </p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => setRuleModalOpen(true)}>
                    Open Rule Builder
                  </Button>
                </div>
              </div>
            )}

            {/* Super Admin Privileges Tab */}
            {activeTab === 'admin' && isSuperAdmin && (
              <div className="rounded-2xl border border-[#F59E0B]/30 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#B45309]">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="title-2 text-[#171717]">Super Administrator Dashboard</h2>
                      <p className="body-6 text-[#73706D]">
                        Privileges unlocked for <b>iambrook2007@gmail.com</b>
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" icon={RefreshCw} loading={adminLoading} onClick={loadAdminData}>
                    Refresh Stats
                  </Button>
                </div>

                {/* System KPI Cards */}
                {adminOverview && (
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-3 text-center">
                      <p className="caption-3 text-[#73706D]">Total Platform Users</p>
                      <p className="heading-5 mt-0.5 text-[#171717]">{adminOverview.stats.totalUsers}</p>
                    </div>
                    <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-3 text-center">
                      <p className="caption-3 text-[#73706D]">Connected Mailboxes</p>
                      <p className="heading-5 mt-0.5 text-[#0070F3]">{adminOverview.stats.totalAccounts}</p>
                    </div>
                    <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-3 text-center">
                      <p className="caption-3 text-[#73706D]">Triage Conversations</p>
                      <p className="heading-5 mt-0.5 text-[#059669]">{adminOverview.stats.totalConversations}</p>
                    </div>
                  </div>
                )}

                {/* Global User Management & Assistant Verification Approvals */}
                <div className="mt-6 space-y-3">
                  <p className="title-4 text-[#171717]">All Platform Users & Verification Approvals</p>
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {adminOverview?.users.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-3"
                      >
                        <div>
                          <p className="title-4 text-[#171717]">
                            {u.name} <span className="caption-3 text-[#73706D]">({u.email})</span>
                          </p>
                          <p className="caption-3 text-[#73706D]">
                            Role: <b>{u.role}</b> · Company: <b>{u.companyName || 'None'}</b> · Emp ID: <b>{u.employeeId || 'None'}</b>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cx(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold',
                              u.verificationStatus === 'verified'
                                ? 'bg-[#ECFDF5] text-[#059669]'
                                : u.verificationStatus === 'pending'
                                ? 'bg-[#FEF3C7] text-[#B45309]'
                                : 'bg-[#F4F4F5] text-[#71717A]'
                            )}
                          >
                            {u.verificationStatus}
                          </span>
                          {u.verificationStatus !== 'verified' && (
                            <button
                              type="button"
                              onClick={() => handleAdminVerifyUser(u.id, 'verified')}
                              className="rounded bg-[#059669] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#047857]"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remove Any ID Across System */}
                <div className="mt-6 space-y-3 border-t border-[#EBEBEB] pt-6">
                  <p className="title-4 text-[#171717]">Remove Any Mailbox Across Platform</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {adminOverview?.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between rounded-lg border border-[#EBEBEB] p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <ProviderMark provider={acc.provider} size="sm" />
                          <span className="title-4 text-[#171717]">{acc.clientEmail}</span>
                          <span className="caption-3 text-[#73706D]">({acc.clientName})</span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Trash2}
                          className="text-[#DC2626]"
                          onClick={() => handleRemoveAccount(acc.id, true)}
                        >
                          Remove ID
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteAccountTarget && (
        <Modal
          open={Boolean(deleteAccountTarget)}
          onClose={() => setDeleteAccountTarget(null)}
          title="Remove Connected Mailbox ID?"
          footer={
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDeleteAccountTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleRemoveAccount(deleteAccountTarget.id)}>
                Confirm Remove
              </Button>
            </div>
          }
        >
          <p className="body-6 text-[#4D4D4D]">
            Are you sure you want to remove <b>{deleteAccountTarget.clientEmail}</b>? All triage threads associated with this ID will be detached.
          </p>
        </Modal>
      )}

      {/* Rule Manager Modal */}
      <RuleManagerModal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        onRulesChanged={() => {
          showToast('Routing rules updated');
        }}
      />
    </div>
  );
}

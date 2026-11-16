import { useEffect, useState } from 'react';
import { Check, Filter, Plus, Tag, Trash2, X, Zap } from 'lucide-react';
import { api } from '../api.js';
import { Button, Modal, cx } from './ui.jsx';

const DEFAULT_TARGETS = [
  { id: 'important', label: 'Important', color: '#D97706' },
  { id: 'action_required', label: 'Immediate Action Required', color: '#DC2626' },
  { id: 'waiting_response', label: 'Waiting for Response', color: '#0070F3' },
  { id: 'ai_reply', label: 'AI to Reply', color: '#059669' },
];

const COLOR_PRESETS = ['#0070F3', '#10B981', '#D97706', '#EC4899', '#8B5CF6', '#6366F1', '#14B8A6'];

export default function RuleManagerModal({ open, onClose, onRulesChanged, initialMatchValue = '', initialMatchType = 'from_email' }) {
  const [tab, setTab] = useState('rules'); // 'rules' | 'new_rule' | 'categories'
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state for new rule
  const [ruleName, setRuleName] = useState('');
  const [matchType, setMatchType] = useState(initialMatchType);
  const [matchValue, setMatchValue] = useState(initialMatchValue);
  const [targetCategory, setTargetCategory] = useState('important');

  // Form state for new category
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#0070F3');
  const [catDesc, setCatDesc] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([api.get('/rules'), api.get('/rules/categories')]);
      setRules(r.rules || []);
      setCategories(c.categories || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
      if (initialMatchValue) {
        setMatchValue(initialMatchValue);
        setMatchType(initialMatchType);
        setRuleName(`Rule for ${initialMatchValue}`);
        setTab('new_rule');
      }
    }
  }, [open, initialMatchValue, initialMatchType]);

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!ruleName.trim() || !matchValue.trim()) {
      setError('Please fill in the rule name and match criteria.');
      return;
    }
    setError('');
    try {
      await api.post('/rules', {
        name: ruleName.trim(),
        matchType,
        matchValue: matchValue.trim(),
        targetCategory,
      });
      setRuleName('');
      setMatchValue('');
      setTab('rules');
      await loadData();
      onRulesChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRule = async (id) => {
    try {
      await api.del(`/rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
      onRulesChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) {
      setError('Please provide a category name.');
      return;
    }
    setError('');
    try {
      await api.post('/rules/categories', {
        name: catName.trim(),
        color: catColor,
        description: catDesc.trim(),
      });
      setCatName('');
      setCatDesc('');
      await loadData();
      onRulesChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await api.del(`/rules/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      onRulesChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const allTargets = [
    ...DEFAULT_TARGETS,
    ...categories.map((c) => ({ id: c.slug, label: c.name, color: c.color })),
  ];

  return (
    <Modal open={open} onClose={onClose} title="Categories & Auto-Routing Rules">
      <div className="space-y-4">
        {/* Navigation tabs */}
        <div className="flex border-b border-[#EBEBEB] pb-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setTab('rules');
              setError('');
            }}
            className={cx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition',
              tab === 'rules' ? 'bg-[#0070F3] text-white font-semibold' : 'text-[#73706D] hover:text-[#171717]'
            )}
          >
            <Filter className="h-3.5 w-3.5" /> Active Rules ({rules.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('new_rule');
              setError('');
            }}
            className={cx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition',
              tab === 'new_rule' ? 'bg-[#0070F3] text-white font-semibold' : 'text-[#73706D] hover:text-[#171717]'
            )}
          >
            <Plus className="h-3.5 w-3.5" /> + New Rule
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('categories');
              setError('');
            }}
            className={cx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition',
              tab === 'categories' ? 'bg-[#0070F3] text-white font-semibold' : 'text-[#73706D] hover:text-[#171717]'
            )}
          >
            <Tag className="h-3.5 w-3.5" /> Custom Categories ({categories.length})
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-xs text-[#DC2626]">
            {error}
          </div>
        )}

        {/* Tab 1: List Rules */}
        {tab === 'rules' && (
          <div className="space-y-3">
            <p className="caption-2 text-[#73706D]">
              When an email matches any rule, the AI automatically categorizes it for both client and assistant.
            </p>

            {rules.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed border-[#D4D4D8] p-6 text-center text-xs text-[#73706D]">
                No custom routing rules yet. Click <b>+ New Rule</b> to auto-sort emails from specific senders or subjects.
              </div>
            )}

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {rules.map((r) => {
                const target = allTargets.find((t) => t.id === r.targetCategory) || {
                  label: r.targetCategory,
                  color: '#0070F3',
                };
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-3 transition hover:border-[#D4D4D8]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="title-4 text-[#171717]">{r.name}</span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: target.color }}
                        >
                          {target.label}
                        </span>
                      </div>
                      <p className="caption-3 mt-1 text-[#73706D]">
                        Match {r.matchType === 'from_email' ? 'Sender Email' : r.matchType === 'domain' ? 'Domain' : 'Subject'}:{' '}
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[#171717]">{r.matchValue}</code>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(r.id)}
                      className="ml-3 text-[#DC2626] hover:text-[#B91C1C]"
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <Button variant="secondary" size="sm" className="w-full" onClick={() => setTab('new_rule')}>
              <Plus className="h-3.5 w-3.5" /> Add another routing rule
            </Button>
          </div>
        )}

        {/* Tab 2: New Rule Form */}
        {tab === 'new_rule' && (
          <form onSubmit={handleCreateRule} className="space-y-3.5">
            <div>
              <label className="caption-2 block font-semibold text-[#171717]">Rule Name</label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. Executive Board Emails"
                className="body-6 mt-1 w-full rounded-lg border border-[#D4D4D8] bg-white p-2 text-[#171717] outline-none focus:border-[#0070F3]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="caption-2 block font-semibold text-[#171717]">Condition</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="body-6 mt-1 w-full rounded-lg border border-[#D4D4D8] bg-white p-2 text-[#171717] outline-none"
                >
                  <option value="from_email">Sender Email equals / contains</option>
                  <option value="domain">Sender Domain equals (@domain.com)</option>
                  <option value="subject_contains">Subject contains keyword</option>
                </select>
              </div>
              <div>
                <label className="caption-2 block font-semibold text-[#171717]">Match Value</label>
                <input
                  type="text"
                  value={matchValue}
                  onChange={(e) => setMatchValue(e.target.value)}
                  placeholder="e.g. investor@fund.com or Invoice"
                  className="body-6 mt-1 w-full rounded-lg border border-[#D4D4D8] bg-white p-2 text-[#171717] outline-none focus:border-[#0070F3]"
                />
              </div>
            </div>

            <div>
              <label className="caption-2 block font-semibold text-[#171717]">Action: Move into Category</label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="body-6 mt-1 w-full rounded-lg border border-[#D4D4D8] bg-white p-2 text-[#171717] outline-none"
              >
                <optgroup label="Default Categories">
                  {DEFAULT_TARGETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
                {categories.length > 0 && (
                  <optgroup label="Custom Categories">
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setTab('rules')}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1">
                <Check className="h-3.5 w-3.5" /> Save Rule
              </Button>
            </div>
          </form>
        )}

        {/* Tab 3: Custom Categories */}
        {tab === 'categories' && (
          <div className="space-y-4">
            <form onSubmit={handleCreateCategory} className="space-y-3 rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-3">
              <p className="caption-2 font-semibold text-[#171717]">+ Create New Category</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Category Name (e.g. Legal, VIP)"
                  className="body-6 rounded-lg border border-[#D4D4D8] bg-white p-2 text-[#171717] outline-none"
                />
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Optional description"
                  className="body-6 rounded-lg border border-[#D4D4D8] bg-white p-2 text-[#171717] outline-none"
                />
              </div>

              <div>
                <label className="caption-3 block text-[#73706D]">Color Badge</label>
                <div className="mt-1 flex items-center gap-1.5">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCatColor(color)}
                      className={cx(
                        'h-6 w-6 rounded-full border-2 transition',
                        catColor === color ? 'border-[#171717] scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Button type="submit" size="sm" variant="primary" className="ml-auto">
                    Add Category
                  </Button>
                </div>
              </div>
            </form>

            <div className="space-y-2">
              <p className="caption-3 font-semibold text-[#73706D]">Your Custom Categories</p>
              {categories.length === 0 && (
                <p className="caption-3 text-[#73706D]">No custom categories yet. Create one above to organize specific topics.</p>
              )}
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-[#EBEBEB] p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="title-4 text-[#171717]">{c.name}</span>
                    <span className="caption-3 text-[#73706D]">{c.description}</span>
                  </div>
                  <button type="button" onClick={() => handleDeleteCategory(c.id)} className="text-[#DC2626]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

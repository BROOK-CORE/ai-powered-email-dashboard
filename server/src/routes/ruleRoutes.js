import { Router } from 'express';
import { ClientRule } from '../models/ClientRule.js';
import { CustomCategory } from '../models/CustomCategory.js';
import { requireAuth, asyncHandler } from '../middleware/auth.js';
import { isObjectId } from '../middleware/security.js';
import { logSecurityEvent } from '../services/securityLogger.js';

const router = Router();
router.use(requireAuth);

/* ------------------------------- Rules --------------------------------------------------- */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rules = await ClientRule.find({ ownerId: req.ownerId }).sort({ priority: 1, createdAt: -1 });
    res.json({
      rules: rules.map((r) => ({
        id: r._id,
        name: r.name,
        matchType: r.matchType,
        matchValue: r.matchValue,
        targetCategory: r.targetCategory,
        action: r.action,
        isActive: r.isActive,
        priority: r.priority,
        createdAt: r.createdAt,
      })),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, matchType, matchValue, targetCategory, action, priority } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Rule name is required' });
    }
    if (!['from_email', 'subject_contains', 'domain'].includes(matchType)) {
      return res.status(400).json({ error: 'Valid match type is required (from_email, subject_contains, domain)' });
    }
    if (!matchValue || typeof matchValue !== 'string' || !matchValue.trim()) {
      return res.status(400).json({ error: 'Match value (email address, domain, or subject text) is required' });
    }
    if (!targetCategory || typeof targetCategory !== 'string' || !targetCategory.trim()) {
      return res.status(400).json({ error: 'Target category is required' });
    }

    const rule = await ClientRule.create({
      ownerId: req.ownerId,
      name: name.trim().slice(0, 100),
      matchType,
      matchValue: matchValue.trim().slice(0, 200),
      targetCategory: targetCategory.trim().slice(0, 50),
      action: action === 'mark_important' || action === 'auto_draft' ? action : 'route_to_category',
      priority: Number(priority) || 0,
      isActive: true,
    });

    logSecurityEvent({
      event: 'rules.created',
      outcome: 'success',
      req,
      targetId: rule._id,
      meta: { name: rule.name, matchType, targetCategory, status: 201 },
    });

    res.status(201).json({
      rule: {
        id: rule._id,
        name: rule.name,
        matchType: rule.matchType,
        matchValue: rule.matchValue,
        targetCategory: rule.targetCategory,
        action: rule.action,
        isActive: rule.isActive,
        priority: rule.priority,
        createdAt: rule.createdAt,
      },
    });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid rule id' });
    const rule = await ClientRule.findOne({ _id: req.params.id, ownerId: req.ownerId });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const { name, matchType, matchValue, targetCategory, action, isActive, priority } = req.body || {};
    if (typeof name === 'string' && name.trim()) rule.name = name.trim().slice(0, 100);
    if (['from_email', 'subject_contains', 'domain'].includes(matchType)) rule.matchType = matchType;
    if (typeof matchValue === 'string' && matchValue.trim()) rule.matchValue = matchValue.trim().slice(0, 200);
    if (typeof targetCategory === 'string' && targetCategory.trim()) rule.targetCategory = targetCategory.trim().slice(0, 50);
    if (action) rule.action = action;
    if (typeof isActive === 'boolean') rule.isActive = isActive;
    if (typeof priority === 'number') rule.priority = priority;

    await rule.save();
    res.json({ rule: { ...rule.toObject(), id: rule._id } });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid rule id' });
    const rule = await ClientRule.findOneAndDelete({ _id: req.params.id, ownerId: req.ownerId });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ ok: true, id: req.params.id });
  })
);

/* ------------------------------- Custom Categories ---------------------------------------- */

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const cats = await CustomCategory.find({ ownerId: req.ownerId }).sort({ createdAt: 1 });
    res.json({
      categories: cats.map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        color: c.color,
        description: c.description,
        icon: c.icon,
      })),
    });
  })
);

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const { name, color, description, icon } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const cleanName = name.trim().slice(0, 50);
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!slug) return res.status(400).json({ error: 'Invalid category name' });

    const existing = await CustomCategory.findOne({ ownerId: req.ownerId, slug });
    if (existing) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }

    const cat = await CustomCategory.create({
      ownerId: req.ownerId,
      name: cleanName,
      slug,
      color: typeof color === 'string' && color.startsWith('#') ? color : '#0070F3',
      description: typeof description === 'string' ? description.slice(0, 200) : '',
      icon: typeof icon === 'string' ? icon.slice(0, 30) : 'tag',
    });

    res.status(201).json({
      category: {
        id: cat._id,
        name: cat.name,
        slug: cat.slug,
        color: cat.color,
        description: cat.description,
        icon: cat.icon,
      },
    });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid category id' });
    const cat = await CustomCategory.findOneAndDelete({ _id: req.params.id, ownerId: req.ownerId });
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json({ ok: true, id: req.params.id });
  })
);

export default router;

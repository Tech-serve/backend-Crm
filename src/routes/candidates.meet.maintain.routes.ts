import { Router } from 'express';
import { Types } from 'mongoose';
import { Candidate } from '../db/models/Candidate';

export const candidatesMeetMaintainRouter = Router();

/**
 * Удалить текущий (head) мит кандидата:
 * - очистить root meetLink
 * - убрать первый элемент interviews (если есть)
 */
candidatesMeetMaintainRouter.delete('/candidates/:id/meet', async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ ok: false, error: 'bad id' });

    const doc = await Candidate.findById(id).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'not found' });

    const tail = Array.isArray(doc.interviews) ? (doc.interviews as any[]).slice(1) : [];
    await Candidate.updateOne(
      { _id: id },
      { $unset: { meetLink: '' }, $set: { interviews: tail } },
      { strict: false }
    );

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
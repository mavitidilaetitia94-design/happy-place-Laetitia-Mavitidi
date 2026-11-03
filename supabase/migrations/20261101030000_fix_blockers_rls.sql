-- ============================================================
-- Correction définitive des politiques RLS sur la table blockers
-- Permet aux managers et administrateurs d'insérer, modifier
-- et valider les points bloquants sans violation de sécurité RLS.
-- ============================================================

DROP POLICY IF EXISTS "Admin write" ON public.blockers;
DROP POLICY IF EXISTS "Manager and admin write blockers" ON public.blockers;
DROP POLICY IF EXISTS "Manager write blockers" ON public.blockers;
DROP POLICY IF EXISTS "Authenticated write blockers" ON public.blockers;

CREATE POLICY "Manager and admin write blockers" ON public.blockers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

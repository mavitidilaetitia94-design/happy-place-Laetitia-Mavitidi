-- ============================================================
-- Fix RLS policies on public.blockers to allow managers and admins
-- to insert, update, and delete blockers.
-- ============================================================

DROP POLICY IF EXISTS "Admin write" ON public.blockers;
DROP POLICY IF EXISTS "Manager and admin write blockers" ON public.blockers;

CREATE POLICY "Manager and admin write blockers" ON public.blockers
  FOR ALL TO authenticated
  USING (private.is_admin() OR private.current_app_role() = 'manager'::public.app_role)
  With CHECK (private.is_admin() OR private.current_app_role() = 'manager'::public.app_role);

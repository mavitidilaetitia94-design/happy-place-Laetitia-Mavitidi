import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/manage/")({
  ssr: false,
  component: () => <Navigate to="/manage/news" replace />,
});

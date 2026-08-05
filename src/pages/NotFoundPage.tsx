import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/primitives/EmptyState.tsx';

export default function NotFoundPage(): ReactNode {
  const navigate = useNavigate();
  return (
    <EmptyState
      title="Page not found"
      description="The path you followed doesn't match any view."
      actionLabel="Back to overview"
      onAction={() => { void navigate('/'); }}
    />
  );
}

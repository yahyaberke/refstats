import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={Compass}
        title="Sayfa bulunamadı"
        description="Aradığınız sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir."
        action={
          <Link to={user ? '/app' : '/'} className="btn-primary">
            {user ? 'Panele dön' : 'Ana sayfaya dön'}
          </Link>
        }
      />
    </div>
  );
}

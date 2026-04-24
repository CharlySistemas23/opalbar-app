import { useParams } from 'react-router-dom';
import { UserDetail } from './Users';

export function UserDetailRoute() {
  const { id } = useParams();
  if (!id) return null;
  return <UserDetail id={id} />;
}

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  { to: '/log-call', label: 'Log a Call', roles: ['OPERATOR', 'ADMIN'] },
  { to: '/problems', label: 'Problems', roles: ['OPERATOR', 'SPECIALIST', 'ADMIN'] },
  { to: '/knowledge', label: 'Knowledge Lookup', roles: ['OPERATOR', 'ADMIN'] },
  { to: '/reports', label: 'Reports', roles: ['ANALYST', 'ADMIN'] },
  { to: '/admin', label: 'Admin', roles: ['ADMIN'] }
];

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="nav-bar">
      <span className="nav-brand">Manzaneque Helpdesk</span>
      <nav>
        {LINKS.filter((link) => link.roles.includes(user.role)).map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="nav-user">
        <span>{user.fullName} ({user.role})</span>
        <button onClick={() => { logout(); navigate('/login'); }}>Log out</button>
      </div>
    </header>
  );
}

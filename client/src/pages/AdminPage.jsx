import { useState } from 'react';
import { EmployeesAdmin } from '../components/admin/EmployeesAdmin.jsx';
import { EquipmentAdmin } from '../components/admin/EquipmentAdmin.jsx';
import { ProblemTypesAdmin } from '../components/admin/ProblemTypesAdmin.jsx';

const TABS = [
  { key: 'employees', label: 'Employees', Component: EmployeesAdmin },
  { key: 'equipment', label: 'Equipment', Component: EquipmentAdmin },
  { key: 'problem-types', label: 'Problem Types', Component: ProblemTypesAdmin }
];

// ARCHITECTURE.md §4.2: CRUD for employees, equipment and problem types
// only — everything else is seeded/maintained in SQL.
export function AdminPage() {
  const [tab, setTab] = useState(TABS[0].key);
  const Active = TABS.find((t) => t.key === tab).Component;

  return (
    <div className="page admin-page">
      <h1>Admin</h1>
      <div className="filter-row">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      <Active />
    </div>
  );
}

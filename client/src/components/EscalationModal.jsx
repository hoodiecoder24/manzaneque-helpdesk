import { useState } from 'react';
import { api } from '../api/client.js';

// Brief: look up which specialist to refer to (general-type fallback
// handled server-side by fn_find_specialist), current load determines
// who is picked (sp_assign_least_loaded). A modal on Problem Detail, not
// a separate page — escalation is an action on a problem already open.
export function EscalationModal({ problemId, onClose, onAssigned }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleAssign() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.post(`/api/problems/${problemId}/assign`);
      onAssigned(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Escalate to specialist</h2>
        <p>
          Assigns the least-loaded specialist qualified for this problem's type. If none is
          listed at this exact type, the system falls back to a specialist covering a more
          general type in the same hierarchy branch.
        </p>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="modal-actions">
          <button onClick={onClose} disabled={submitting}>Cancel</button>
          <button onClick={handleAssign} disabled={submitting} className="primary">
            {submitting ? 'Assigning...' : 'Assign least-loaded specialist'}
          </button>
        </div>
      </div>
    </div>
  );
}

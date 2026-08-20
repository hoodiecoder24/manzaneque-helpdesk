import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ProblemTypePicker } from '../components/ProblemTypePicker.jsx';
import { EscalationModal } from '../components/EscalationModal.jsx';

export function ProblemDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [problem, setProblem] = useState(null);
  const [error, setError] = useState(null);

  const [followUpNotes, setFollowUpNotes] = useState('');
  const [reclassifyId, setReclassifyId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showEscalation, setShowEscalation] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/api/problems/${id}`).then(setProblem).catch((err) => setError(err.message));
  }

  useEffect(load, [id]);

  async function submitFollowUp(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.post(`/api/problems/${id}/calls`, { notes: followUpNotes });
      setProblem(updated);
      setFollowUpNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReclassify(e) {
    e.preventDefault();
    if (!reclassifyId) return;
    setBusy(true);
    try {
      const updated = await api.patch(`/api/problems/${id}/type`, { problemTypeId: reclassifyId });
      setProblem(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitResolve(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.post(`/api/problems/${id}/resolve`, { resolutionNotes });
      setProblem(updated);
      setResolutionNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !problem) return <p className="error-text">{error}</p>;
  if (!problem) return <p className="loading">Loading...</p>;

  const canReclassify = user.role === 'OPERATOR' || user.role === 'SPECIALIST' || user.role === 'ADMIN';
  const canFollowUp = user.role === 'OPERATOR' || user.role === 'SPECIALIST' || user.role === 'ADMIN';
  const canResolve = (user.role === 'SPECIALIST' || user.role === 'ADMIN') && problem.status !== 'RESOLVED' && problem.status !== 'CLOSED';
  const canEscalate = user.role === 'OPERATOR' && !problem.assigned_staff_id;

  return (
    <div className="page problem-detail-page">
      <h1>PR-{String(problem.problem_id).padStart(6, '0')}</h1>
      {error && <p className="error-text" role="alert">{error}</p>}

      <dl className="lookup-result">
        <dt>Status</dt><dd>{problem.status}</dd>
        <dt>Priority</dt><dd>{problem.priority}</dd>
        <dt>Type</dt><dd>{problem.problem_type_name}</dd>
        <dt>Caller</dt><dd>{problem.caller_name}</dd>
        <dt>Equipment</dt><dd>{problem.serial_number}</dd>
        <dt>Assigned to</dt><dd>{problem.assigned_staff_name || 'Unassigned'}</dd>
        <dt>Logged</dt><dd>{new Date(problem.logged_at).toLocaleString()}</dd>
        {problem.resolved_at && <><dt>Resolved</dt><dd>{new Date(problem.resolved_at).toLocaleString()} ({problem.minutes_to_resolve} min)</dd></>}
      </dl>

      {canEscalate && (
        <button onClick={() => setShowEscalation(true)}>Escalate to specialist</button>
      )}
      {showEscalation && (
        <EscalationModal problemId={id} onClose={() => setShowEscalation(false)} onAssigned={setProblem} />
      )}

      <section>
        <h2>Call history</h2>
        <ul className="call-history">
          {problem.calls.map((c) => (
            <li key={c.call_log_id}>
              <strong>{c.call_type}</strong> — {new Date(c.logged_at).toLocaleString()} by {c.staff_name}
              <p>{c.notes}</p>
            </li>
          ))}
        </ul>
      </section>

      {canFollowUp && (
        <form onSubmit={submitFollowUp} className="inline-form">
          <h2>Add follow-up call</h2>
          <textarea value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} rows={3} required />
          <button type="submit" disabled={busy || !followUpNotes.trim()}>Add call</button>
        </form>
      )}

      {canReclassify && (
        <form onSubmit={submitReclassify} className="inline-form">
          <h2>Reclassify</h2>
          <ProblemTypePicker value={problem.problem_type_id} onChange={setReclassifyId} />
          <button type="submit" disabled={busy || !reclassifyId}>Reclassify</button>
        </form>
      )}

      {canResolve && (
        <form onSubmit={submitResolve} className="inline-form">
          <h2>Resolve</h2>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={3}
            placeholder="How was this resolved?"
            required
          />
          <button type="submit" disabled={busy || !resolutionNotes.trim()}>Mark resolved</button>
        </form>
      )}
    </div>
  );
}

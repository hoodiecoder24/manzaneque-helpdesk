import { useState } from 'react';
import { api } from '../api/client.js';
import { ProblemTypePicker } from '../components/ProblemTypePicker.jsx';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function LogCallPage() {
  const [callerId, setCallerId] = useState('');
  const [caller, setCaller] = useState(null);
  const [callerError, setCallerError] = useState(null);

  const [serial, setSerial] = useState('');
  const [equipment, setEquipment] = useState(null);
  const [equipmentError, setEquipmentError] = useState(null);

  const [problemTypeId, setProblemTypeId] = useState(null);
  const [priority, setPriority] = useState('MEDIUM');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  async function lookupCaller() {
    setCallerError(null);
    setCaller(null);
    try {
      setCaller(await api.get(`/api/lookup/caller/${callerId}`));
    } catch (err) {
      setCallerError(err.message);
    }
  }

  async function lookupEquipment() {
    setEquipmentError(null);
    setEquipment(null);
    try {
      setEquipment(await api.get(`/api/lookup/equipment/${encodeURIComponent(serial)}`));
    } catch (err) {
      setEquipmentError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await api.post('/api/problems', {
        callerEmployeeId: caller.employee_id,
        equipmentId: equipment.equipment_id,
        problemTypeId,
        priority,
        notes
      });
      setResult(res);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setCallerId(''); setCaller(null); setCallerError(null);
    setSerial(''); setEquipment(null); setEquipmentError(null);
    setProblemTypeId(null); setPriority('MEDIUM'); setNotes('');
    setResult(null); setSubmitError(null);
  }

  if (result) {
    return (
      <div className="page log-call-page">
        <div className="problem-number-banner">
          <h2>Problem logged</h2>
          <p className="problem-number">{result.problemNumber}</p>
          <p>Read this number back to the caller.</p>
          <button onClick={resetForm}>Log another call</button>
        </div>
      </div>
    );
  }

  const canSubmit = caller && equipment && problemTypeId && notes.trim().length > 0;

  return (
    <div className="page log-call-page">
      <h1>Log a Call</h1>

      <section className="lookup-block">
        <h2>Caller</h2>
        <div className="lookup-row">
          <input placeholder="Employee ID" value={callerId} onChange={(e) => setCallerId(e.target.value)} />
          <button type="button" onClick={lookupCaller} disabled={!callerId}>Look up</button>
        </div>
        {callerError && <p className="error-text">{callerError}</p>}
        {caller && (
          <dl className="lookup-result">
            <dt>Name</dt><dd>{caller.first_name} {caller.last_name}</dd>
            <dt>Department</dt><dd>{caller.department_name}</dd>
            <dt>Job title</dt><dd>{caller.title_name}</dd>
          </dl>
        )}
      </section>

      <section className="lookup-block">
        <h2>Equipment</h2>
        <div className="lookup-row">
          <input placeholder="Serial number" value={serial} onChange={(e) => setSerial(e.target.value)} />
          <button type="button" onClick={lookupEquipment} disabled={!serial}>Look up</button>
        </div>
        {equipmentError && <p className="error-text">{equipmentError}</p>}
        {equipment && (
          <dl className="lookup-result">
            <dt>Type</dt><dd>{equipment.equipment_type_name}</dd>
            <dt>Make / model</dt><dd>{equipment.make} {equipment.model}</dd>
            <dt>Assigned to</dt><dd>{equipment.assigned_employee_name || 'Unassigned'}</dd>
            <dt>Licences</dt>
            <dd>
              {equipment.licences.length === 0 && 'No licences on record'}
              {equipment.licences.map((l) => (
                <div key={l.licence_id} className={l.is_valid ? 'licence-valid' : 'licence-invalid'}>
                  {l.software_name}: {l.is_valid ? 'valid' : 'expired/invalid'} (to {l.licence_end_date})
                </div>
              ))}
            </dd>
          </dl>
        )}
      </section>

      <form onSubmit={handleSubmit} className="log-call-form">
        <h2>Problem</h2>
        <label>Problem type</label>
        <ProblemTypePicker value={problemTypeId} onChange={setProblemTypeId} />

        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} required />
        </label>

        {submitError && <p className="error-text" role="alert">{submitError}</p>}
        <button type="submit" disabled={!canSubmit || submitting}>{submitting ? 'Logging...' : 'Log call'}</button>
      </form>
    </div>
  );
}

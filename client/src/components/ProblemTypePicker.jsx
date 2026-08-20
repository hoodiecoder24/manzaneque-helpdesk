import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

// Cascading picker over the problem_type hierarchy: one <select> per
// level, each populated from the previous level's chosen children.
// Selecting a type with no children finalises the pick; selecting one
// with children clears any deeper levels and shows the next select.
export function ProblemTypePicker({ value, onChange }) {
  const [tree, setTree] = useState([]);
  const [path, setPath] = useState([]); // array of chosen node objects, root to leaf

  useEffect(() => {
    api.get('/api/problem-types/tree').then(setTree);
  }, []);

  // Resync the visible path if a value is set externally (e.g. reclassify
  // modal pre-filling the problem's current type) once the tree is loaded.
  useEffect(() => {
    if (!value || tree.length === 0) return;
    const found = findPath(tree, value);
    if (found) setPath(found);
  }, [value, tree]);

  const levels = useMemo(() => {
    const result = [tree];
    for (const node of path) {
      if (node.children?.length) result.push(node.children);
      else break;
    }
    return result;
  }, [tree, path]);

  function handleSelect(levelIndex, id) {
    const options = levels[levelIndex];
    const chosen = options.find((n) => n.problem_type_id === Number(id));
    const newPath = [...path.slice(0, levelIndex), chosen];
    setPath(newPath);
    onChange(chosen.problem_type_id);
  }

  return (
    <div className="problem-type-picker">
      {levels.map((options, i) => (
        options.length > 0 && (
          <select
            key={i}
            value={path[i]?.problem_type_id ?? ''}
            onChange={(e) => handleSelect(i, e.target.value)}
          >
            <option value="" disabled>{i === 0 ? 'Select category...' : 'Select subtype...'}</option>
            {options.map((opt) => (
              <option key={opt.problem_type_id} value={opt.problem_type_id}>{opt.type_name}</option>
            ))}
          </select>
        )
      ))}
    </div>
  );
}

function findPath(nodes, targetId, trail = []) {
  for (const node of nodes) {
    const nextTrail = [...trail, node];
    if (node.problem_type_id === targetId) return nextTrail;
    if (node.children?.length) {
      const found = findPath(node.children, targetId, nextTrail);
      if (found) return found;
    }
  }
  return null;
}

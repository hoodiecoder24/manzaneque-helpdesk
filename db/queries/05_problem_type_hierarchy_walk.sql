-- =====================================================================
-- 05_problem_type_hierarchy_walk.sql
-- Purpose: render the full problem_type tree with each node's depth and
-- its top-level root — used to build the cascading problem-type picker
-- on Log a Call and to sanity-check the hierarchy while it's being
-- maintained on the Admin screen.
-- Demonstrates: WITH RECURSIVE walking a self-referencing FK
-- (parent_type_id) top-down (root -> leaves), the mirror direction of
-- fn_find_specialist's bottom-up walk.
-- Expected output: 22 rows, one per problem_type, ordered so each
-- parent appears before its children.
-- =====================================================================
WITH RECURSIVE type_tree (problem_type_id, type_name, parent_type_id, depth, root_type_name, path) AS (
    SELECT
        problem_type_id, type_name, parent_type_id, 0 AS depth,
        type_name AS root_type_name,
        CAST(type_name AS CHAR(500)) AS path
    FROM problem_type
    WHERE parent_type_id IS NULL

    UNION ALL

    SELECT
        pt.problem_type_id, pt.type_name, pt.parent_type_id, tt.depth + 1,
        tt.root_type_name,
        CONCAT(tt.path, ' > ', pt.type_name)
    FROM problem_type pt
    INNER JOIN type_tree tt ON pt.parent_type_id = tt.problem_type_id
)
SELECT problem_type_id, depth, root_type_name, path
FROM type_tree
ORDER BY path;

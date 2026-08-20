# Technical video script

A script to read while screen recording. Total target time is 15 to 18 minutes. Each section gives a target time, where to go, what should be on screen, and the words to say out loud.

Before recording: have the project open in an editor with line numbers turned on, a browser open to the app, and a terminal ready with the running server and client.

---

## 1. Intro

Target: 30 seconds.

GO TO: nothing on screen yet, or the repository root in the editor.

SHOW: the project folder structure, top level only.

SAY:

"This is the Manzaneque IT Helpdesk system. It is a coursework build for a Pearson HND database unit. Staff use it to log calls from employees about broken equipment, track those problems, escalate them to a specialist, and resolve them. Underneath, almost all of the real logic lives in the database, not in the application code. Views do the reporting, stored procedures do the multi step operations, and triggers keep some values consistent automatically. I am going to walk through the diagrams first, then the database, then the backend that sits on top of it, then show it running."

---

## 2. Diagrams

Target: 1 minute 30 seconds.

Note before recording this section: these five diagram files still need to be created and placed in docs/diagrams/ before this part can be filmed. They are dfd_level_0.png, dfd_level_1.png, flowchart_log_call.png, flowchart_escalation.png, and flowchart_resolution.png.

GO TO: `docs/diagrams/dfd_level_0.png`.

SHOW: the level 0 data flow diagram, one process bubble in the middle labelled Helpdesk System, with four external entities around it, caller, operator, specialist, and analyst.

SAY:

"This is the level 0 data flow diagram, the whole system as one box. The caller reports a problem and gets a problem number back. The operator logs calls, looks things up, and escalates. The specialist works their assigned queue and resolves problems. The analyst pulls reports out. Everything in between those four is the one box in the middle."

GO TO: `docs/diagrams/dfd_level_1.png`.

SHOW: the level 1 data flow diagram, five processes, log a call, look up history, escalate, resolve, and report, with data stores for the main tables.

SAY:

"This is the same system opened up one level. Five processes. Log a call writes into the problem and call log stores and reads from employee and equipment. Look up history reads problem and call log for the Knowledge Lookup screen. Escalate reads problem type and helpdesk staff to find a specialist, then writes back to problem. Resolve writes to problem and call log. And report reads from problem, equipment, and helpdesk staff to produce the four management views."

GO TO: `docs/diagrams/flowchart_log_call.png`.

SHOW: the flowchart for logging a new call.

SAY:

"This flowchart follows sp_log_new_call, the procedure I will walk through properly in a minute. The operator enters a caller id and a serial number, the system looks both up, the operator picks a problem type and priority and writes a note, and on submit the database starts a transaction, inserts the problem row, inserts the first call log row, builds the problem number, and commits. That number comes straight back to the operator."

GO TO: `docs/diagrams/flowchart_escalation.png`.

SHOW: the flowchart for escalation.

SAY:

"This one follows fn_find_specialist and sp_assign_least_loaded together, since they always run as a pair. The system reads the problem's current type, then climbs the type hierarchy looking for a level with an active specialist. If nothing in the whole chain has one, the problem is left unassigned and the operator is told to escalate manually. If one is found, every qualified specialist at that level is ranked by how many open problems they already have, ties broken by whoever was assigned longest ago, and the least loaded one is written onto the problem."

GO TO: `docs/diagrams/flowchart_resolution.png`.

SHOW: the flowchart for resolving a problem.

SAY:

"And this one follows sp_resolve_problem and the trigger that runs alongside it. The specialist submits resolution notes, the procedure updates the problem to RESOLVED, and before that row is actually written, a trigger fires and works out minutes_to_resolve from the gap between when it was logged and when it was resolved. A second trigger then records the status change in the audit log, and a follow up call log row is written noting how it was resolved."

---

## 3. The schema

Target: 2 minutes.

GO TO: `db/01_schema.sql`.

SHOW: scroll slowly through the file as you talk, pausing on each table named below.

SAY:

"This file has 13 tables. Let me group them.

First, the reference tables. Lines 31 to 44. Department and job title. Small lookup tables, nothing complicated.

Next, employee, lines 49 to 64. This is the personnel register, every person in the company who could call the helpdesk. Then equipment type and equipment, lines 69 to 92. Equipment has a foreign key to employee, called assigned_employee_id, and it is set to null on delete. Look at line 91. If an employee record is ever removed, their equipment does not get deleted, it just becomes unassigned.

Then software and software licence, lines 97 to 120. A licence links one piece of equipment to one software product, with a start date and an end date. There is a check constraint on line 119. The end date has to be after the start date. The database will not let you save a licence the wrong way round, no matter what the application sends.

Now problem type, lines 126 to 133. This one is self referencing. Look at parent_type_id on line 129. It is a foreign key that points back at this same table's primary key. That is how the hierarchy works, a specific problem type points at a more general one, and that one can point at an even more general one. I will come back to this when I get to the procedures, because one of them walks this chain.

Next, helpdesk_staff, lines 139 to 151, and specialist_expertise, lines 156 to 164. helpdesk_staff holds login details and a role for anyone who uses the system. It has a one to one link to employee, enforced by the unique constraint on employee_id, line 147. Not every employee is staff, but every staff row belongs to exactly one employee. specialist_expertise is a junction table, it says which specialist covers which problem type, many to many.

Then the two busiest tables, problem and call_log, lines 170 to 213. Problem is the actual ticket. There is a check constraint on line 194, resolved_at has to be null or later than logged_at. Call_log holds every call against a problem, the first one and any follow ups.

Last, audit_log, lines 219 to 228. This table is never written to directly by the application. It is only ever filled in by a trigger, which I will show later."

---

## 4. Indexes

Target: 45 seconds.

GO TO: `db/02_indexes.sql`.

SHOW: scroll through the file, pausing briefly at each CREATE INDEX line.

SAY:

"This file adds indexes on top of what MySQL creates automatically for primary keys and unique columns. Each one exists for a specific query. Line 24 speeds up joining equipment to its type. Lines 30 and 31 speed up the licence validity check that runs every time someone looks up equipment by serial number. Line 37 speeds up the recursive walk up the problem type tree, which I will show in a minute. Line 45 does the same for the join from a problem type down to its specialists. Lines 52 to 64 cover the problem table, which is filtered and sorted by almost every screen and every report. And lines 70 and 71 speed up loading a problem's full call history in order."

---

## 5. The views

Target: 1 minute.

GO TO: `db/03_views.sql`.

SHOW: scroll to each CREATE VIEW line as you name it.

SAY:

"Four views, and each one answers a real management question, not just a convenient query.

Line 18, vw_open_problems_by_age. What is still outstanding, and how long has it been waiting.

Line 48, vw_specialist_workload. How many open problems does each specialist have right now, and what is their average time to resolve one. This is how you would tell if specialists are overloaded.

Line 68, vw_equipment_failure_ranking. Which equipment breaks the most. This ranks every item by how many problems have been logged against it.

Line 89, vw_problem_type_frequency. Where is training needed. This one uses a second recursive query, lines 90 to 98, to roll specific problem types up to their top level category, so the count is meaningful even when problems get logged against very specific subtypes."

---

## 6. The query set

Target: 1 minute 30 seconds.

GO TO: `db/queries/`, showing the folder listing of all seven files.

SHOW: the seven files in the folder.

SAY:

"Alongside the views, there are seven standalone queries, each one written to show off a different piece of SQL. Let me go through them quickly.

File 01, resolved problems, joins six tables with an inner join, and returns full resolution detail, who called, from which department, on what equipment, resolved by which specialist. Inner join is correct here because a resolved or closed problem is always assigned by that point, so every join is expected to match.

File 02, open problems, is almost the same query but with a left join instead, because an open problem can legitimately have no specialist assigned yet, and a left join is the only way to keep that row instead of dropping it.

File 03, overloaded specialists, groups problems by specialist and counts them, then uses a having clause to keep only the specialists whose count is above the company wide average, which is itself worked out with a subquery.

File 04, equipment above average for its type, uses a correlated subquery, the inner query re-runs for every row of the outer query, comparing each piece of equipment's own problem count against the average for other equipment of the same type.

File 05 is a recursive walk down the problem type tree, the opposite direction to the one inside fn_find_specialist, building a readable path like Hardware, then Laptop Issues, then Screen Damage.

File 06 is a left join that finds every piece of equipment with an expired licence or no licence at all.

And file 07 is a three statement update and delete pair, run directly against the seed data, that shows the two referential actions in the schema actually working, a cascade delete on software licence, and a restrict that blocks deleting equipment a problem still points to."

GO TO: a terminal, running query 05 against the database.

SHOW: run `mysql -u root -p manzaneque_helpdesk < db/queries/05_problem_type_hierarchy_walk.sql` and let the real output print.

SAY:

"Let me actually run one of these, so you can see real output rather than just the SQL. This is file 05, the recursive hierarchy walk. Twenty two rows, one per problem type, each one showing its depth and its full path from the top level category down."

---

## 7. The procedures

Target: 3 minutes 15 seconds. This is the most important part of the video, take your time here.

GO TO: `db/04_procedures.sql`.

SHOW: scroll to line 22 first.

SAY:

"This file has one function and three procedures. I will start with the function, because the procedures depend on it.

Lines 22 to 52, fn_find_specialist. This solves a specific line in the brief. If there is no specialist for a specific problem type, fall back to a specialist on a more general type. Let me walk it line by line.

Line 27 declares a variable to hold the answer, starting as null.

Lines 29 to 37 are a recursive common table expression, a recursive CTE. Line 30, the first part, picks the row for the exact problem type you asked about, and gives it depth 0. Lines 33 to 36, the recursive part, joins problem_type to the rows already found, matching a row's own id against the parent id of the previous row. Each time round, depth goes up by one. So this builds a chain starting at the exact type you gave it, and walking up through parent, grandparent, and so on, all the way to the top.

Lines 38 to 49 pick the answer out of that chain. For each row in the chain, it checks with an EXISTS subquery, lines 40 to 47, whether there is at least one active specialist listed for that exact type. Then it orders by depth ascending, line 48, and takes the first match, line 49. So it always prefers the most specific type that actually has a specialist, and only falls back further up the chain if it has to.

Line 51 returns that type id, or null if nothing in the whole chain had a specialist.

Now the procedures that use it. Lines 108 to 160, sp_assign_least_loaded. Line 124 locks the problem row and reads its current type. Line 129 calls fn_find_specialist to resolve that to a type that actually has cover. If that comes back null, lines 131 to 135, the procedure rolls back and leaves the problem unassigned. Otherwise, lines 137 to 152 pick the specialist. It joins specialist_expertise and helpdesk_staff, then left joins a subquery that counts each specialist's currently open problems and their most recent assignment. The order by on lines 149 to 151 sorts by open count ascending first, so the least loaded specialist wins, and breaks ties by whoever was assigned longest ago, so the same person does not always win a tie. Line 152 takes the top one. Lines 154 to 157 write that assignment back onto the problem and set its status to ASSIGNED.

Lines 62 to 97, sp_log_new_call. This is the procedure behind logging a new call. It runs as one transaction, started on line 79. It inserts the new problem row, lines 81 to 87, reads back its generated id on line 89, inserts the first call_log row for it, lines 91 and 92, and builds the problem number the operator reads back to the caller, line 94, which is just the id formatted as PR followed by six digits.

Last, lines 168 to 193, sp_resolve_problem. It updates the problem to RESOLVED and stores the resolution notes, lines 182 to 186, and inserts a follow up call_log row recording that it was resolved, lines 188 to 190. Notice this procedure does not set minutes_to_resolve itself. That is worked out by a trigger, which is next."

---

## 8. The triggers

Target: 45 seconds.

GO TO: `db/05_triggers.sql`.

SHOW: line 17 then line 32.

SAY:

"Two triggers, both on the problem table, both firing on update.

Lines 17 to 24, trg_problem_before_update. Line 21 checks if resolved_at has just been set for the first time. If so, line 22 works out minutes_to_resolve by taking the difference between logged_at and resolved_at. This runs before the row is written, so the value is always correct and the application never has to calculate it or be trusted to send the right number.

Lines 32 to 50, trg_problem_after_update. This writes rows into audit_log whenever status, problem type, or assignment changes. There are three separate checks, one per field, lines 36, 41, and 46. Each one compares the old and new value and, if they are different, inserts one row into audit_log recording what changed. This is what gives the system a full change history without the application ever writing to audit_log directly."

---

## 9. Security

Target: 1 minute 30 seconds.

GO TO: `db/06_roles.sql`.

SHOW: line 15, then line 22, then line 99.

SAY:

"Security starts at the database level. Line 15 creates four roles. Lines 22 to 34 are the operator role's grants, mostly select, plus insert on problem and call_log, and execute on the procedures an operator actually needs. It cannot touch helpdesk_staff at all, there is no grant for it. The specialist and analyst roles follow the same pattern, each one only gets what that job actually needs. Line 99 creates the one database user the application itself connects as, hd_app, and grants it all four roles. The application decides at request time which role's behaviour to allow, the database grants are a second layer underneath that.

Now the application side."

GO TO: `server/src/middleware/auth.js`, lines 8 to 28.

SHOW: the requireAuth function.

SAY:

"This function runs on every protected route. It reads the Authorization header, checks it is a bearer token, and verifies it. If anything is wrong, missing header, bad token, expired token, it returns the exact same generic error either way, so nobody can use the response to work out what went wrong."

GO TO: `server/src/middleware/rbac.js`, lines 7 to 11.

SHOW: the requireRole function.

SAY:

"This is the role check. Every route says which roles are allowed to call it, and this function just checks the logged in user's role is in that list."

GO TO: `server/src/services/auth.service.js`, lines 8 to 34.

SHOW: findActiveStaffByUsername and verifyPassword.

SAY:

"And this is login itself. It looks up the account by username, and line 33 uses bcrypt to compare the submitted password against the stored hash. The plain password is never stored anywhere. Back in the controller, a JWT gets signed containing the user's id and role, and that token is what requireAuth checks on every later request."

---

## 10. The backend layers

Target: 1 minute.

GO TO: `server/src/routes/problem.routes.js`, line 25.

SHOW: the assign route line.

SAY:

"I want to follow one request all the way through, so I will pick escalation, the button that assigns a specialist. Here is the route, line 25. It requires an operator or an admin, and it calls assignProblem in the controller."

GO TO: `server/src/controllers/problem.controller.js`, lines 37 to 47.

SHOW: assignProblem.

SAY:

"The controller checks the problem exists, then calls assignLeastLoaded in the service layer, then checks the result. If no specialist could be found, it returns a specific error the frontend can show, otherwise it returns the updated problem."

GO TO: `server/src/services/problem.service.js`, lines 96 to 105.

SHOW: assignLeastLoaded.

SAY:

"And here is the actual database call. This calls the stored procedure I walked through earlier, sp_assign_least_loaded, and reads back the output parameter. So the route decides who is allowed to call this, the controller decides what to do with the result, and the service is the only place that talks to the database. All the real decision making, who is least loaded, how the fallback works, happens inside the procedure, not in any of this JavaScript."

---

## 11. Validation

Target: 45 seconds.

GO TO: `server/src/validators/employee.validators.js`, lines 6 to 14.

SHOW: employeeCreateSchema.

SAY:

"There are three levels of validation in this system. Take firstName here, line 7. It has to be a string, at least one character, at most 60."

GO TO: `server/src/validators/common.js`, lines 16 to 23.

SHOW: validateBody.

SAY:

"This is where that schema actually gets applied, as middleware, before the request reaches the controller. If it fails, the request never gets near the database."

GO TO: `db/01_schema.sql`, line 51.

SHOW: the first_name column definition.

SAY:

"And here is the database constraint underneath it, first_name, VARCHAR 60, not null. So the same rule exists in three places, a required field with a max length in the client form, a Zod check on the server, and a column definition in the database. Even if the first two were bypassed somehow, the database would still refuse a row that broke the rule."

---

## 12. The frontend

Target: 30 seconds.

GO TO: `client/src/pages/LogCallPage.jsx`, lines 24 to 62.

SHOW: lookupCaller, lookupEquipment, and handleSubmit.

SAY:

"I will keep this part short, this video is really about the database. This page does three things. It looks up the caller by employee id, it looks up the equipment by serial number and shows whether its software licences are valid, and on submit it posts to the problems endpoint, which runs sp_log_new_call. The escalation modal, in EscalationModal.jsx, is even simpler, one button, one call to the assign endpoint."

---

## 13. Live demo

Target: 2 minutes.

GO TO: the browser, `http://localhost:5173`.

SHOW: the login page.

SAY:

"Let me show this actually running, against a real database."

GO TO: log in as an operator account.

SHOW: type the username and password, submit.

SAY:

"I am logging in as an operator."

GO TO: the Log a Call screen.

SHOW: enter an employee id, click look up, enter a serial number, click look up, pick a problem type, write a short note, submit.

SAY:

"I look up the caller, I look up the equipment, and I can see its licence status right there. I pick a problem type, add a note, and log the call. And there is the problem number, ready to read back to the caller."

GO TO: the Problem Detail screen for that new problem.

SHOW: click escalate, then the modal, then assign.

SAY:

"Now I will escalate it. This calls the least loaded specialist procedure I walked through earlier. And it has assigned someone."

GO TO: log out, log back in as that specialist.

SHOW: open the same problem, fill in resolution notes, submit.

SAY:

"Now as the specialist who was just assigned, I resolve it, with a note on how it was fixed."

GO TO: the Reports screen, logged in as an analyst or admin.

SHOW: click through the four report tabs.

SAY:

"And this is the Reports screen, reading straight from those four views. Open problems by age, specialist workload, equipment failures, and problem type frequency."

---

## 14. Close

Target: 30 seconds.

GO TO: `db/maintenance/backup.sh` and `db/maintenance/restore.sh`.

SHOW: scroll through both files briefly.

SAY:

"Last thing. There are backup and restore scripts, they take a timestamped dump of the database and can restore it again, which I have tested against the real database. If I were to keep improving this, the next thing I would add is archiving, moving problems that have been closed for a long time, say a year, out of the main problem table and into an archive table, so the live table stays small and fast as the company keeps using this for years. That is the system, thank you for watching."

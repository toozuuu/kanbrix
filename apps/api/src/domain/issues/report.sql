-- The range is capped at 90 UTC days. Each interval represents the last known state of an issue.
WITH bounds AS (
 SELECT greatest((now() AT TIME ZONE 'UTC')::date-89,
        (tracking.first_seen AT TIME ZONE 'UTC')::date,
        (coalesce(s.start_date,s.created_at) AT TIME ZONE 'UTC')::date) AS first,
        least((now() AT TIME ZONE 'UTC')::date,(coalesce(s.end_date,now()) AT TIME ZONE 'UTC')::date) AS last
 FROM (SELECT min(observed_at) AS first_seen FROM issue_history WHERE project_id=$1) tracking
 LEFT JOIN sprints s ON s.id=$2 AND s.project_id=$1
 WHERE tracking.first_seen IS NOT NULL
), days AS (SELECT generate_series(first::timestamp,last::timestamp,'1 day') AS day FROM bounds),
states AS (
 SELECT *,lead(observed_at) OVER(PARTITION BY issue_id ORDER BY observed_at,seq) AS until
 FROM issue_history WHERE project_id=$1
), counts AS (
 SELECT day, count(h.seq) FILTER(WHERE category='Backlog') AS backlog,
 count(h.seq) FILTER(WHERE category='Todo') AS todo,count(h.seq) FILTER(WHERE category='InProgress') AS active,
 count(h.seq) FILTER(WHERE category='InReview') AS review,count(h.seq) FILTER(WHERE category='Done') AS done
 FROM days LEFT JOIN states h ON h.observed_at < ((day+interval '1 day') AT TIME ZONE 'UTC')
 AND (h.until IS NULL OR h.until >= ((day+interval '1 day') AT TIME ZONE 'UTC'))
 AND NOT h.archived AND ($2::uuid IS NULL OR h.sprint_id=$2)
 GROUP BY day
), finished AS (
 SELECT DISTINCT ON(issue_id) issue_id,sprint_id,observed_at FROM states
 WHERE category='Done' AND NOT archived ORDER BY issue_id,observed_at,seq
), times AS (
 SELECT f.observed_at::timestamptz AS finished,i.created_at,
 (SELECT min(h.observed_at) FROM states h WHERE h.issue_id=f.issue_id AND h.category='InProgress' AND h.observed_at<=f.observed_at) AS started
 FROM finished f JOIN issues i ON i.id=f.issue_id
 WHERE ($2::uuid IS NULL OR f.sprint_id=$2)
 AND NOT EXISTS(SELECT 1 FROM states h WHERE h.issue_id=f.issue_id AND h.baseline)
)
SELECT to_char(c.day,'YYYY-MM-DD') AS day,backlog,todo,active,review,done,
 (SELECT avg(extract(epoch FROM finished-created_at)/86400)::float8 FROM times WHERE (finished AT TIME ZONE 'UTC')::date=c.day::date) AS lead_days,
 (SELECT avg(extract(epoch FROM finished-started)/86400)::float8 FROM times WHERE (finished AT TIME ZONE 'UTC')::date=c.day::date) AS cycle_days
FROM counts c ORDER BY c.day

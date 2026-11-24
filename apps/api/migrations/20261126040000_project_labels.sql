CREATE TABLE project_labels (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, label_id)
);

INSERT INTO project_labels (project_id, label_id)
SELECT DISTINCT i.project_id, il.label_id
FROM issues i JOIN issue_labels il ON il.issue_id = i.id;

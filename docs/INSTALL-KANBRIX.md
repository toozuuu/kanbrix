# Self-host Kanbrix with Docker Compose

Run an MIT-licensed issue tracker on your own server. Kanbrix gives your team Kanban boards, sprint planning, configurable workflows, and Jira import.

## Start the app

Install Git and Docker with Compose, then run these commands on the machine you want to use for evaluation.

```sh
git clone https://github.com/toozuuu/kanbrix.git
cd kanbrix
docker compose up --build -d
```

Open [Kanbrix on localhost](http://localhost:5173). If the app is still starting, check the [API readiness endpoint](http://localhost:8080/ready) and run `docker compose ps`.

## Create a project

1. Register an account. Kanbrix creates a workspace for you.
2. Open **Projects** and create a project, or select **Load sample project** to explore a populated board.
3. Open the board, create an issue, and move it to the next workflow column.

When you are ready to bring in existing work, follow the [Jira import guide](IMPORT-FROM-JIRA.md).

## Deploy for your team

Use the production Compose file behind an HTTPS reverse proxy. Set `SITE_URL` to the public origin and configure a database password before starting the stack. Back up both PostgreSQL and the local uploads volume. [Production deployment instructions](https://github.com/toozuuu/kanbrix/blob/main/docs/DEPLOYMENT.md)

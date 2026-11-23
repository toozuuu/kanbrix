# Deployment Guide

RustTrack can be deployed on any server, VM, or container platform using Docker, Docker Compose, or standalone binaries.

## Recommended Production Topology

```
             Internet / Clients
                     │ (HTTPS :443)
                     ▼
           [ Nginx / Caddy / Traefik ]
              Reverse Proxy & SSL
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
 [ rusttrack-web ]        [ rusttrack-api ]
 Static SPA Files         Axum Backend Service
 (Port 80)                (Port 8080)
                                 │
                                 ▼
                         [ PostgreSQL 16 ]
                         Database
```

## Docker Compose Deployment

1. **Clone repository on your server:**
   ```bash
   git clone https://github.com/your-org/rusttrack.git /opt/rusttrack
   cd /opt/rusttrack
   ```

2. **Configure production environment:**
   ```bash
   cp .env.example .env
   # Edit .env and set:
   # - APP_ENV=production
   # - SESSION_SECRET=<generate 64 chars random string>
   # - DATABASE_URL=postgres://postgres:<secure_pass>@postgres:5432/rusttrack
   # - CLIENT_ORIGIN=https://rusttrack.yourcompany.com
   # - COOKIE_SECURE=true
   ```

3. **Start the stack:**
   ```bash
   docker compose up -d --build
   ```

4. **Verify running containers:**
   ```bash
   docker compose ps
   docker compose logs -f api
   ```

## Nginx Reverse Proxy Configuration

Place in `/etc/nginx/sites-available/rusttrack.conf`:

```nginx
server {
    listen 80;
    server_name rusttrack.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rusttrack.example.com;

    ssl_certificate /etc/letsencrypt/live/rusttrack.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rusttrack.example.com/privkey.pem;

    client_max_body_size 30M;

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend SPA Proxy
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

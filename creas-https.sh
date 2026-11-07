#!/usr/bin/env bash
# Pro Pure : publication HTTPS du tableau de bord Hermès (calqué sur hermes-peru).
set -uo pipefail
fqdn=creas-propure.srv1855720.hstgr.cloud
marker='# Managed by Claude — creas-propure https 2026-11-07.'
avail=/etc/nginx/sites-available/creas-propure-srv1855720
enabled=/etc/nginx/sites-enabled/creas-propure-srv1855720
webroot=/var/www/hermes-acme
state=/root/propure-creas/https
mkdir -p -m 700 "$state"
fail(){ echo "ECHEC: $*"; rm -f "$enabled" "$avail"; nginx -t && systemctl reload nginx; exit 1; }
for t in nginx certbot curl python3; do command -v $t >/dev/null || { echo "manque $t"; exit 1; }; done
[ -e "$avail" ] && ! grep -Fqx "$marker" "$avail" && { echo "fichier inconnu $avail"; exit 1; }

echo "== backend"
for i in $(seq 1 30); do c=$(curl --noproxy '*' -m 5 -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18790/api/summary); [ "$c" = 401 ] && break; sleep 3; done
echo "sessions anonyme -> $c"; [ "$c" = 401 ] || { echo "backend pas pret ou pas protege"; exit 1; }
curl --noproxy '*' -m 5 -fsS http://127.0.0.1:18790/health | python3 -c 'import json,sys; p=json.load(sys.stdin); ok=isinstance(p,dict) and p.get("status")=="ok" and not set(p)-{"status","server_started_at","uptime_seconds"}; print("health", "ok" if ok else p); sys.exit(0 if ok else 1)' || { echo "health non masque"; exit 1; }

cat > "$state/acme.conf" <<EOF
$marker
server {
    listen 80;
    listen [::]:80;
    server_name $fqdn;
    server_tokens off;
    location ^~ /.well-known/acme-challenge/ { root $webroot; default_type text/plain; try_files \$uri =404; }
    location / { return 404; }
}
EOF
cat > "$state/https.conf" <<EOF
$marker
limit_req_zone \$binary_remote_addr zone=creas_propure_login:1m rate=5r/m;
server {
    listen 80;
    listen [::]:80;
    server_name $fqdn;
    server_tokens off;
    location ^~ /.well-known/acme-challenge/ { root $webroot; default_type text/plain; try_files \$uri =404; }
    location / { return 301 https://$fqdn\$request_uri; }
}
server {
    listen 31.97.182.5:443 ssl;
    listen [2a02:4780:41:385d::1]:443 ssl;
    server_name $fqdn;
    if (\$host != $fqdn) { return 444; }
    server_tokens off;
    ssl_certificate /etc/letsencrypt/live/$fqdn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$fqdn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:creas_propure_tls:1m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    access_log /var/log/nginx/creas-propure-access.log;
    error_log /var/log/nginx/creas-propure-error.log warn;
    client_max_body_size 300m;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    send_timeout 3600s;
    location ~ ^/login/?\$ {
        limit_req zone=creas_propure_login burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:18790;
    }
    location / { proxy_pass http://127.0.0.1:18790; }
}
EOF

if [ ! -s /etc/letsencrypt/live/$fqdn/fullchain.pem ]; then
  echo "== acme"
  install -d -m 755 "$webroot/.well-known/acme-challenge"
  install -m 644 "$state/acme.conf" "$avail"; ln -sfn "$avail" "$enabled"
  nginx -t && systemctl reload nginx || fail "nginx acme"
  certbot certonly --webroot --webroot-path "$webroot" --domain "$fqdn" --cert-name "$fqdn" \
    --preferred-challenges http --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring || fail certbot
fi
echo "== https"
install -m 644 "$state/https.conf" "$avail"; ln -sfn "$avail" "$enabled"
nginx -t && systemctl reload nginx || fail "nginx https"
hook=/etc/letsencrypt/renewal-hooks/deploy/creas-propure-nginx-reload.sh
printf '#!/bin/sh\n%s\nnginx -t && systemctl reload nginx\n' "$marker" > "$hook"; chmod 755 "$hook"
sleep 1
echo "public: $(curl -s -m 10 -o /dev/null -w '%{http_code}' --resolve $fqdn:443:31.97.182.5 https://$fqdn/)"
echo "public sessions: $(curl -s -m 10 -o /dev/null -w '%{http_code}' --resolve $fqdn:443:31.97.182.5 https://$fqdn/api/summary)"
systemctl is-active certbot.timer
echo FINI

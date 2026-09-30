#!/usr/bin/env bash
# 소미몰 트래픽을 AWS EC2 (Ubuntu 24.04)에 설치한다.
#
#   curl -fsSL https://raw.githubusercontent.com/t01054532884-lang/somi-mall/main/traffic/deploy/aws-setup.sh | sudo bash
#
# - 앱: /opt/somi-mall/traffic, 데이터: /var/lib/somi-traffic (EBS 디스크라 재부팅해도 유지)
# - Caddy가 HTTPS 인증서를 자동으로 받는다. 도메인이 없으면 traffic.<공인IP>.sslip.io 주소를 쓴다.
# - 6시간마다 쇼핑몰 동기화 + 도매가 자동 확인을 실행한다.
# 다시 실행해도 안전하다 (기존 비밀번호와 데이터는 유지).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/t01054532884-lang/somi-mall.git}"
APP_ROOT=/opt/somi-mall
DATA_DIR=/var/lib/somi-traffic
ENV_FILE=/etc/somi-traffic.env

if [[ $EUID -ne 0 ]]; then
  echo "sudo로 실행해 주세요." >&2
  exit 1
fi

echo "==> 패키지 설치"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git python3-venv curl debian-keyring debian-archive-keyring apt-transport-https gnupg
if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

# 메모리 1GB 서버에서 pip 설치가 멈추지 않도록 스왑을 만든다.
if [[ ! -f /swapfile ]]; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> 코드 받기"
id somi >/dev/null 2>&1 || useradd --system --home "$APP_ROOT" --shell /usr/sbin/nologin somi
if [[ -d "$APP_ROOT/.git" ]]; then
  git -C "$APP_ROOT" pull --ff-only
else
  git clone --depth 1 "$REPO_URL" "$APP_ROOT"
fi
python3 -m venv "$APP_ROOT/traffic/.venv"
"$APP_ROOT/traffic/.venv/bin/pip" install -q --upgrade pip
"$APP_ROOT/traffic/.venv/bin/pip" install -q -r "$APP_ROOT/traffic/requirements.txt"
mkdir -p "$DATA_DIR"
chown -R somi:somi "$DATA_DIR"

echo "==> 환경 설정"
TOKEN=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)
PUBLIC_IP=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 || curl -fsS https://checkip.amazonaws.com)
DEFAULT_DOMAIN="traffic.${PUBLIC_IP//./-}.sslip.io"

if [[ ! -f "$ENV_FILE" ]]; then
  echo
  echo "대시보드 관리자 비밀번호를 정해 주세요 (입력 내용은 화면에 보이지 않습니다)."
  while true; do
    read -rsp "비밀번호: " PASSWORD < /dev/tty; echo
    read -rsp "한 번 더: " PASSWORD2 < /dev/tty; echo
    [[ -n "$PASSWORD" && "$PASSWORD" == "$PASSWORD2" && ${#PASSWORD} -ge 10 ]] && break
    echo "10자 이상이고 두 번 똑같이 입력해야 합니다."
  done
  install -m 600 /dev/null "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
ADMIN_PASSWORD=$PASSWORD
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
CRON_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
DATA_DIR=$DATA_DIR
MALL_EXPORT_URL=
MALL_EXPORT_TOKEN=
ALLOWED_ORIGINS=
EOF
  unset PASSWORD PASSWORD2
fi
chmod 600 "$ENV_FILE"
sed -i "s/^DOMAIN=.*/DOMAIN=${DOMAIN:-$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)}/" "$ENV_FILE"
DOMAIN_VALUE=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)

echo "==> 서비스 등록"
cat > /etc/systemd/system/somi-traffic.service <<EOF
[Unit]
Description=Somimall traffic dashboard
After=network-online.target

[Service]
User=somi
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_ROOT/traffic
ExecStart=$APP_ROOT/traffic/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/somi-traffic-cron.service <<EOF
[Unit]
Description=Somimall traffic sync and price check

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=/bin/sh -c 'curl -fsS -X POST -H "Authorization: Bearer \$CRON_TOKEN" http://127.0.0.1:8000/api/cron/run'
EOF

cat > /etc/systemd/system/somi-traffic-cron.timer <<EOF
[Unit]
Description=Run somimall traffic sync every 6 hours

[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN_VALUE {
	encode gzip
	reverse_proxy 127.0.0.1:8000
}
EOF

systemctl daemon-reload
systemctl enable --now somi-traffic somi-traffic-cron.timer
systemctl restart somi-traffic caddy

sleep 3
if curl -fsS http://127.0.0.1:8000/healthz >/dev/null; then
  echo
  echo "설치 완료: https://$DOMAIN_VALUE"
  echo "(인증서 발급에 1~2분 걸릴 수 있습니다. 보안 그룹에서 80, 443 포트가 열려 있어야 합니다.)"
  echo "쇼핑몰 연동 값은 sudo nano $ENV_FILE 로 넣고 sudo systemctl restart somi-traffic 을 실행하세요."
else
  echo "앱이 시작되지 않았습니다. sudo journalctl -u somi-traffic -n 50 으로 확인해 주세요." >&2
  exit 1
fi

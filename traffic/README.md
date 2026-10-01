# 소미몰 트래픽 (운영 대시보드) — 사용 중단

> **2026-10-01부터 이 기능은 쇼핑몰 관리자 화면(`choose-c.com/admin`)으로 옮겨졌습니다.**
> 재고·발주는 `/admin/inventory`, 도매가 추적은 `/admin/wholesale`, 매출·방문 분석은 `/admin/insights`에 있습니다.
> 이 폴더의 Python 코드는 계산 방식 참고용으로만 남겨 두며, 별도 서버(AWS)는 만들지 않습니다.
> 쇼핑몰의 `/api/traffic/export` 연동 주소도 삭제했으므로 `mall-integration/` 문서는 더 이상 쓰지 않습니다.

쇼핑몰 운영자용 관리자 사이트입니다. 쇼핑몰과 별도 서버로 돌아갑니다.

| 화면 | 하는 일 |
|---|---|
| 대시보드 | 매출·주문·판매 수량·객단가·방문자·구매 전환율, 일별 추이, 잘 팔리는 상품, 유입 경로, 기기, 구매 퍼널 |
| 재고·발주 | 판매 속도로 재고 소진일을 계산하고 발주 추천 수량, 추천 도매처, 예상 발주액을 보여 줌. 발주 기록과 입고 처리. CSV 내려받기(엑셀·구글 시트용) |
| 도매가 추적 | 중국·일본·한국·미국 도매처 가격 기록, 원화 원가(환율 + 배송비 + 관부가세) 환산, 직전 대비 변동, 최저 원가 도매처, 마진 |
| 데이터 연동 | 쇼핑몰 자동 동기화, 주문·상품 CSV 업로드, 방문 추적 코드, 샘플 데이터 |
| 설정 | 환율, 입고 소요일, 안전 재고일, 한 번에 채울 판매일 |

## 발주 추천 계산

- 하루 판매량 = 최근 7일 평균 × 0.6 + 최근 30일 평균 × 0.4 (취소·반품 제외)
- 발주 시점 = 하루 판매량 × (입고 소요일 + 안전 재고일)
- 재고 + 입고 예정 수량이 발주 시점 이하이면, 하루 판매량 × (입고 소요일 + 안전 재고일 + 채울 판매일) − 재고 − 입고 예정만큼 추천합니다. 도매처 최소 주문 수량보다 적으면 최소 수량으로 올립니다.
- 입고 소요일은 그 상품의 최저 원가 도매처 값을 쓰고, 도매처가 없으면 설정의 기본값을 씁니다.

## 도매가 자동 확인

도매 상품 주소를 넣고 "자동 확인"을 켜면, 페이지의 구조화 데이터(JSON-LD)나 `product:price:amount` 메타 태그에서 가격을 읽습니다.
1688, 타오바오, 신상마켓처럼 로그인해야 가격이 보이는 곳은 자동 확인이 안 되므로 가격을 직접 입력해 주세요. 입력할 때마다 기록이 남아 변동 추이를 볼 수 있습니다.
자동 확인은 하루 몇 번 정도만 실행하고, 각 도매 사이트의 이용약관을 확인해 주세요.

## 내 컴퓨터에서 실행

```bash
cd traffic
python -m pip install -r requirements-dev.txt
ADMIN_PASSWORD=원하는비밀번호 python -m uvicorn app.main:app --reload --port 8765
```

http://localhost:8765 에 접속해 로그인한 뒤 **샘플 데이터로 둘러보기**를 누르면 가을 아우터 예시 데이터로 모든 화면을 볼 수 있습니다.
데이터는 `traffic/data/traffic.db`(SQLite)에 저장되며 Git에는 올라가지 않습니다.

테스트:

```bash
cd traffic
python -m unittest discover -s tests -t .
```

## AWS EC2에 배포 (권장)

1. EC2 콘솔에서 서울 리전(ap-northeast-2)에 Ubuntu 24.04, 프리 티어 대상 인스턴스(t3.micro 등)를 만듭니다.
2. 보안 그룹 인바운드에 SSH(22), HTTP(80), HTTPS(443)를 엽니다.
3. EC2 Instance Connect로 접속해 다음 한 줄을 실행하고, 안내에 따라 관리자 비밀번호를 입력합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/t01054532884-lang/somi-mall/main/traffic/deploy/aws-setup.sh | sudo bash
```

설치가 끝나면 `https://traffic.<공인IP>.sslip.io` 주소가 표시됩니다. 도메인을 산 뒤에는 DNS에 `traffic.도메인` A 레코드를 서버 IP로 걸고,
`/etc/somi-traffic.env`의 `DOMAIN`을 바꾼 다음 같은 설치 명령을 다시 실행하면 됩니다. 코드 업데이트도 같은 명령으로 합니다.
공인 IP가 재시작 때 바뀌지 않도록 탄력적 IP(Elastic IP)를 연결해 두세요.

## Render에 배포

1. Render에서 **New → Web Service**를 누르고 이 저장소를 연결합니다.
2. 다음과 같이 입력합니다.
   - Root Directory: `traffic`
   - Runtime: Python
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips "*"`
3. **Disk**를 추가합니다. Mount Path는 `/var/data`, 크기는 1GB면 충분합니다.
4. 환경 변수를 넣습니다.

| 이름 | 값 |
|---|---|
| `ADMIN_PASSWORD` | 대시보드 로그인 비밀번호 (필수) |
| `SECRET_KEY` | 긴 무작위 문자열 (로그인 쿠키 서명용) |
| `DATA_DIR` | `/var/data` |
| `PYTHON_VERSION` | `3.12.7` |
| `CRON_TOKEN` | 긴 무작위 문자열 (정기 작업 호출용) |
| `MALL_EXPORT_URL`, `MALL_EXPORT_TOKEN` | 쇼핑몰 자동 동기화용 (`mall-integration/README.md` 참고) |
| `ALLOWED_ORIGINS` | 쇼핑몰 주소. 다른 사이트의 가짜 방문 기록을 막음 |

`render.yaml`을 블루프린트로 써도 됩니다(New → Blueprint, 경로 `traffic/render.yaml`).

**무료 인스턴스 주의:** Render 무료 웹 서비스는 디스크를 붙일 수 없어서 재배포하거나 재시작하면 SQLite 데이터가 사라집니다. 15분 동안 요청이 없으면 잠들기 때문에 그동안 들어온 방문 기록도 일부 놓칩니다. 실제 운영은 Starter 이상 + Disk로 쓰세요.

## 정기 작업 (동기화 + 도매가 확인)

`POST /api/cron/run`에 `Authorization: Bearer <CRON_TOKEN>`을 붙여 호출하면 쇼핑몰 동기화와 도매가 자동 확인을 한 번에 실행합니다.
GitHub Actions로 무료로 돌리려면 저장소 루트에 `.github/workflows/traffic-cron.yml`을 만들고 저장소 Secrets에 `TRAFFIC_URL`, `TRAFFIC_CRON_TOKEN`을 넣습니다.

```yaml
name: traffic-cron
on:
  schedule:
    - cron: "0 0,6,12 * * *" # 한국 시간 09시, 15시, 21시
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.TRAFFIC_CRON_TOKEN }}" "${{ secrets.TRAFFIC_URL }}/api/cron/run"
```

## 나중에 AWS로 옮길 때

앱은 환경 변수와 `DATA_DIR`만 쓰므로 AWS Lightsail, EC2, App Runner 어디든 같은 시작 명령으로 돌릴 수 있습니다.
데이터가 커지거나 서버를 여러 대로 늘릴 때는 SQLite 대신 PostgreSQL(RDS 등)로 바꾸는 것을 권합니다.

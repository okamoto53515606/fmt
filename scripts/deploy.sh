#!/usr/bin/env bash
# AWS へデプロイ（S3 + CloudFront）
#
#   ./scripts/deploy.sh
#   AWS_PROFILE=my-profile ./scripts/deploy.sh
#   AWS_PROFILE=my-profile DOMAIN_NAME=fmt.okamomedia.tokyo \
#     ACM_CERT_ARN=arn:aws:acm:us-east-1:... ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

STACK_NAME="${STACK_NAME:-fmt}"
REGION="${AWS_REGION:-ap-northeast-1}"
PROFILE="${AWS_PROFILE:-}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
ACM_CERT_ARN="${ACM_CERT_ARN:-}"

if [ -n "$DOMAIN_NAME" ] && [ -z "$ACM_CERT_ARN" ]; then
  echo "エラー: DOMAIN_NAME を指定する場合は ACM_CERT_ARN（us-east-1）も必要です。" >&2
  exit 1
fi

AWS_OPTS=(--region "$REGION")
if [ -n "$PROFILE" ]; then
  AWS_OPTS+=(--profile "$PROFILE")
fi

echo "============================================"
echo " fmt デプロイ"
echo "  profile : ${PROFILE:-（既定の認証情報）}"
echo "  region  : $REGION"
echo "  stack   : $STACK_NAME"
echo "  domain  : ${DOMAIN_NAME:-（CloudFront 既定ドメイン）}"
echo "============================================"

# ---- 1. ビルド（型チェック + SW 生成 + 無通信検査） ----
if [ ! -d node_modules ]; then
  echo "[1/5] 依存パッケージをインストール..."
  npm ci
else
  echo "[1/5] 依存パッケージは導入済み"
fi
echo "[2/5] ビルド..."
npm run build

# ---- 2. スタック ----
echo "[3/5] CloudFormation スタックを適用..."
aws cloudformation deploy \
  "${AWS_OPTS[@]}" \
  --stack-name "$STACK_NAME" \
  --template-file template.yaml \
  --no-fail-on-empty-changeset \
  --parameter-overrides "DomainName=$DOMAIN_NAME" "AcmCertificateArn=$ACM_CERT_ARN"

BUCKET=$(aws cloudformation describe-stacks "${AWS_OPTS[@]}" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
DIST_ID=$(aws cloudformation describe-stacks "${AWS_OPTS[@]}" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
SITE_URL=$(aws cloudformation describe-stacks "${AWS_OPTS[@]}" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" --output text)

# ---- 3. アップロード ----
echo "[4/5] ファイルを S3 へアップロード..."

# 入口（index.html / sw.js）は毎回検証させる
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  "${AWS_OPTS[@]}" \
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"
aws s3 cp dist/sw.js "s3://$BUCKET/sw.js" \
  "${AWS_OPTS[@]}" \
  --cache-control "no-cache" --content-type "application/javascript; charset=utf-8"
aws s3 cp dist/favicon.svg "s3://$BUCKET/favicon.svg" \
  "${AWS_OPTS[@]}" \
  --cache-control "public, max-age=3600" --content-type "image/svg+xml"

# ハッシュ付きのアセットは長期キャッシュ
aws s3 sync dist "s3://$BUCKET" \
  "${AWS_OPTS[@]}" \
  --delete \
  --exclude "index.html" --exclude "sw.js" --exclude "favicon.svg" \
  --cache-control "public, max-age=31536000, immutable"

# ---- 4. キャッシュ無効化 ----
echo "[5/5] CloudFront のキャッシュを無効化..."
aws cloudfront create-invalidation \
  "${AWS_OPTS[@]}" \
  --distribution-id "$DIST_ID" \
  --paths "/" "/index.html" "/sw.js" >/dev/null

echo
echo "完了: $SITE_URL"
echo "DNS: $DOMAIN_NAME の CNAME/Alias を CloudFront（$(aws cloudformation describe-stacks "${AWS_OPTS[@]}" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" --output text)）に向けてください。"

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
# スタックの更新に失敗しても、配信内容（S3 のファイル）は更新できる。
# 実際、CloudFront の設定変更が ACM 証明書の検証で弾かれることがあるため、
# 失敗してもロールバック完了していれば続行し、警告だけ出す。
set +e
aws cloudformation deploy \
  "${AWS_OPTS[@]}" \
  --stack-name "$STACK_NAME" \
  --template-file template.yaml \
  --no-fail-on-empty-changeset \
  --parameter-overrides "DomainName=$DOMAIN_NAME" "AcmCertificateArn=$ACM_CERT_ARN"
CFN_STATUS=$?
set -e

if [ "$CFN_STATUS" -ne 0 ]; then
  CURRENT=$(aws cloudformation describe-stacks "${AWS_OPTS[@]}" \
    --stack-name "$STACK_NAME" --query "Stacks[0].StackStatus" --output text)
  case "$CURRENT" in
    *ROLLBACK_COMPLETE|*_COMPLETE)
      echo "警告: スタックの更新に失敗しました（状態: $CURRENT）。配信設定は直前のまま、ファイルの更新だけ続行します。" >&2
      echo "      設定を変えたい場合は次で原因を確認してください:" >&2
      echo "      aws cloudformation describe-stack-events --stack-name $STACK_NAME --region $REGION" >&2
      ;;
    *)
      echo "エラー: スタックが $CURRENT です。デプロイを中止します。" >&2
      exit 1
      ;;
  esac
fi

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

# OG 画像（ファイル名固定なのでキャッシュは短め。SNS のクローラが読む）
aws s3 cp dist/og.png "s3://$BUCKET/og.png" \
  "${AWS_OPTS[@]}" \
  --cache-control "public, max-age=3600" --content-type "image/png"

# 機能別ページ（/url-encode/ など）の HTML も入口と同じく毎回検証させる
# （scripts/gen-pages.mjs の pages と同じ並び。増やしたらここも足す）
SITE_PAGES="tools url-encode base64 jwt json exif"
for slug in $SITE_PAGES; do
  aws s3 cp "dist/${slug}/index.html" "s3://$BUCKET/${slug}/index.html" \
    "${AWS_OPTS[@]}" \
    --cache-control "no-cache" --content-type "text/html; charset=utf-8"
done

# 404 と、検索・AI 向けのメタファイル（内容が変わったらすぐ反映したい）
aws s3 cp dist/404.html "s3://$BUCKET/404.html" \
  "${AWS_OPTS[@]}" \
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"
aws s3 cp dist/robots.txt "s3://$BUCKET/robots.txt" \
  "${AWS_OPTS[@]}" \
  --cache-control "public, max-age=3600" --content-type "text/plain; charset=utf-8"
aws s3 cp dist/llms.txt "s3://$BUCKET/llms.txt" \
  "${AWS_OPTS[@]}" \
  --cache-control "public, max-age=3600" --content-type "text/plain; charset=utf-8"
aws s3 cp dist/sitemap.xml "s3://$BUCKET/sitemap.xml" \
  "${AWS_OPTS[@]}" \
  --cache-control "public, max-age=3600" --content-type "application/xml"

# ハッシュ付きのアセットは長期キャッシュ
EXCLUDES=(--exclude "index.html" --exclude "sw.js" --exclude "favicon.svg" --exclude "og.png"
  --exclude "404.html" --exclude "robots.txt" --exclude "sitemap.xml" --exclude "llms.txt")
for slug in $SITE_PAGES; do
  EXCLUDES+=(--exclude "${slug}/index.html")
done

aws s3 sync dist "s3://$BUCKET" \
  "${AWS_OPTS[@]}" \
  --delete \
  "${EXCLUDES[@]}" \
  --cache-control "public, max-age=31536000, immutable"

# S3 はディレクトリの index を解決しないため、/url-encode/ へのリクエストは
# url-encode/index.html ではなく「url-encode/」という名前のオブジェクトを探しにいく。
# 同じ HTML をその名前でも置いて、CloudFront 側の設定を増やさずに済ませる。
# （上の sync --delete が毎回消すので、同期のあとで必ずアップロードする）
for slug in $SITE_PAGES; do
  aws s3api put-object \
    "${AWS_OPTS[@]}" \
    --bucket "$BUCKET" \
    --key "${slug}/" \
    --body "dist/${slug}/index.html" \
    --content-type "text/html; charset=utf-8" \
    --cache-control "no-cache" >/dev/null
done

# ---- 4. キャッシュ無効化 ----
echo "[5/5] CloudFront のキャッシュを無効化..."
aws cloudfront create-invalidation \
  "${AWS_OPTS[@]}" \
  --distribution-id "$DIST_ID" \
  --paths "/*" >/dev/null

echo
echo "完了: $SITE_URL"
echo "DNS: $DOMAIN_NAME の CNAME/Alias を CloudFront（$(aws cloudformation describe-stacks "${AWS_OPTS[@]}" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" --output text)）に向けてください。"

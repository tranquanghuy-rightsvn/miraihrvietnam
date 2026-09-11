# tools/ — build tin tức từ data/

`build.js` (Node.js thuần, không dependency ngoài) đọc `data/news/*.json` + `templates/news-*.html`
rồi ghi đè các trang tin tức trong `html/`. Xem đầy đủ quyết định nghiệp vụ ở `../GAS.md`, và
kiến trúc chung ở skill `free-cms-static-site-pipeline` (`static-site-build.md`).

## Chạy

```
node tools/build.js
```

Chạy lại nhiều lần liên tiếp phải **idempotent** — không tự sinh thêm diff nếu `data/` không đổi
(đã test, xem lịch sử commit).

## Đọc gì, ghi gì

- Đọc: `data/news/categories.json`, `data/news/posts.json`, `data/news/<slugVi>/post.json`.
- Ghi:
  - `html/tin-tuc/<slugVi>/index.html` + `html/tin-tuc/index.html` (danh sách, có phân trang).
  - `html/en/news/<slugIntl>/index.html` + `html/en/news/index.html`.
  - `html/jp/news/<slugIntl>/index.html` + `html/jp/news/index.html`.
  - Vá tại chỗ vùng `<!-- NEWS:START -->...<!-- NEWS:END -->` trong `html/sitemap.xml` (phần còn
    lại của sitemap là do người sửa tay, build.js không đụng tới).
- Dọn: thư mục bài viết mồ côi trong `html/tin-tuc/`, `html/en/news/`, `html/jp/news/` (bài đã
  xoá khỏi `data/news/posts.json` nhưng thư mục `.html` build từ lần trước vẫn còn).

## `templates/*.html` — nguồn thiết kế sống

`templates/news-detail-{vi,en,jp}.html` và `templates/news-list-{vi,en,jp}.html` là bản scaffold
từ chính trang thiết kế thật (bài "Kỳ 7"/"Part 7"/"第7回" lúc clone gốc), đã thay các giá trị cụ
thể bằng placeholder `{{TITLE}}`, `{{CONTENT}}`, `{{CAT_LIST}}`... (xem đầu `build.js` để biết
đủ danh sách placeholder từng file). Đây là nơi sửa TAY khi cần đổi design của trang tin tức —
`build.js` chỉ đọc để render, không tự sinh lại các file này.

⚠️ Không sửa trực tiếp `html/tin-tuc/**`, `html/en/news/**`, `html/jp/news/**` (trừ
`index.html`/`263` cũ đã bị build.js ghi đè) — mọi sửa tay ở đó sẽ MẤT ở lần build kế tiếp.

## `/admin/` không nằm trong pipeline build

`html/admin/index.html` là file tĩnh, sửa tay, `build.js` cố ý KHÔNG sinh lại (xem
`static-site-build.md` mục 10 — nội dung chỉ đổi khi deploy lại CMS ra URL `/exec` mới, một hành
động hiếm và luôn cần sửa tay dù theo hướng nào).

## CI

`.github/workflows/build.yml` chạy `node tools/build.js` mỗi khi `data/news/posts.json` hoặc
`data/news/categories.json` đổi trên nhánh `master` (2 file "chốt" — luôn là commit CUỐI CÙNG của
1 thao tác Lưu/Xoá từ CMS, xem GAS.md mục VIII), rồi tự commit `html/` nếu có thay đổi. Cloudflare
Pages (nối Git qua dashboard) tự deploy commit mới đó — không cần bước deploy riêng trong workflow.

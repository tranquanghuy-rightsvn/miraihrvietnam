#!/usr/bin/env node
/**
 * Build tĩnh cho tin tức 3 ngôn ngữ (Vi/En/Jp) từ data/news/*.json + templates/*.html.
 * Xem GAS.md + free-cms-static-site-pipeline/references/static-site-build.md.
 *
 * Đọc:
 *   data/news/categories.json, data/news/posts.json, data/news/<slugVi>/post.json
 *   templates/news-detail-{vi,en,jp}.html, templates/news-list-{vi,en,jp}.html
 * Ghi:
 *   html/tin-tuc/<slugVi>/index.html            (+ html/tin-tuc/index.html)
 *   html/en/news/<slugIntl>/index.html           (+ html/en/news/index.html)
 *   html/jp/news/<slugIntl>/index.html           (+ html/jp/news/index.html)
 * Dọn: thư mục con mồ côi (bài đã xoá khỏi data/ nhưng thư mục .html cũ vẫn còn) - xem
 * static-site-build.md mục 8.
 *
 * Chạy: node tools/build.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "news");
const TEMPLATES_DIR = path.join(ROOT, "templates");
const HTML_DIR = path.join(ROOT, "html");
const SITE = "https://miraihrvietnam.com";
const PAGE_SIZE = 6;

function readJSON(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
}

function fill(tpl, map) {
  let out = tpl;
  for (const key of Object.keys(map)) {
    out = out.split("{{" + key + "}}").join(map[key] == null ? "" : map[key]);
  }
  if (/\{\{[A-Z_]+\}\}/.test(out)) {
    const left = out.match(/\{\{[A-Z_]+\}\}/g);
    throw new Error("Còn placeholder chưa điền: " + left.join(", "));
  }
  return out;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJson(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Card + trang danh sách LUÔN hiển thị ngày dạng dd/mm/yyyy ở CẢ 3 ngôn ngữ (đúng design gốc
 * đã kiểm - khác trang chi tiết, nơi bản Jp dùng định dạng "yyyy年m月d日"). */
function formatDateShort(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}
function formatDateJpLong(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function writeFile(relPath, content) {
  const full = path.join(HTML_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// ================= Load data =================

const categories = readJSON(path.join(DATA_DIR, "categories.json"), []);
const postsIndex = readJSON(path.join(DATA_DIR, "posts.json"), []);

function catByVi(slugVi) {
  return categories.find((c) => c.slugVi === slugVi);
}

function loadFullPost(slugVi) {
  return readJSON(path.join(DATA_DIR, slugVi, "post.json"), null);
}

const sortedMetas = postsIndex
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

// ================= Sidebar "Danh mục"/"Categories"/"カテゴリー" =================
// Liệt kê TOÀN BỘ danh mục hiện có, mỗi mục trỏ về trang danh sách tin tức chung (KHÔNG lọc
// theo danh mục - dự án này chưa có trang lọc riêng, xem GAS.md mục IV.4).

function renderCatListVi() {
  return categories
    .map((c) => `<li>\n                      <a href="/tin-tuc"><span>${escapeHtml(c.nameVi)}</span></a>\n                    </li>`)
    .join("\n                    ");
}
function renderCatListEn() {
  return categories
    .map((c) => `<li>\n                      <a href="/en/news"><span>${escapeHtml(c.nameEn)}</span></a>\n                    </li>`)
    .join("\n                    ");
}
function renderCatListJp() {
  return categories
    .map(
      (c) =>
        `<li>\n                      <a href="/jp/news"\n                        ><span class="hyphen"> &gt; </span\n                        ><span>${escapeHtml(c.nameJp)}</span></a\n                      >\n                    </li>`
    )
    .join("\n                    ");
}

// ================= Trang chi tiết =================

const DETAIL_TEMPLATES = {
  vi: readTemplate("news-detail-vi.html"),
  en: readTemplate("news-detail-en.html"),
  jp: readTemplate("news-detail-jp.html"),
};

const validPostDirs = { vi: new Set(), en: new Set(), jp: new Set() };

sortedMetas.forEach((meta) => {
  const full = loadFullPost(meta.slugVi);
  if (!full) {
    console.warn("[build] Bỏ qua - thiếu data/news/" + meta.slugVi + "/post.json");
    return;
  }
  const cat = catByVi(full.cat);
  const imgSrc = full.img ? `/assets/images/${full.img}` : "";
  const pathVi = `/tin-tuc/${full.slugVi}`;
  const pathEn = `/en/news/${full.slugIntl}`;
  const pathJp = `/jp/news/${full.slugIntl}`;
  const urlVi = SITE + pathVi;
  const urlEn = SITE + pathEn;
  const urlJp = SITE + pathJp;
  const catListVi = renderCatListVi();
  const catListEn = renderCatListEn();
  const catListJp = renderCatListJp();

  const viHtml = fill(DETAIL_TEMPLATES.vi, {
    TITLE: escapeHtml(full.titleVi + " | MIRAI VIET NAM HR CONSULTING"),
    DESC: escapeHtml(full.excerptVi),
    URL_VI: urlVi,
    URL_EN: urlEn,
    URL_JP: urlJp,
    PATH_VI: pathVi,
    PATH_EN: pathEn,
    PATH_JP: pathJp,
    H1: escapeHtml(full.titleVi),
    H1_JSON: escapeJson(full.titleVi),
    IMG_SRC: escapeHtml(imgSrc),
    DATE_ISO: full.date,
    DATE_DISPLAY: formatDateShort(full.date),
    CAT_NAME: escapeHtml(cat ? cat.nameVi : ""),
    CONTENT: full.contentVi,
    CAT_LIST: catListVi,
  });
  writeFile(`tin-tuc/${full.slugVi}/index.html`, viHtml);
  validPostDirs.vi.add(full.slugVi);

  const enHtml = fill(DETAIL_TEMPLATES.en, {
    TITLE: escapeHtml(full.titleEn + " | MIRAI VIET NAM HR CONSULTING"),
    DESC: escapeHtml(full.excerptEn),
    URL_VI: urlVi,
    URL_EN: urlEn,
    URL_JP: urlJp,
    PATH_VI: pathVi,
    PATH_EN: pathEn,
    PATH_JP: pathJp,
    H1: escapeHtml(full.titleEn),
    H1_JSON: escapeJson(full.titleEn),
    IMG_SRC: escapeHtml(imgSrc),
    DATE_ISO: full.date,
    DATE_DISPLAY: formatDateShort(full.date),
    CAT_NAME: escapeHtml(cat ? cat.nameEn : ""),
    CONTENT: full.contentEn,
    CAT_LIST: catListEn,
  });
  writeFile(`en/news/${full.slugIntl}/index.html`, enHtml);
  validPostDirs.en.add(full.slugIntl);

  const jpHtml = fill(DETAIL_TEMPLATES.jp, {
    TITLE: escapeHtml(full.titleJp + "｜MIRAI VIET NAM HR CONSULTING"),
    DESC: escapeHtml(full.excerptJp),
    URL_VI: urlVi,
    URL_EN: urlEn,
    URL_JP: urlJp,
    PATH_VI: pathVi,
    PATH_EN: pathEn,
    PATH_JP: pathJp,
    H1: escapeHtml(full.titleJp),
    H1_JSON: escapeJson(full.titleJp),
    IMG_SRC: escapeHtml(imgSrc),
    DATE_ISO: full.date,
    DATE_DISPLAY_JP: formatDateJpLong(full.date),
    CAT_NAME: escapeHtml(cat ? cat.nameJp : ""),
    CONTENT: full.contentJp,
    CAT_LIST_JP: catListJp,
  });
  writeFile(`jp/news/${full.slugIntl}/index.html`, jpHtml);
  validPostDirs.jp.add(full.slugIntl);
});

// ================= Trang danh sách (có phân trang) =================

const LIST_TEMPLATES = {
  vi: readTemplate("news-list-vi.html"),
  en: readTemplate("news-list-en.html"),
  jp: readTemplate("news-list-jp.html"),
};

function renderCardVi(meta) {
  const url = `/tin-tuc/${meta.slugVi}`;
  const img = meta.img ? `/assets/images/${meta.img}` : "";
  return `<article class="news-card js-fade-up">
                    <a href="${url}" class="news-card__thumb">
                      <img src="${escapeHtml(img)}" alt="${escapeHtml(meta.titleVi)}" loading="lazy" />
                    </a>
                    <div class="news-card__body">
                      <div class="news-card__date">
                        <i class="fa fa-calendar-o" aria-hidden="true"></i>
                        <time datetime="${meta.date}">${formatDateShort(meta.date)}</time>
                      </div>
                      <h3 class="news-card__title">
                        <a href="${url}">${escapeHtml(meta.titleVi)}</a>
                      </h3>
                      <p class="news-card__desc">${escapeHtml(meta.excerptVi)}</p>
                      <a href="${url}" class="news-card__more">Đọc tiếp <i class="fa fa-long-arrow-right"></i></a>
                    </div>
                  </article>`;
}
function renderCardEn(meta) {
  const url = `/en/news/${meta.slugIntl}`;
  const img = meta.img ? `/assets/images/${meta.img}` : "";
  return `<article class="news-card js-fade-up">
                    <a href="${url}" class="news-card__thumb">
                      <img src="${escapeHtml(img)}" alt="${escapeHtml(meta.titleEn)}" loading="lazy" />
                    </a>
                    <div class="news-card__body">
                      <div class="news-card__date">
                        <i class="fa fa-calendar-o" aria-hidden="true"></i>
                        <time datetime="${meta.date}">${formatDateShort(meta.date)}</time>
                      </div>
                      <h3 class="news-card__title">
                        <a href="${url}">${escapeHtml(meta.titleEn)}</a>
                      </h3>
                      <p class="news-card__desc">${escapeHtml(meta.excerptEn)}</p>
                      <a href="${url}" class="news-card__more">Read more <i class="fa fa-long-arrow-right"></i></a>
                    </div>
                  </article>`;
}
function renderCardJp(meta) {
  const url = `/jp/news/${meta.slugIntl}`;
  const img = meta.img ? `/assets/images/${meta.img}` : "";
  return `<article class="news-card js-fade-up">
                    <a href="${url}" class="news-card__thumb">
                      <img src="${escapeHtml(img)}" alt="${escapeHtml(meta.titleJp)}" loading="lazy" />
                    </a>
                    <div class="news-card__body">
                      <div class="news-card__date">
                        <i class="fa fa-calendar-o" aria-hidden="true"></i>
                        <time datetime="${meta.date}">${formatDateShort(meta.date)}</time>
                      </div>
                      <h3 class="news-card__title">
                        <a href="${url}">${escapeHtml(meta.titleJp)}</a>
                      </h3>
                      <p class="news-card__desc">${escapeHtml(meta.excerptJp)}</p>
                      <a href="${url}" class="news-card__more">続きを読む <i class="fa fa-long-arrow-right"></i></a>
                    </div>
                  </article>`;
}

function chunk(arr, size) {
  const pages = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages.length ? pages : [[]];
}

function renderPagesHtml(pages, renderCard) {
  return pages
    .map((items, idx) => {
      const pageNum = idx + 1;
      const cls = pageNum === 1 ? "news-page is-active" : "news-page";
      const hidden = pageNum === 1 ? "" : " hidden";
      const cards = items.map(renderCard).join("\n\n                  ");
      return `<div class="${cls}" data-page="${pageNum}"${hidden}>\n                  ${cards}\n                </div>`;
    })
    .join("\n\n                ");
}

const PAGINATION_STRINGS = {
  vi: { aria: "Phân trang tin tức", prev: '<i class="fa fa-angle-left"></i> Trước', next: 'Sau <i class="fa fa-angle-right"></i>' },
  en: { aria: "News pagination", prev: '<i class="fa fa-angle-left"></i> Prev', next: 'Next <i class="fa fa-angle-right"></i>' },
  jp: { aria: "ニュースのページネーション", prev: '<i class="fa fa-angle-left"></i> 前へ', next: '次へ <i class="fa fa-angle-right"></i>' },
};

function renderPaginationHtml(totalPages, lang) {
  if (totalPages <= 1) return "";
  const s = PAGINATION_STRINGS[lang];
  let buttons = "";
  for (let p = 1; p <= totalPages; p++) {
    buttons += `<button type="button" class="news-pagination__btn${p === 1 ? " is-active" : ""}" data-page="${p}">${p}</button>\n                  `;
  }
  return `<nav class="news-pagination" aria-label="${s.aria}">
                  <button type="button" class="news-pagination__btn news-pagination__btn--prev" data-action="prev">${s.prev}</button>
                  ${buttons}<button type="button" class="news-pagination__btn news-pagination__btn--next" data-action="next">${s.next}</button>
                </nav>`;
}

const pages = chunk(sortedMetas, PAGE_SIZE);
const totalPages = pages.length;

writeFile(
  "tin-tuc/index.html",
  fill(LIST_TEMPLATES.vi, {
    PAGES: renderPagesHtml(pages, renderCardVi),
    PAGINATION: renderPaginationHtml(totalPages, "vi"),
    CAT_LIST: renderCatListVi(),
  })
);
writeFile(
  "en/news/index.html",
  fill(LIST_TEMPLATES.en, {
    PAGES: renderPagesHtml(pages, renderCardEn),
    PAGINATION: renderPaginationHtml(totalPages, "en"),
    CAT_LIST: renderCatListEn(),
  })
);
writeFile(
  "jp/news/index.html",
  fill(LIST_TEMPLATES.jp, {
    PAGES: renderPagesHtml(pages, renderCardJp),
    PAGINATION: renderPaginationHtml(totalPages, "jp"),
    CAT_LIST_JP: renderCatListJp(),
  })
);

// ================= Dọn thư mục bài viết mồ côi =================
// Bài đã xoá khỏi data/news/posts.json nhưng thư mục html/tin-tuc/<slug>/, html/en/news/<slug>/,
// html/jp/news/<slug>/ build từ lần trước vẫn còn - xoá để không bị Google tiếp tục index nội
// dung đã xoá (static-site-build.md mục 8). CHỈ quét đúng 3 thư mục cha này (không đệ quy ra
// ngoài), và CHỈ xoá thư mục con là 1 bài viết build ra (không đụng file/thư mục tĩnh khác nằm
// cùng cấp, vd html/tin-tuc/index.html không phải thư mục nên an toàn).

function pruneOrphanDirs(parentRel, validSlugs) {
  const parent = path.join(HTML_DIR, parentRel);
  if (!fs.existsSync(parent)) return;
  for (const name of fs.readdirSync(parent)) {
    const full = path.join(parent, name);
    if (!fs.statSync(full).isDirectory()) continue;
    if (validSlugs.has(name)) continue;
    fs.rmSync(full, { recursive: true, force: true });
    console.log("[build] Đã dọn thư mục mồ côi:", path.join(parentRel, name));
  }
}

pruneOrphanDirs("tin-tuc", validPostDirs.vi);
pruneOrphanDirs(path.join("en", "news"), validPostDirs.en);
pruneOrphanDirs(path.join("jp", "news"), validPostDirs.jp);

// ================= Trang chủ: vá tại chỗ khối "Tin tức mới nhất" =================
// Trang chủ (html/index.html + html/en/index.html + html/jp/index.html) là file TĨNH, sửa tay
// (architecture.md - "trang chủ KHÔNG dùng template như các trang khác"), CI chỉ vá đúng 1 vùng
// động: khối 3 thẻ tin tức mới nhất. Tìm mốc neo cố định (KHÔNG dùng comment neo vì đây vốn đã
// là markup thật có sẵn từ bản clone, không phải file build.js tự sinh từ đầu), thay nội dung
// bên trong, giữ nguyên phần còn lại. Nếu không tìm thấy mốc neo -> log cảnh báo rõ ràng, KHÔNG
// lỗi âm thầm (xem architecture.md).

const HOME_NEWS_START = '<div class="row justify-content-center g-4">';
const HOME_NEWS_END = '<div class="d-flex justify-content-center mt-5 mb-4">';
const HOME_NEWS_COUNT = 3;

function homeCardVi(meta) {
  return `<div class="col-12 col-lg-4 pb-3">
                ${renderCardVi(meta).replace('class="news-card js-fade-up"', 'class="news-card h-100 js-fade-up"')}
              </div>`;
}
function homeCardEn(meta) {
  return `<div class="col-12 col-lg-4 pb-3">
                ${renderCardEn(meta).replace('class="news-card js-fade-up"', 'class="news-card h-100 js-fade-up"')}
              </div>`;
}
function homeCardJp(meta) {
  return `<div class="col-12 col-lg-4 pb-3">
                ${renderCardJp(meta).replace('class="news-card js-fade-up"', 'class="news-card h-100 js-fade-up"')}
              </div>`;
}

function patchHomeNews(relPath, renderHomeCard) {
  const full = path.join(HTML_DIR, relPath);
  if (!fs.existsSync(full)) {
    console.warn("[build] Không thấy " + relPath + " - bỏ qua vá khối tin tức trang chủ.");
    return;
  }
  const raw = fs.readFileSync(full, "utf8");
  const startIdx = raw.indexOf(HOME_NEWS_START);
  const endIdx = raw.indexOf(HOME_NEWS_END, startIdx);
  if (startIdx === -1 || endIdx === -1) {
    console.warn("[build] Không tìm thấy mốc neo khối tin tức trong " + relPath + " - bỏ qua (có thể design trang chủ đã đổi).");
    return;
  }
  const latest = sortedMetas.slice(0, HOME_NEWS_COUNT);
  const cardsHtml = latest.map(renderHomeCard).join("\n              ");
  const replacement = `${HOME_NEWS_START}\n              ${cardsHtml}\n            ` ;
  const newContent = raw.slice(0, startIdx) + replacement + raw.slice(endIdx);
  fs.writeFileSync(full, newContent);
}

patchHomeNews("index.html", homeCardVi);
patchHomeNews(path.join("en", "index.html"), homeCardEn);
patchHomeNews(path.join("jp", "index.html"), homeCardJp);

// ================= sitemap.xml: vá tại chỗ vùng NEWS:START..NEWS:END =================
// Phần còn lại của sitemap.xml (trang chủ, dịch vụ, việc làm...) do NGƯỜI sửa tay - build.js
// CHỈ ghi đè đúng khối 3 URL vi/jp/en của mỗi bài viết, đánh dấu bằng 2 comment neo (xem
// architecture.md mục "vì sao trang chủ không dùng template" - cùng kỹ thuật "vá tại chỗ").

function sitemapUrlBlock(loc, altVi, altJa, altEn, altDefault, lastmod) {
  return `  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="vi" href="${altVi}" />
    <xhtml:link rel="alternate" hreflang="ja" href="${altJa}" />
    <xhtml:link rel="alternate" hreflang="en" href="${altEn}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${altDefault}" />
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
}

function updateSitemap() {
  const sitemapPath = path.join(HTML_DIR, "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) {
    console.warn("[build] Không thấy html/sitemap.xml - bỏ qua bước cập nhật sitemap.");
    return;
  }
  const startTag = "<!-- NEWS:START";
  const endTag = "<!-- NEWS:END -->";
  const raw = fs.readFileSync(sitemapPath, "utf8");
  const startIdx = raw.indexOf(startTag);
  const endIdx = raw.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1) {
    console.warn("[build] Không tìm thấy neo NEWS:START/NEWS:END trong sitemap.xml - bỏ qua.");
    return;
  }
  const blocks = sortedMetas.map((meta) => {
    const urlVi = `${SITE}/tin-tuc/${meta.slugVi}`;
    const urlEn = `${SITE}/en/news/${meta.slugIntl}`;
    const urlJp = `${SITE}/jp/news/${meta.slugIntl}`;
    const lastmod = String(meta.updatedAt || meta.date).slice(0, 10);
    return [
      sitemapUrlBlock(urlVi, urlVi, urlJp, urlEn, urlVi, lastmod),
      sitemapUrlBlock(urlJp, urlVi, urlJp, urlEn, urlVi, lastmod),
      sitemapUrlBlock(urlEn, urlVi, urlJp, urlEn, urlVi, lastmod),
    ].join("\n");
  });
  // Tìm điểm chèn: ngay sau dòng chứa startTag (giữ nguyên comment neo mở), tới ngay trước endTag.
  const afterStartLine = raw.indexOf("\n", startIdx) + 1;
  const newContent = raw.slice(0, afterStartLine) + (blocks.length ? blocks.join("\n") + "\n" : "") + raw.slice(endIdx);
  fs.writeFileSync(sitemapPath, newContent);
}

updateSitemap();

console.log(`[build] Xong - ${sortedMetas.length} bài viết, ${categories.length} danh mục, ${totalPages} trang danh sách/ngôn ngữ.`);

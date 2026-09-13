#!/usr/bin/env node
/**
 * Build tĩnh cho tin tức 3 ngôn ngữ (Vi/En/Jp) từ data/news/*.json + templates/*.html.
 * Xem GAS.md + free-cms-static-site-pipeline/references/static-site-build.md.
 *
 * Đọc:
 *   data/news/categories.json, data/news/posts.json, data/news/<slugVi>/post.json
 *   templates/news-detail-{vi,en,jp}.html, templates/news-list-{vi,en,jp}.html
 * Ghi:
 *   html/tin-tuc/<slugVi>/index.html                  (+ html/tin-tuc/index.html)
 *   html/en/news/<slugIntl>/index.html                 (+ html/en/news/index.html)
 *   html/jp/news/<slugIntl>/index.html                 (+ html/jp/news/index.html)
 *   html/tin-tuc/danh-muc/<catSlugVi>/index.html       (trang danh mục, lọc theo cat)
 *   html/en/news/category/<catSlugIntl>/index.html
 *   html/jp/news/category/<catSlugIntl>/index.html
 * Dọn: thư mục con mồ côi (bài/danh mục đã xoá khỏi data/ nhưng thư mục .html cũ vẫn còn) - xem
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

// ================= Đường dẫn trang danh mục =================
// GAS.md mục IV.4 (chốt lại 13/09/2026 - trước đó CHƯA có trang lọc riêng, khách phản hồi cần
// bấm được vào danh mục): mỗi danh mục có 1 trang liệt kê RIÊNG (lọc đúng bài thuộc danh mục
// đó), URL theo slug riêng từng ngôn ngữ (Vi dùng slugVi, En/Jp dùng CHUNG slugIntl - đúng quy
// ước slug bài viết, GAS.md mục II.2).

function catPathVi(cat) {
  return `/tin-tuc/danh-muc/${cat.slugVi}`;
}
function catPathEn(cat) {
  return `/en/news/category/${cat.slugIntl}`;
}
function catPathJp(cat) {
  return `/jp/news/category/${cat.slugIntl}`;
}

// ================= Sidebar "Danh mục"/"Categories"/"カテゴリー" =================
// Liệt kê TOÀN BỘ danh mục hiện có, mỗi mục trỏ THẲNG vào trang danh mục tương ứng.

function renderCatListVi() {
  return categories
    .map((c) => `<li>\n                      <a href="${catPathVi(c)}"><span>${escapeHtml(c.nameVi)}</span></a>\n                    </li>`)
    .join("\n                    ");
}
function renderCatListEn() {
  return categories
    .map((c) => `<li>\n                      <a href="${catPathEn(c)}"><span>${escapeHtml(c.nameEn)}</span></a>\n                    </li>`)
    .join("\n                    ");
}
function renderCatListJp() {
  return categories
    .map(
      (c) =>
        `<li>\n                      <a href="${catPathJp(c)}"\n                        ><span class="hyphen"> &gt; </span\n                        ><span>${escapeHtml(c.nameJp)}</span></a\n                      >\n                    </li>`
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

// Breadcrumb: 2 dạng - trang danh sách chung (2 mục) và trang danh mục (3 mục, mục giữa là link
// quay lại danh sách chung). Trả về ĐÚNG nội dung bên trong <ol class="breadcrumb container">.
function breadcrumbMain(lang) {
  if (lang === "vi") {
    return `<li class="breadcrumb-item"><a class="breadcrumb__link" href="/">Trang chủ</a></li><li class="breadcrumb-item" aria-current="page">Tin tức</li>`;
  }
  if (lang === "en") {
    return `<li class="breadcrumb-item"><a class="breadcrumb__link" href="/en/">Home</a></li><li class="breadcrumb-item" aria-current="page">News</li>`;
  }
  return `<li class="breadcrumb-item"><a class="breadcrumb__link" href="/jp/">ホーム</a></li><li class="breadcrumb-item" aria-current="page">ニュース</li>`;
}
function breadcrumbCategory(lang, catName) {
  const name = escapeHtml(catName);
  if (lang === "vi") {
    return `<li class="breadcrumb-item"><a class="breadcrumb__link" href="/">Trang chủ</a></li><li class="breadcrumb-item"><a class="breadcrumb__link" href="/tin-tuc">Tin tức</a></li><li class="breadcrumb-item" aria-current="page">${name}</li>`;
  }
  if (lang === "en") {
    return `<li class="breadcrumb-item"><a class="breadcrumb__link" href="/en/">Home</a></li><li class="breadcrumb-item"><a class="breadcrumb__link" href="/en/news">News</a></li><li class="breadcrumb-item" aria-current="page">${name}</li>`;
  }
  return `<li class="breadcrumb-item"><a class="breadcrumb__link" href="/jp/">ホーム</a></li><li class="breadcrumb-item"><a class="breadcrumb__link" href="/jp/news">ニュース</a></li><li class="breadcrumb-item" aria-current="page">${name}</li>`;
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

const MAIN_URL_VI = SITE + "/tin-tuc";
const MAIN_URL_EN = SITE + "/en/news";
const MAIN_URL_JP = SITE + "/jp/news";
const MAIN_DESC_VI =
  "Tin tức tuyển dụng tại Nhật Bản, thị trường lao động Việt - Nhật, visa và kỹ năng đặc định (Tokutei Ginō), đầu tư kinh doanh và kết nối thương mại Việt - Nhật.";
const MAIN_DESC_EN =
  "News on recruitment in Japan, the Vietnam-Japan labor market, visas and Specified Skilled Worker (Tokutei Ginō), business investment, and Vietnam-Japan trade connections.";
const MAIN_DESC_JP =
  "日本の求人情報、ベトナム・日本労働市場、ビザ・特定技能、ベトナムでの投資・ビジネス、ベトナム・日本貿易連携に関するニュースをお届けします。";

writeFile(
  "tin-tuc/index.html",
  fill(LIST_TEMPLATES.vi, {
    TITLE: "Tin tức | MIRAI VIET NAM HR CONSULTING",
    DESC: MAIN_DESC_VI,
    URL_VI: MAIN_URL_VI,
    URL_EN: MAIN_URL_EN,
    URL_JP: MAIN_URL_JP,
    BREADCRUMB: breadcrumbMain("vi"),
    H1: "Tin tức",
    PAGES: renderPagesHtml(pages, renderCardVi),
    PAGINATION: renderPaginationHtml(totalPages, "vi"),
    CAT_LIST: renderCatListVi(),
  })
);
writeFile(
  "en/news/index.html",
  fill(LIST_TEMPLATES.en, {
    TITLE: "News | MIRAI VIET NAM HR CONSULTING",
    DESC: MAIN_DESC_EN,
    URL_VI: MAIN_URL_VI,
    URL_EN: MAIN_URL_EN,
    URL_JP: MAIN_URL_JP,
    BREADCRUMB: breadcrumbMain("en"),
    H1: "News",
    PAGES: renderPagesHtml(pages, renderCardEn),
    PAGINATION: renderPaginationHtml(totalPages, "en"),
    CAT_LIST: renderCatListEn(),
  })
);
writeFile(
  "jp/news/index.html",
  fill(LIST_TEMPLATES.jp, {
    TITLE: "ニュース | MIRAI VIET NAM HR CONSULTING",
    DESC: MAIN_DESC_JP,
    URL_VI: MAIN_URL_VI,
    URL_EN: MAIN_URL_EN,
    URL_JP: MAIN_URL_JP,
    BREADCRUMB: breadcrumbMain("jp"),
    H1: "ニュース",
    PAGES: renderPagesHtml(pages, renderCardJp),
    PAGINATION: renderPaginationHtml(totalPages, "jp"),
    CAT_LIST_JP: renderCatListJp(),
  })
);

// ================= Trang danh mục (lọc theo từng danh mục, 3 ngôn ngữ) =================
// Mỗi danh mục -> 3 trang (Vi/En/Jp), TÁI SỬ DỤNG đúng template + hàm render card/pagination
// của trang danh sách chung ở trên - chỉ khác tập bài viết (lọc theo cat), tiêu đề, breadcrumb.

const validCatDirs = { vi: new Set(), en: new Set(), jp: new Set() };

categories.forEach((cat) => {
  const catMetas = sortedMetas.filter((m) => m.cat === cat.slugVi);
  const catPages = chunk(catMetas, PAGE_SIZE);
  const catTotalPages = catMetas.length ? catPages.length : 0; // 0 bài -> không cần nav phân trang

  const urlVi = SITE + catPathVi(cat);
  const urlEn = SITE + catPathEn(cat);
  const urlJp = SITE + catPathJp(cat);

  writeFile(
    `tin-tuc/danh-muc/${cat.slugVi}/index.html`,
    fill(LIST_TEMPLATES.vi, {
      TITLE: escapeHtml(cat.nameVi) + " | MIRAI VIET NAM HR CONSULTING",
      DESC: escapeHtml(`Tin tức thuộc danh mục "${cat.nameVi}" từ MIRAI VIET NAM HR CONSULTING.`),
      URL_VI: urlVi,
      URL_EN: urlEn,
      URL_JP: urlJp,
      BREADCRUMB: breadcrumbCategory("vi", cat.nameVi),
      H1: escapeHtml(cat.nameVi),
      PAGES: renderPagesHtml(catPages, renderCardVi),
      PAGINATION: renderPaginationHtml(catTotalPages, "vi"),
      CAT_LIST: renderCatListVi(),
    })
  );
  validCatDirs.vi.add(cat.slugVi);

  writeFile(
    `en/news/category/${cat.slugIntl}/index.html`,
    fill(LIST_TEMPLATES.en, {
      TITLE: escapeHtml(cat.nameEn) + " | MIRAI VIET NAM HR CONSULTING",
      DESC: escapeHtml(`News in the "${cat.nameEn}" category from MIRAI VIET NAM HR CONSULTING.`),
      URL_VI: urlVi,
      URL_EN: urlEn,
      URL_JP: urlJp,
      BREADCRUMB: breadcrumbCategory("en", cat.nameEn),
      H1: escapeHtml(cat.nameEn),
      PAGES: renderPagesHtml(catPages, renderCardEn),
      PAGINATION: renderPaginationHtml(catTotalPages, "en"),
      CAT_LIST: renderCatListEn(),
    })
  );
  validCatDirs.en.add(cat.slugIntl);

  writeFile(
    `jp/news/category/${cat.slugIntl}/index.html`,
    fill(LIST_TEMPLATES.jp, {
      TITLE: escapeHtml(cat.nameJp) + "｜MIRAI VIET NAM HR CONSULTING",
      DESC: escapeHtml(`MIRAI VIET NAM HR CONSULTINGの「${cat.nameJp}」カテゴリーのニュース一覧です。`),
      URL_VI: urlVi,
      URL_EN: urlEn,
      URL_JP: urlJp,
      BREADCRUMB: breadcrumbCategory("jp", cat.nameJp),
      H1: escapeHtml(cat.nameJp),
      PAGES: renderPagesHtml(catPages, renderCardJp),
      PAGINATION: renderPaginationHtml(catTotalPages, "jp"),
      CAT_LIST_JP: renderCatListJp(),
    })
  );
  validCatDirs.jp.add(cat.slugIntl);
});

// ================= Dọn thư mục bài viết mồ côi =================
// Bài đã xoá khỏi data/news/posts.json nhưng thư mục html/tin-tuc/<slug>/, html/en/news/<slug>/,
// html/jp/news/<slug>/ build từ lần trước vẫn còn - xoá để không bị Google tiếp tục index nội
// dung đã xoá (static-site-build.md mục 8). CHỈ quét đúng 3 thư mục cha này (không đệ quy ra
// ngoài), và CHỈ xoá thư mục con là 1 bài viết build ra (không đụng file/thư mục tĩnh khác nằm
// cùng cấp, vd html/tin-tuc/index.html không phải thư mục nên an toàn).

function pruneOrphanDirs(parentRel, validSlugs, ignoreNames) {
  const parent = path.join(HTML_DIR, parentRel);
  if (!fs.existsSync(parent)) return;
  for (const name of fs.readdirSync(parent)) {
    if (ignoreNames && ignoreNames.has(name)) continue; // thư mục cố định khác (vd "danh-muc"), không phải bài viết
    const full = path.join(parent, name);
    if (!fs.statSync(full).isDirectory()) continue;
    if (validSlugs.has(name)) continue;
    fs.rmSync(full, { recursive: true, force: true });
    console.log("[build] Đã dọn thư mục mồ côi:", path.join(parentRel, name));
  }
}

// Bài viết: quét top-level tin-tuc/, en/news/, jp/news/ - BỎ QUA thư mục "danh-muc"/"category"
// (không phải slug bài viết, xử lý riêng ngay bên dưới).
pruneOrphanDirs("tin-tuc", validPostDirs.vi, new Set(["danh-muc"]));
pruneOrphanDirs(path.join("en", "news"), validPostDirs.en, new Set(["category"]));
pruneOrphanDirs(path.join("jp", "news"), validPostDirs.jp, new Set(["category"]));

// Trang danh mục: quét bên trong tin-tuc/danh-muc/, en/news/category/, jp/news/category/ - danh
// mục đã xoá khỏi data/news/categories.json thì dọn theo (hiếm khi xảy ra vì deleteCategory ở
// server chặn xoá nếu còn bài viết đang dùng, nhưng vẫn xử lý cho idempotent/an toàn).
pruneOrphanDirs(path.join("tin-tuc", "danh-muc"), validCatDirs.vi);
pruneOrphanDirs(path.join("en", "news", "category"), validCatDirs.en);
pruneOrphanDirs(path.join("jp", "news", "category"), validCatDirs.jp);

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

// ================= sitemap.xml: vá tại chỗ các <url> tin tức =================
// Phần còn lại của sitemap.xml (trang chủ, dịch vụ, việc làm...) do NGƯỜI sửa tay - build.js
// CHỈ ghi đè các <url> có <loc> dạng /tin-tuc/*, /en/news/*, /jp/news/* (bài viết + danh mục).
// Trang danh sách /tin-tuc, /en/news, /jp/news vẫn do người sửa tay.

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
  const raw = fs.readFileSync(sitemapPath, "utf8");
  const postBlocks = sortedMetas.map((meta) => {
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
  const today = new Date().toISOString().slice(0, 10);
  const catBlocks = categories.map((cat) => {
    const urlVi = SITE + catPathVi(cat);
    const urlEn = SITE + catPathEn(cat);
    const urlJp = SITE + catPathJp(cat);
    return [
      sitemapUrlBlock(urlVi, urlVi, urlJp, urlEn, urlVi, today),
      sitemapUrlBlock(urlJp, urlVi, urlJp, urlEn, urlVi, today),
      sitemapUrlBlock(urlEn, urlVi, urlJp, urlEn, urlVi, today),
    ].join("\n");
  });
  const blocks = postBlocks.concat(catBlocks);

  // Không dùng comment neo: nhận diện <url> do build sinh qua <loc> (bài viết + trang danh mục),
  // bỏ hết rồi chèn lại bộ mới ngay sau <url> của trang danh sách tin tức (/en/news).
  const generatedLoc = new RegExp(`^${SITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(tin-tuc|en/news|jp/news)/.+`);
  const urlBlockRe = /[ \t]*<url>[\s\S]*?<\/url>\r?\n?/g;
  const listingLoc = `${SITE}/en/news`;
  let insertAt = -1;
  let kept = "";
  let last = 0;
  for (const m of raw.matchAll(urlBlockRe)) {
    kept += raw.slice(last, m.index);
    last = m.index + m[0].length;
    const loc = (m[0].match(/<loc>([^<]*)<\/loc>/) || [])[1] || "";
    if (generatedLoc.test(loc)) continue;
    kept += m[0];
    if (loc === listingLoc) insertAt = kept.length;
  }
  kept += raw.slice(last);
  if (insertAt === -1) insertAt = kept.indexOf("</urlset>");
  if (insertAt === -1) {
    console.warn("[build] sitemap.xml không có </urlset> - bỏ qua bước cập nhật sitemap.");
    return;
  }
  const generated = blocks.length ? blocks.join("\n") + "\n" : "";
  const newContent = kept.slice(0, insertAt) + generated + kept.slice(insertAt);
  fs.writeFileSync(sitemapPath, newContent);
}

updateSitemap();

console.log(`[build] Xong - ${sortedMetas.length} bài viết, ${categories.length} danh mục, ${totalPages} trang danh sách/ngôn ngữ.`);

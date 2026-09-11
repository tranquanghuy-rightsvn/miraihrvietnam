# Guideline GAS CMS — iconic (Mirai Viet Nam HR Consulting, miraihrvietnam.com)

Nguồn chốt cho mọi quyết định nghiệp vụ của CMS dự án này. Đọc TOÀN BỘ file này trước khi sửa bất
kỳ file nào trong `gas/`. Theo playbook chung ở skill `free-cms-static-site-pipeline` (không lặp
lại kiến thức chung ở đây, chỉ chốt quyết định riêng của dự án này). Dự án tham khảo gần nhất:
`toponevn` (news + categories + users + liên hệ, cùng kiến trúc GitHub Contents API) — điểm khác
biệt quan trọng nhất: **tin tức + danh mục có 3 phiên bản ngôn ngữ Vi/En/Jp, dịch tự động**; form
liên hệ ở đây có **3 loại** (candidate/employer/business, mỗi loại field khác nhau) thay vì 1.

```
0. Phạm vi (khách yêu cầu ban đầu "quản lý tin tức. Và người dùng", mở rộng thêm 2 lần sau đó):
   1. Tin tức (bài viết) 3 ngôn ngữ — full CRUD, dịch tự động Vi -> En/Jp.
   2. Danh mục tin tức 3 ngôn ngữ — full CRUD, dịch tự động Vi -> En/Jp, có trang công khai riêng.
   3. Quản lý người dùng — root (ngầm định) > admin > editor.
   4. Quản lý liên hệ (chốt lại 13/09/2026) — form công khai `/lien-he/` (3 loại: Ứng viên/Nhà
      tuyển dụng/Tư vấn kinh doanh) lưu vào Sheet + gửi email thông báo, quản lý trạng thái qua
      CMS (chỉ admin/root) — xem mục VI.
   KHÔNG có: dịch vụ (6 trang /dich-vu/ giữ nguyên, sửa tay).

I. Đối với tính năng đăng nhập (giống hệt mặc định playbook, xem gas-backend-patterns.md mục 1/2):
  1. Luồng: gửi OTP -> xác nhận -> vào trang Admin (không mật khẩu, không dựa session Google).
  2. Chỉ email đã ĐĂNG KÝ (có trong sheet Users) mới được gửi OTP.
  3. Account chủ của GAS (người deploy) LUÔN hợp lệ/luôn có quyền cao nhất — KHÔNG lưu vào sheet
     Users, KHÔNG hiện trong UI quản lý người dùng.
  4. Phân quyền 3 cấp: `root` (chủ script, ẩn, ngầm định) > `admin` > `editor`.
     - `root`: toàn quyền, không quản lý được qua CMS (sửa tay Sheet nếu cần đổi ngoại lệ).
     - `admin`: làm mọi việc `editor` làm được, CỘNG THÊM tự thêm/sửa/xoá user cấp `admin` và
       `editor` khác qua CMS (không được đụng dòng `root`).
     - `editor`: CRUD tin tức + danh mục tin tức (cả 3 ngôn ngữ). KHÔNG thấy tab "Quản lý người
       dùng" (ẩn ở UI) và server cũng tự chặn nếu gọi thẳng hàm quản lý user.
  5. OTP 6 số, sống 10 phút (CacheService), cooldown 60 giây giữa 2 lần xin liên tiếp cùng 1 email,
     tối đa 5 lần nhập sai rồi phải xin mã mới. Token phiên đăng nhập sống 30 ngày, lưu localStorage.
  6. Server luôn tự kiểm tra quyền ở MỌI hành động (`requireRole_`).

II. Đối với "tin tức" (bài viết) — full CRUD, 3 NGÔN NGỮ:
  1. Luồng nhập liệu: người viết nhập bản tiếng Việt trước (tiêu đề, mô tả ngắn, nội dung). Mỗi
     bản En/Jp có 1 nút "Dịch" RIÊNG ("🌐 Dịch sang English" đặt ngay trước khối English, "🌐 Dịch
     sang 日本語" đặt ngay trước khối 日本語) — bấm nút nào CHỈ dịch + điền sẵn đúng khối ngôn ngữ đó
     (gọi `translatePost(..., target: 'en'|'ja')`, dùng `LanguageApp.translate` — dịch máy miễn
     phí, xem mục II-b), KHÔNG đụng tới khối ngôn ngữ còn lại. **Chốt lại 12/09/2026** (khác thiết
     kế ban đầu "1 nút dịch gộp cả 2"): bắt buộc tách riêng vì người dùng có thể đã tự sửa tay bản
     English theo văn phong riêng, sau đó cần dịch (hoặc dịch lại) bản 日本語 — nếu dùng 1 nút gộp,
     thao tác này sẽ VÔ TÌNH GHI ĐÈ MẤT bản English đã tự sửa. Có thể bấm nút dịch của 1 ngôn ngữ
     bất kỳ lúc nào (kể cả nhiều lần, kể cả khi đang SỬA bài đã có sẵn nội dung custom) — mỗi lần
     bấm chỉ là "điền sẵn cho nhanh", người dùng toàn quyền sửa lại/ghi đè kết quả trước khi Lưu,
     và việc bấm hay không bấm nút dịch không bắt buộc — không bấm thì tự gõ hoàn toàn theo ý
     mình. Cả 3 bản (Vi/En/Jp) lưu chung 1 lần bấm "Lưu bài viết", gửi lên server trong CÙNG 1 lời
     gọi `savePost` (nút Dịch không tự lưu gì).
  2. Các field CÓ ô nhập (nhân 3 cho mỗi ngôn ngữ, trừ field dùng chung ghi rõ bên dưới):
     - Tiêu đề: `titleVi`, `titleEn`, `titleJp` — BẮT BUỘC cả 3 (không cho Lưu nếu thiếu bất kỳ
       bản nào, tránh xuất bản trang thiếu nội dung ở 1 ngôn ngữ).
     - Slug: SINH TỰ ĐỘNG, KHÔNG có ô nhập tự do trên giao diện chính (chỉ hiện disabled để xem):
       - `slugVi` = slugify(`titleVi`) — quyết định URL `/tin-tuc/<slugVi>/`.
       - `slugIntl` = slugify(`titleEn`) — DÙNG CHUNG cho cả En VÀ Jp (đúng yêu cầu gốc: "tiếng
         anh và nhật thì cùng slug, chỉ khác /en hoặc /jp"), quyết định URL
         `/en/news/<slugIntl>/` VÀ `/jp/news/<slugIntl>/`.
       - Cả 2 slug tính LẦN ĐẦU lúc Lưu (từ tiêu đề tại thời điểm đó) rồi BẤT BIẾN vĩnh viễn sau
         đó — sửa tiêu đề sau này (kể cả tiêu đề Vi/En) KHÔNG đổi slug đã chốt (xem mục III).
     - Danh mục (`cat`) — dropdown chọn theo TÊN TIẾNG VIỆT của danh mục, lưu giá trị `slugVi`
       của danh mục đó (field DÙNG CHUNG cho cả 3 ngôn ngữ — 1 bài chỉ thuộc 1 danh mục, hiển thị
       tên đúng ngôn ngữ trang đang xem lúc build). Bắt buộc phải có ít nhất 1 danh mục trước khi
       tạo bài (CMS nhắc tạo danh mục trước nếu danh sách rỗng).
     - Ngày đăng (`date`) — DÙNG CHUNG cho cả 3 ngôn ngữ (không có khái niệm ngày đăng khác nhau
       theo ngôn ngữ). Mặc định hôm nay lúc tạo mới, sửa được tự do (không bất biến).
     - Ảnh cover (`img`) — DÙNG CHUNG cho cả 3 ngôn ngữ (không có ảnh riêng theo ngôn ngữ). Upload
       thay thế, KHÔNG sửa tay filename. Lưu dạng đường dẫn TƯƠNG ĐỐI tính từ `/assets/images/`
       (vd `"news-ky-7-tokutei-gino-abc123.webp"` cho ảnh CMS upload MỚI, hoặc
       `"news/thumb-1.jpg"` cho ảnh cũ đã có sẵn từ trước khi có CMS — build.js luôn ghép
       `/assets/images/` + giá trị field này, KHÔNG suy đoán thêm đuôi/tiền tố nào khác).
     - Mô tả ngắn/excerpt (`excerptVi`, `excerptEn`, `excerptJp`) — DÙNG CHUNG cho cả thẻ tin tức
       (card) VÀ `<meta name="description">`/`og:description` của trang chi tiết (không tách
       riêng 2 field mô tả khác nhau — giữ CMS gọn, đúng field thật đang cần).
     - Nội dung (`contentVi`, `contentEn`, `contentJp`) — mỗi bản 1 ô TinyMCE riêng, xuất HTML
       (h2/h3/p/ul/strong/figure...), in thẳng vào khung `.news-content` của trang chi tiết đúng
       ngôn ngữ. CÓ nút "Chèn ảnh" nhanh trên toolbar mỗi ô (mở thẳng file picker, không qua
       dialog mặc định — xem gas-backend-patterns.md mục 4), dùng chung `uploadPostImage` (khoá
       theo `slugVi`, không phân biệt ảnh chèn ở bản Vi/En/Jp — cả 3 dùng chung 1 "kho" ảnh nội
       dung của bài, đánh số tăng dần qua field ẩn `data-qi` lúc chèn, xem `insertContent_image`
       trong Code.js). Ảnh chèn KHÔNG có figure/caption/alt tự động (ngoài phạm vi yêu cầu ban
       đầu — giống quyết định của toponevn) — `alt` để trống, sửa tay HTML nếu cần.
       **Không hỗ trợ dán/kéo-thả ảnh trực tiếp** (`paste_data_images: false`) — chỉ chèn qua nút.
  3. Field KHÔNG có ô nhập — server tự giữ/suy ra lúc Lưu:
     - `slugVi`/`slugIntl` sau lần Lưu đầu — xem mục II.2 + III.
     - `catName` (tên danh mục hiển thị) — build.js tự tra từ `categories.json` theo `cat` +
       ngôn ngữ trang đang build, KHÔNG lưu trùng lặp trong post.
     - `<title>` trang chi tiết — build.js tự ghép `<Tiêu đề theo ngôn ngữ> | MIRAI VIET NAM HR
       CONSULTING` (Vi/En dùng `|`, Jp dùng `｜` full-width — đúng quy ước gốc của 6 trang cũ đã
       có sẵn trước CMS). KHÔNG có ô nhập "SEO title" riêng (khác toponevn) — CMS này không cần
       field đó, tiêu đề trang suy thẳng từ `titleVi/En/Jp` + hậu tố cố định.
  4. Danh sách trong Admin tải từ `data/news/posts.json` (index nhẹ) qua GitHub Contents API mỗi
     lần mở boot; mở 1 bài để sửa mới tải `data/news/<slugVi>/post.json` đầy đủ.
  5. Ảnh: nén phía CLIENT (canvas) trước khi upload — cạnh dài tối đa 1600px, xuất `image/webp`
     chất lượng ~0.85 (rơi về `image/png` nếu trình duyệt không hỗ trợ encode webp — server đọc
     đúng mime thật để đặt đuôi file, không suy đoán trước). Ảnh cover RIÊNG 1-1 theo từng bài
     (đặt tên tất định theo `slugVi`, đổi ảnh mới thì thêm hậu tố timestamp để cache-bust).

II-b. Dịch tự động (Vi -> En/Jp) — CHỐT DÙNG `LanguageApp.translate()` (miễn phí, có sẵn trong
   Apps Script, nền Google Translate):
   - Hàm `translatePost(token, {titleVi, excerptVi, contentVi, target})` — `target` là `"en"` HOẶC
     `"ja"`, dịch ĐÚNG 1 NGÔN NGỮ MỖI LẦN GỌI (chốt lại 12/09/2026, xem lý do ở mục II.1), trả về
     `{title, excerpt, content}` của riêng ngôn ngữ đó (KHÔNG trả cả 2 ngôn ngữ cùng lúc như thiết
     kế ban đầu). Ảnh chèn trong `content` (thẻ `<img>`) LUÔN được giữ NGUYÊN VẸN qua bản dịch —
     xem dòng kế tiếp, tách riêng thẻ HTML khỏi đoạn text nên `<img>` không bao giờ bị đụng vào.
   - `titleVi`/`excerptVi` dịch thẳng (plain text). `contentVi` (HTML) dịch bằng cách TÁCH riêng
     thẻ HTML và đoạn text (regex split theo `<[^>]+>`), CHỈ dịch phần text, giữ nguyên mọi thẻ —
     tránh dịch máy làm hỏng cấu trúc HTML (thẻ `<figure>`, `<strong>`, và đặc biệt `<img>`...).
   - Ngôn ngữ đích cho "Nhật" dùng mã `ja` khi gọi `LanguageApp.translate` (ISO 639-1 thật của
     tiếng Nhật) — KHÔNG nhầm với tiền tố thư mục site `/jp/` (2 thứ khác nhau, `jp` chỉ là tên
     thư mục quy ước của site, không phải mã ngôn ngữ).
   - 1 lần dịch 1 bài gọi nhiều lượt `LanguageApp.translate` nhỏ (mỗi đoạn text) thay vì 1 lượt
     dịch cả khối HTML — CHẤP NHẬN ĐƯỢC ở quy mô CMS tin tức nội bộ (vài chục bài/tháng), không
     tối ưu gộp batch vì `LanguageApp` không hỗ trợ dịch mảng.
   - **Chất lượng dịch máy, KHÔNG phải dịch chuyên nghiệp** — chốt với khách (câu hỏi rõ ràng đã
     hỏi lại, khách chọn phương án miễn phí thay vì Cloud Translation API trả phí/setup phức tạp
     hơn) — người viết PHẢI tự đọc lại và sửa bản En/Jp trước khi Lưu nếu cần chính xác cao hơn,
     CMS không tự đảm bảo bản dịch đúng 100%. Có thể nâng cấp sang Cloud Translation API sau này
     nếu khách phản hồi chất lượng không đủ (đổi 1 hàm `translateText_`/`translateHtml_`, không
     đổi kiến trúc còn lại).

III. Đối với sửa tin tức:
   - `slugVi` VÀ `slugIntl` bất biến TUYỆT ĐỐI sau lần Lưu đầu tiên — chặn ở SERVER (`throw` nếu
     khác) VÀ client (disable input, dù input này vốn đã ẩn/chỉ-đọc với người dùng thường — xem
     mục II.2). Đổi tiêu đề Vi/En sau khi đã lưu KHÔNG đổi lại 2 slug này.
   - Ảnh hiển thị lúc sửa dùng URL TUYỆT ĐỐI (`raw.githubusercontent.com/tranquanghuy-rightsvn/
     miraihrvietnam/master/html/assets/images/<img>`), KHÔNG dùng domain thật (site có thể chưa
     deploy bản mới nhất).
   - Đổi ảnh: tên file mới có hậu tố timestamp base36 để cache-bust. File ảnh cũ KHÔNG bị xoá
     qua API khi CHỈ đổi ảnh cover (đỡ 1 API call, ảnh cũ mồ côi vô hại) — chỉ field `img` trỏ
     sang file mới. Xoá HẲN bài viết thì xoá kèm đúng ảnh cover hiện tại (an toàn, 1-1).

IV. Đối với "danh mục tin tức" — full CRUD, tách hẳn khỏi bài viết, 3 NGÔN NGỮ:
  1. Luồng nhập liệu giống bài viết (mục II.1): nhập `nameVi` trước, mỗi bản En/Jp có nút "Dịch"
     RIÊNG (`translateCategory(..., target: 'en'|'ja')`) — dịch đúng 1 ngôn ngữ mỗi lần bấm, không
     ghi đè tên ngôn ngữ còn lại. Có thể sửa lại kết quả trước khi Lưu. Cả 3 tên BẮT BUỘC khi tạo
     mới.
  2. Field: `nameVi`, `nameEn`, `nameJp` (sửa được tự do sau khi tạo — KHÔNG bất biến, khác slug).
     `slugVi` = slugify(`nameVi`), `slugIntl` = slugify(`nameEn`) — tính 1 LẦN lúc tạo, bất biến
     sau đó (quyết định URL công khai của trang danh mục — xem mục IV.4).
  3. Danh sách tải từ `data/news/categories.json` qua GitHub Contents API mỗi lần mở.
  4. **CÓ trang danh mục công khai riêng** — chốt lại 13/09/2026 (đảo ngược quyết định ban đầu
     "không có trang lọc", sau phản hồi thật: khách bấm vào mục "Danh mục" ở sidebar mà không đi
     đâu cả). URL: `/tin-tuc/danh-muc/<slugVi>/` (Vi), `/en/news/category/<slugIntl>/` (En),
     `/jp/news/category/<slugIntl>/` (Jp) — build.js tự sinh (mục "Trang danh mục" trong
     `tools/build.js`), TÁI SỬ DỤNG đúng template + hàm render thẻ tin tức/phân trang của trang
     danh sách chung, chỉ khác: lọc đúng bài viết có `cat` = danh mục đó, breadcrumb 3 cấp
     (`Trang chủ > Tin tức > <Tên danh mục>`), `<title>`/H1 theo tên danh mục. Khối sidebar
     "Danh mục"/"Categories"/"カテゴリー" (ở CẢ trang chi tiết lẫn trang danh sách) giờ trỏ THẲNG
     vào đúng trang danh mục tương ứng thay vì trang danh sách tin tức chung.

V. Đối với sửa/xoá tin tức & danh mục:
   - Sửa: slug bất biến (mục III/IV.2) — disable input khi mở bản ghi ĐÃ TỒN TẠI, bật lại khi mở
     form "tạo mới" (form tái sử dụng DOM — nhớ reset trạng thái disabled).
   - Xoá bài viết: xoá `data/news/<slugVi>/post.json` + gỡ khỏi `data/news/posts.json` + ảnh cover
     (an toàn, 1-1). Xác nhận trước khi xoá (mục VIII).
   - Xoá danh mục: CHẶN nếu còn bài viết nào có `cat` = `slugVi` danh mục đó (lỗi rõ ràng "còn N
     bài viết đang dùng danh mục này") — không tự động gán lại/xoá cascade.

VI. Đối với form liên hệ công khai (`/lien-he/`) — chốt lại 13/09/2026:
   - Site có SẴN 1 trang liên hệ gộp 3 form theo tab (`data-contact-panel`): **Ứng viên**
     (`candidate`), **Nhà tuyển dụng** (`employer`), **Tư vấn kinh doanh** (`business`) - mỗi
     loại field hơi khác nhau (vd `employer`/`business` có thêm `company_name`, mỗi loại có danh
     sách `inquiry_type` riêng). Trước đây form này KHÔNG gửi đi đâu cả (`action="#"`, nút "GỬI
     YÊU CẦU" chỉ hiện banner "bản demo tĩnh, chưa kết nối server" - còn sót lại từ lúc clone).
   - **Gọi thẳng `doPost` của web app GAS qua `fetch()`** (sửa trực tiếp trong
     `html/lien-he/index.html`, đoạn `<script>` cuối trang - KHÔNG tạo file JS riêng, vì trang
     đã có sẵn 1 script xử lý tab + bước xác nhận/preview cho cả 3 form, chèn logic gửi vào đúng
     handler `.js-contact-submit` có sẵn là gọn nhất) - `Content-Type: text/plain;charset=utf-8`
     là CỐ Ý (né CORS preflight, GAS không xử lý được OPTIONS - xem gas-backend-patterns.md mục 6).
   - Field gửi lên: `type` (`candidate`/`employer`/`business`, lấy từ `data-contact-panel` của
     form đang active), `company_name`, `name`, `tel`, `mail`, `inquiry_type`, `message`, `_hp`
     (honeypot, input ẩn bằng `style` INLINE ngay trên thẻ - CỐ Ý không dùng class CSS ở file
     riêng, tránh đúng bẫy "rule CSS ẩn honeypot bị mất khi merge", gotcha #27). `name` và `mail`
     là 2 field BẮT BUỘC duy nhất ở tầng server (validate chi tiết hơn - vd `company_name` bắt
     buộc với employer/business - đã có sẵn ở tầng Parsley phía client, server chỉ chặn tối
     thiểu, không lặp lại toàn bộ rule).
   - `_hp` có giá trị → server âm thầm trả `{ok:true}`, KHÔNG lưu, KHÔNG gửi mail, không báo lỗi.
   - Rate-limit: 20 giây/lần theo **email** (`mail`) - khác toponevn (dùng điện thoại) vì `tel`
     ở đây KHÔNG bắt buộc, `mail` mới là field luôn chắc chắn có giá trị.
   - **Lưu vào Sheet `Contacts` LÀ NGUỒN CHÍNH**, cột: `id, createdAt, type, companyName, name,
     phone, email, inquiryType, message, status` (`status`: `"Mới"` | `"Đã xử lý"`, mặc định
     `"Mới"`). Tự tạo LƯỜI (lazy) lúc lần đầu cần tới, không tạo sẵn lúc bootstrap Spreadsheet
     như `Users` (gas-backend-patterns.md mục 7). Ghi Sheet xong luôn trả `{ok:true}`.
   - **Gửi mail là BEST-EFFORT sau đó**: `MailApp.sendEmail` lỗi (chưa cấu hình `NOTIFY_EMAIL`,
     quota Gmail...) chỉ `Logger.log`, KHÔNG throw - khách hàng KHÔNG được mất yêu cầu chỉ vì gửi
     mail lỗi (đã có trong Sheet, xem được qua tab "Quản lý liên hệ").
   - **Tiêu đề email CỐ ĐỊNH**: `[Miraihrvn.com] Liên hệ mới` (không đổi theo loại liên hệ - yêu
     cầu tường minh của khách). **Loại liên hệ hiển thị RÕ RÀNG trong nội dung email** bằng 1
     badge màu riêng từng loại (Ứng viên xanh lá `#1a9c4c`, Nhà tuyển dụng xanh dương
     `#00549b`, Tư vấn kinh doanh tím `#7a3fe0` - map `CONTACT_TYPES` trong `Code.js`) - không
     chỉ nhét vào 1 dòng text thường như các field khác, vì đây là thông tin quan trọng nhất để
     người nhận mail biết cách xử lý yêu cầu.
   - **Email thông báo dùng template HTML riêng** (`gas/email.html`, render qua
     `HtmlService.createTemplateFromFile` + scriptlet `<?= ?>` - BẮT BUỘC dùng bản escaped,
     không dùng `<?!= ?>`, vì mọi field đều là dữ liệu công khai chưa xác thực, tránh HTML/script
     injection nếu ai đó cố tình điền thẻ HTML vào form). **Logo dùng file PNG riêng cho email**
     (`html/assets/images/logo-email.png`, resize còn 242×260px từ `logo.png` gốc bằng `sips` -
     nhiều ứng dụng mail không hiển thị được webp nếu sau này đổi logo chính sang webp, và ảnh
     gốc 896×963px quá nặng/to cho email) - có `width`/`height` cố định trên thẻ `<img>` (không
     chỉ CSS) để không vỡ layout kể cả khi ứng dụng mail cắt bớt `<style>`. URL logo TUYỆT ĐỐI
     (`https://miraihrvietnam.com/assets/images/logo-email.png`) - ảnh email luôn cần domain
     thật, không dùng đường dẫn tương đối. Nút hành động cuối email: có số điện thoại thì
     "Gọi lại cho khách" (`tel:`), không có thì "Trả lời qua email" (`mailto:`).
   - **Quản lý trong Admin** (tab "Quản lý liên hệ") - CHỈ `admin`/`root` (giống mục I.4 quản lý
     người dùng): xem danh sách (mới nhất lên đầu), **lọc theo loại liên hệ** (dropdown Tất cả/
     Ứng viên/Nhà tuyển dụng/Tư vấn kinh doanh - lọc phía client trên dữ liệu đã tải, không gọi
     lại server mỗi lần đổi bộ lọc), đổi trạng thái Mới ⇄ Đã xử lý, xoá. `editor` không thấy tab
     này (ẩn client + chặn server). Danh sách KHÔNG nằm trong `boot()` (giống `users`) - tải
     riêng mỗi lần mở tab (không cache qua F5, đơn giản hơn boot cache vì không cần "hiện ngay
     rồi mới làm mới" cho dữ liệu khách hàng ít khi cần mở gấp).

VII. Không áp dụng cho dự án này (ngoài phạm vi mục 0):
   - Không có tính năng quản lý "dịch vụ" qua CMS (6 trang `/dich-vu/` giữ nguyên, sửa tay).

VIII. Một số lưu ý UX chung (áp dụng cho MỌI thao tác Lưu/Xoá/Dịch trong Admin) — giống mặc định
   playbook (xem gas-backend-patterns.md mục 17/18, gotchas #23-24):
   - 2 loại pop-up riêng biệt: XÁC NHẬN (Huỷ/Xoá) và THÔNG BÁO kết quả (1 nút Đóng, không tự ẩn).
   - Mọi nút async (Lưu/Xoá/Dịch): disable + spinner trong lúc chờ, tự phục hồi kể cả khi lỗi.
   - Sau Lưu/Xoá thành công: danh sách trong Admin tự cập nhật ngay, quay lại đúng màn danh sách.
   - Chuyển tab trong Admin chỉ là hiệu ứng giao diện — không tải lại toàn trang.
   - Đăng nhập lần đầu: 1 lượt `boot(token)` duy nhất. Lần vào Admin sau: hiện ngay từ cache
     localStorage (stale-while-revalidate), rồi âm thầm làm mới.
   - Mọi key localStorage (TRỪ token đăng nhập) mang hậu tố `CLIENT_BUILD`, kèm hàm tự dọn key
     khác phiên bản lúc tải script. **Bump hằng số này mỗi lần sửa `app.html`/`js.html`.**
   - Cả 3 ô TinyMCE (Vi/En/Jp) của 1 bài viết nằm CÙNG LÚC trong DOM (không ẩn bằng tab con lồng
     bên trong tab "post-editor") — tránh bug init cao 0px khi init lúc container còn `display:
     none` (gotcha #24). Chỉ tab "post-editor" (ngoài cùng) mới ẩn/hiện qua `switchTab`.

IX. Kiến trúc lưu trữ (nơi gì nằm ở đâu, ai đọc/ghi):
   - Google Sheet `Mirai HR CMS Data` (tự tạo lần đầu chạy, ID lưu vào Script Property
     `SPREADSHEET_ID`) — 2 sheet:
     - `Users` — cột: `email`, `role` (`admin` | `editor`).
     - `Contacts` — cột: `id, createdAt, type, companyName, name, phone, email, inquiryType,
       message, status` (`type`: `candidate`|`employer`|`business`, `status`: `"Mới"`|`"Đã xử
       lý"`). Tự tạo LƯỜI (lazy) lúc lần đầu cần tới (form submit hoặc mở tab quản lý) - xem
       mục VI.
   - GitHub (qua Contents API, repo `tranquanghuy-rightsvn/miraihrvietnam`, nhánh `master`) —
     đường dẫn cố định:
     - `data/news/posts.json` — index nhẹ mọi bài (field: `slugVi`, `slugIntl`, `cat`, `titleVi`,
       `titleEn`, `titleJp`, `date`, `img`, `excerptVi`, `excerptEn`, `excerptJp`, `updatedAt`).
     - `data/news/<slugVi>/post.json` — nội dung đầy đủ 1 bài (thêm `contentVi`, `contentEn`,
       `contentJp`).
     - `data/news/categories.json` — mảng `{slugVi, slugIntl, nameVi, nameEn, nameJp}`.
     - `html/assets/images/<img>` — ảnh cover/nội dung, ghi THẲNG vào vị trí site thật (không qua
       `data/`, tránh duplicate).
   - File "danh sách tổng" (`data/news/posts.json`, `data/news/categories.json`) LUÔN ghi SAU
     CÙNG trong 1 thao tác Lưu/Xoá — đây là 2 file trigger GitHub Actions build (`tools/build.js`).
     Liên hệ (mục VI) KHÔNG đụng tới GitHub/build - chỉ ghi Sheet + gửi mail, không có độ trễ
     build/deploy nào cả (khác tin tức/danh mục).
   - Độ trễ thực tế từ lúc Lưu tới lúc thấy trên site thật: ~1-2 phút (GitHub Actions build +
     commit `html/` + Cloudflare Pages tự deploy commit mới) - riêng liên hệ thì tức thời (không
     qua build).

X. Checklist bug đã thực sự gặp ở dự án này (cập nhật dần trong lúc code):
   - **Ảnh CHÈN TRONG NỘI DUNG bài viết không đọc được khi mở sửa trong Admin** (báo lỗi thật
     12/09/2026, Đại ca test). Nguyên nhân: nội dung lưu ảnh bằng đường dẫn TƯƠNG ĐỐI
     `/assets/images/<file>` (đúng quy ước để site thật `miraihrvietnam.com` hiển thị được bình
     thường), nhưng trang Admin/TinyMCE chạy trong iframe origin KHÁC hẳn
     (`*.googleusercontent.com` của Apps Script) — đường dẫn tương đối đó trỏ NHẦM sang chính
     origin iframe, ảnh 404 ngay trong lúc soạn (dù vẫn hiển thị đúng trên site thật, nên rất dễ
     nhầm tưởng "dữ liệu bị hỏng"). Đây đúng là biến thể của gotcha đã biết trong
     `gas-backend-patterns.md` mục 11 ("ảnh phải xem được khi sửa"), nhưng áp dụng cho MỌI ảnh
     chèn trong content (kể cả ảnh mới upload qua CMS), không chỉ ảnh migrate/legacy như mô tả
     gốc — vì quy ước của dự án này lưu content với đường dẫn tương đối tuyệt đối theo domain
     (mục II.2), khác quy ước "ảnh cover" (chỉ lưu tên file, build.js tự ghép tiền tố).
     Vá: 2 hàm đảo ngược `contentImgToAbsolute_`/`contentImgToRelative_` (`gas/js.html`) - đổi
     sang URL tuyệt đối `raw.githubusercontent.com` CHỈ để hiển thị trong editor (gọi ngay trước
     `setContent()` lúc mở bài sửa), rồi đổi NGƯỢC LẠI về đường dẫn tương đối CHỈ trước khi lưu
     (gọi ngay trước khi đọc `getContent()` để gửi lên server) - dữ liệu trong
     `data/news/*.json`/site thật KHÔNG BAO GIỜ chứa domain raw.githubusercontent.com. Đồng thời
     sửa luôn `insertQuickImage_` (ảnh chèn mới) đổi sang URL tuyệt đối ngay sau khi upload xong
     thay vì đường dẫn tương đối như trước — cùng 1 bug, chỉ là lộ ra ngay sau lần chèn đầu tiên
     thay vì phải mở lại bài mới thấy. Bump `CLIENT_BUILD` lên `2026-09-11-b`.

XI. Script Properties (Project Settings > Script Properties trên script.google.com):
   - `GITHUB_TOKEN` — Fine-grained PAT, chỉ quyền Contents: Read and write, giới hạn đúng repo
     `miraihrvietnam`. Bắt buộc, không tự tạo được.
   - `GITHUB_OWNER` = `tranquanghuy-rightsvn`.
   - `GITHUB_REPO` = `miraihrvietnam`.
   - `GITHUB_BRANCH` = `master`.
   - `SPREADSHEET_ID` — KHÔNG tự điền, code tự tạo Sheet lần đầu chạy và tự lưu lại giá trị này.
   - `NOTIFY_EMAIL` — bắt buộc nếu muốn form liên hệ (mục VI) gửi được mail thông báo; không có
     giá trị mặc định hard-code trong code — chủ dự án tự khai. Không có = liên hệ vẫn lưu Sheet
     bình thường, chỉ mất mail thông báo (xem mục VI). Dùng CHUNG quota Gmail 100 mail/ngày với
     OTP đăng nhập.
```

## Ghi chú triển khai riêng của dự án này (khác mặc định playbook)

- **Build script dùng Node.js (`tools/build.js`)** — repo chưa có build script nào từ trước
  (khác toponevn kế thừa quy ước cũ), chọn Node vì đây là 1 dự án Next.js/Node-tooling gốc
  (xem `package.json` ở monorepo cha) dù bản thân site tĩnh này không dùng Next.js runtime.
- **URL không có trailing slash** (`/tin-tuc/<slug>`, `/en/news/<slug>`, `/jp/news/<slug>`) —
  giữ đúng quy ước đã có sẵn từ bản clone gốc (Cloudflare Pages serve `index.html` trong thư mục
  con dù URL không có `/` cuối).
- **`html/vendor/tinymce/` copy nguyên từ dự án `toponevn`** (cùng tổ chức, bản 6.8.5 đã kiểm
  chứng chạy thật trong iframe sandbox, đã vá sẵn bug thiếu plugin `lists`) — KHÔNG tải lại từ
  CDN, lý do giống hệt toponevn (CDN bị chặn khi nhúng iframe trong `/admin/`, xem
  `gas-backend-patterns.md` mục "TinyMCE tự host").
- **Không có trang `/admin-gas/` dự phòng** — khác khuyến nghị mặc định của playbook (mục 6a
  `static-site-build.md`, "BẮT BUỘC có trang dự phòng"). Đây là yêu cầu TƯỜNG MINH của khách,
  đã hỏi lại và xác nhận 2 lần ("chỉ dùng /admin/, không dùng admin-gas" — "Bỏ hẳn, chỉ /admin/").
  **Rủi ro đã báo trước và khách chấp nhận**: nếu trình duyệt nào chặn nhúng iframe (vd đăng nhập
  Google Workspace tổ chức — xem gotcha #25), Admin sẽ treo trắng không có đường lui nhanh; cách
  khắc phục tạm là mở thẳng URL `.../exec` (xem `gas/README.md`) — KHÔNG tự ý thêm lại
  `/admin-gas/` nếu khách chưa đổi ý.
- **URL web app**: `https://script.google.com/macros/s/AKfycbwwKX_fpWgnDRR2hFX7PpITPizRql2B26PmICXq-QJ_L4MCtn__5tlIqAqNjOjyKbxQsw/exec`
  — đã dán vào `html/admin/index.html` (hằng số `CMS_URL`). Đổi deployment (New deployment,
  không phải New version) sẽ sinh URL khác — phải cập nhật lại đúng chỗ này.
- **Bài viết mẫu "263" từ bản clone gốc**: đã migrate thành bản ghi CMS thật đầu tiên (không bỏ
  qua, không xoá — theo yêu cầu khách), đổi `slugVi` từ `"263"` (id số, không có ý nghĩa) sang
  `"ky-7-tokutei-gino"` và `slugIntl` sang `"part-7-tokutei-gino"` (tiêu đề đã có sẵn phần
  "Kỳ 7"/"Part 7" nên đặt tên theo đó cho dễ nhận biết — không tự dịch/sinh lại vì đây là 1 hành
  động migrate thủ công 1 lần, không phải logic code). Nội dung Vi/En/Jp lấy NGUYÊN VĂN 3 bản đã
  có sẵn trong `html/tin-tuc/263/`, `html/en/news/263/`, `html/jp/news/263/` (bản dịch người viết
  tay từ trước khi có CMS — CHẤT LƯỢNG TỐT HƠN dịch máy, nên KHÔNG chạy lại `translatePost` cho
  bài này). Danh mục "Visa / Tokutei Ginō" (Vi/En) / "ビザ／特定技能（Tokutei Ginō）" (Jp) tạo kèm
  làm danh mục CMS đầu tiên (`slugVi`: `visa-tokutei-gino`, `slugIntl`: `visa-tokutei-gino`).
  4 mục danh mục tĩnh khác từng thấy ở sidebar bản clone gốc (không có dữ liệu bài viết thật phía
  sau, chỉ là placeholder) — **chốt lại 13/09/2026**: đã tạo thành danh mục CMS thật + kèm 4 bài
  viết mẫu (nội dung do Claude viết, dịch tay 3 ngôn ngữ, không qua `translatePost`), đúng tên đã
  có sẵn trong bản clone gốc (`Tin tuyển dụng tại Nhật Bản`, `Thị trường lao động Nhật - Việt`,
  `Đầu tư & kinh doanh tại Việt Nam`, `Kết nối thương mại Việt - Nhật`) — không tự bịa danh mục
  nào khác ngoài 5 mục design gốc đã có tên sẵn (bao gồm cả `Visa / Tokutei Ginō`).
- **6 trang dịch vụ giữ nguyên, KHÔNG đụng tới** trong đợt build CMS này (mục VII).
- **Form liên hệ (mục VI, thêm 13/09/2026)**: trước khi có CMS, `html/lien-he/index.html` vốn
  là 1 trang demo tĩnh (3 tab candidate/employer/business gộp từ bản clone gốc, nút "GỬI YÊU CẦU"
  chỉ hiện banner "chưa kết nối server"). Đã sửa TRỰC TIẾP đoạn `<script>` cuối file đó (thay nội
  dung handler `.js-contact-submit`, giữ nguyên toàn bộ phần tab-switch/confirm/preview có sẵn)
  để gọi thật `doPost` - không tạo file JS mới, không viết lại luồng tab/preview đã có.
  `html/assets/images/logo-email.png` là ảnh MỚI (resize từ `logo.png` gốc bằng `sips -Z 260`,
  242×260px, ~42KB) - `logo.png` gốc quá lớn (896×963px, ~300KB) để dùng trực tiếp trong email.

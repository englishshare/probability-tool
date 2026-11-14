# Công cụ giải Xác suất & Tập hợp

Nhập một biểu thức như `P(A U (B n C))` cùng các giả thiết đã biết, công cụ sẽ **giải từng bước**, hiển thị công thức bằng LaTeX, vẽ **biểu đồ Venn** và cho tải lời giải về dưới dạng `.tex` hoặc ảnh PNG. Chạy hoàn toàn trong trình duyệt — không máy chủ, không gửi dữ liệu đi đâu.

## Tính năng

- **Ba cách nhập biểu thức:** ký hiệu thường (`U`, `n`, `'`, `|`), mã LaTeX (`\cup`, `\cap`, `\overline{}`, `\mid`…), hoặc **ảnh** (tải lên, kéo-thả, hay dán bằng Ctrl+V).
- **Giải từng bước** bằng: phần bù (kể cả phần bù của xác suất có điều kiện), nguyên lý bù trừ (gộp thành một công thức cho 3–4 biến cố), luật phân phối, xung khắc, độc lập (cả chiều suy ngược), hiệu tập hợp, xác suất có điều kiện, **xác suất toàn phần và công thức Bayes theo phân hoạch tự khai báo hoặc theo hệ {B, B̄}**, hoàn thiện phân hoạch (P(B₃) = 1 − P(B₁) − P(B₂)).
- **Suy luận hai chiều.** Ngoài các quy tắc “từ trên xuống”, công cụ còn đưa mọi giả thiết về một hệ phương trình tuyến tính trên các vùng cơ bản của biểu đồ Venn và giải bằng khử Gauss. Nhờ đó giải được cả bài suy ngược, ví dụ cho `P(A)`, `P(B)`, `P(A∪B)` rồi hỏi `P(A∩B)`.
- **Kiểm tra giả thiết.** Giá trị phải nằm trong [0, 1]; giả thiết làm dữ kiện mâu thuẫn (ví dụ `P(A∩B) > P(A)`, phân hoạch có tổng khác 1, vừa độc lập vừa xung khắc) bị từ chối kèm lý do. Ngoài khử Gauss còn có **quy hoạch tuyến tính (simplex pha I)** để bắt các mâu thuẫn chỉ lộ ra khi xét đồng thời nhiều vùng.
- **Nhập giá trị dạng thập phân hoặc phân số** (`0.375`, `0,375` hay `3/8`); kết quả cuối hiển thị cả phân số (`0.88 = 22/25`) và phần trăm.
- **Biểu đồ Venn** cho 1–4 tập (4 tập dùng 4 elip xoay đủ 16 vùng), từ 5 tập hiển thị bảng 2ⁿ vùng.
- **Nhận diện ảnh tự viết** (không cần dịch vụ ngoài): chữ in/gõ máy (đã thử trên ảnh chụp thật dùng Calibri, Times New Roman và chữ nghiêng kiểu Cambria Math), nền sáng lẫn nền tối, ký hiệu ∪ ∩ thật, gạch đầu chữ (phần bù), nhiều dòng một ảnh, chữ dính nhau, phông đơn cách có số 0 gạch/chấm. Phần sau dấu `=` luôn được đọc như một con số (kể cả dấu phẩy thập phân kiểu Việt). **Phân số xếp chồng** (tử trên – gạch – mẫu dưới) và chỉ số dưới (B₁, B₂) cũng được đọc. Mỗi dòng nhận diện hiện kèm ảnh cắt của chính nó và **có thể sửa ngay** trước khi dùng.
- **Nhập nhanh:** bảng tần suất **2×2**; khai báo **nhiều phân hoạch** và **k biến cố đôi một xung khắc** trong một lần; chấp nhận `u` thường làm phép hợp và `N` đứng giữa hai biểu thức làm phép giao; ký hiệu lạ bị báo lỗi thay vì lặng lẽ bỏ qua.
- **Xuất kết quả:** LaTeX thuần để dán (không kèm màu), **tệp `.tex` đầy đủ biên dịch được bằng pdfLaTeX/Overleaf** (đã kiểm chứng bằng cách biên dịch thật), mã **TikZ** của biểu đồ Venn (1–4 tập), ảnh PNG.
- **Luyện tập và chia sẻ:** chế độ **Luyện tập** sinh đề ngẫu nhiên có đáp án (bù trừ, điều kiện, Bayes, độc lập, xung khắc…), kiểm tra đáp án dạng thập phân hoặc phân số; nút **Chia sẻ liên kết** mã hóa cả bài toán vào đường dẫn.
- **Dùng thoải mái:** ví dụ mẫu một chạm, hoàn tác khi xóa, tự lưu công việc dở trong trình duyệt, phím tắt Ctrl+Enter, hỗ trợ bàn phím và trình đọc màn hình.

## Chạy thử

Mở `index.html` bằng trình duyệt (cần mạng lần đầu để tải KaTeX và html2canvas từ CDN). Hoặc bật GitHub Pages cho repo này, xem [`docs/HUONG_DAN_PUSH_GITHUB.md`](docs/HUONG_DAN_PUSH_GITHUB.md).

Muốn chỉ **một tệp** duy nhất để gửi cho người khác: dùng `dist/cong-cu-xac-suat-tap-hop.html` (tạo bằng `npm run build`).

Hướng dẫn sử dụng chi tiết: [`docs/HUONG_DAN_SU_DUNG.md`](docs/HUONG_DAN_SU_DUNG.md).

## Cấu trúc mã nguồn

```
index.html            khung trang, nạp css/ và js/
css/style.css         giao diện
js/parser.js          tokenizer + bộ phân tích cú pháp đệ quy (một cài đặt duy nhất)
js/algebra.js         dạng chuẩn (canonicalKey), render LaTeX/văn bản, định dạng số, phân số
js/solver.js          bộ giải theo quy tắc có nhớ, sinh các bước giải
js/linear.js          suy luận tuyến tính trên 2ⁿ vùng (khử Gauss), phát hiện mâu thuẫn
js/venn.js            tính xác suất từng vùng, cảnh báo nhất quán, vẽ SVG
js/engine.js          phối hợp quy tắc + tuyến tính; đọc giá trị và dòng giả thiết
js/export.js          xuất LaTeX (đoạn dán, tài liệu .tex), mã hóa liên kết chia sẻ
js/practice.js        sinh đề luyện tập ngẫu nhiên có đáp án
js/ocr.js             nhận diện ảnh: thành phần liên thông + so khớp mẫu
js/app.js             giao diện: trạng thái, sự kiện, hộp thoại, xuất kết quả
scripts/              build-single-file.js
tests/                bộ kiểm thử tự động (Node)
docs/                 hướng dẫn và tài liệu kiến trúc
```

Các tệp trong `js/` là script thường dùng chung một phạm vi toàn cục nên trang mở được thẳng từ `file://` mà không cần bundler. Thứ tự nạp trong `index.html` là thứ tự phụ thuộc.

## Phát triển

```bash
npm install        # chỉ cần cho kiểm thử (canvas, jsdom); bản thân trang không có phụ thuộc
npm test           # chạy toàn bộ kiểm thử
npm run build      # tạo dist/cong-cu-xac-suat-tap-hop.html
npm run test:dist  # build rồi chạy lại kiểm thử trên tệp đã đóng gói
```

Kiến trúc và cách thêm quy tắc mới: [`docs/KIEN_TRUC.md`](docs/KIEN_TRUC.md).

## Giới hạn đã biết

- **Nhận diện ảnh** dựa trên so khớp mẫu, không phải mô hình học sâu: tốt với chữ in/gõ máy rõ nét, **không** đọc chữ viết tay, **không** đọc ảnh quá nhỏ hoặc mờ (chữ cao dưới khoảng 10 điểm ảnh); chữ nghiêng quá sát nhau có thể dính thành một khối. Vì vậy mỗi dòng nhận diện đều cho sửa lại trước khi dùng — hãy luôn kiểm tra.
- **Suy luận tuyến tính** làm việc với tối đa 12 tập hợp (4096 vùng); kiểm tra khả thi bằng quy hoạch tuyến tính chỉ chạy tới 8 tập (256 vùng) — trên đó chỉ còn kiểm tra phương trình và vùng bị ép âm.
- **Độc lập** là một tích nên chỉ tuyến tính hóa được khi ít nhất một thừa số đã biết: bài “A, B độc lập, biết `P(A)` và `P(A∪B)`, tìm `P(B)`” giải được, còn bài mà *mọi* thừa số đều chưa biết và chỉ cho một phương trình bậc hai (ví dụ chỉ biết `P(A∩B)` và `P(A∪B)`) thì chưa. Với nhóm hơn 8 biến cố độc lập, suy luận ngược chỉ dùng các tích theo cặp/bộ ba.
- **Mô-đun ES (`import`/`export`)** được cân nhắc nhưng **chưa dùng**: trình duyệt chặn `<script type="module">` khi mở tệp trực tiếp từ ổ đĩa (`file://`), mà khả năng “nhấp đúp là chạy” là điểm mạnh của dự án. Các tệp `js/` là script thường, chia sẻ phạm vi toàn cục theo thứ tự nạp, đã được kiểm thử độc lập từng tệp.
- Kết quả số dùng số thực dấu phẩy động; dữ liệu nhập dạng thập phân làm tròn (ví dụ `0.133333`) cho kết quả xấp xỉ, nên phân số hiển thị kèm ký hiệu ≈ khi không khớp tuyệt đối.

## Lịch sử thay đổi

**2.1** — sửa lỗi tràn ngăn xếp khi khai báo phân hoạch; lời giải chi tiết cho xác suất toàn phần/Bayes (phân hoạch tự khai báo hoặc hệ {B, B̄}), phần bù có điều kiện, hoàn thiện phân hoạch, bù trừ gộp một công thức; nhiều phân hoạch, xung khắc k biến cố; nhận diện phân số xếp chồng, ngưỡng mực thích nghi cho ảnh nhỏ/mờ; xuất `.tex` biên dịch được và TikZ cho Venn; sửa biến CSS `--border` làm mất khung Venn; `u`/`N` làm toán tử; ký hiệu lạ bị báo lỗi; độc lập với thừa số chưa biết; quy hoạch tuyến tính kiểm tra khả thi; bảng 2×2, luyện tập, chia sẻ liên kết.

**2.0** — tách module; thêm suy luận tuyến tính (giải bài suy ngược) và kiểm tra tính hợp lệ của giả thiết; nhập phân số, giới hạn giá trị trong [0, 1]; nhận diện ảnh viết lại (thành phần liên thông, chữ nghiêng, ∪ ∩ thật, gạch đầu chữ, giải mã số sau dấu `=`, dòng nhận diện sửa được); làm lại giao diện theo hướng dẫn Web Interface Guidelines (khả năng truy cập, phím tắt, hoàn tác, ví dụ mẫu, lưu trạng thái); sửa lỗi phông chữ làm sai dấu tiếng Việt; bộ phân tích cú pháp từ chối ký hiệu thừa sau `P(…)` thay vì lặng lẽ bỏ qua.

**1.x** — bản một tệp đầu tiên: bộ giải theo quy tắc, biểu đồ Venn, nhận diện ảnh cơ bản.

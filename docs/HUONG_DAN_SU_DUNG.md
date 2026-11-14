# Hướng dẫn sử dụng

Cách nhanh nhất để làm quen: chọn một mục trong ô **Ví dụ mẫu** ở góc trên bên phải — công cụ nạp sẵn đề bài và giải luôn, bạn chỉ cần đọc kết quả rồi thử sửa.

## 1. Quy trình ba bước

1. **Biểu thức cần giải** — nhập điều đề bài hỏi.
2. **Giả thiết đã biết** — nhập các giá trị đề bài cho.
3. **Giải** — bấm nút *Giải* (hoặc `Ctrl`+`Enter`).

## 2. Nhập biểu thức

### Tab “Ký hiệu thường”

| Gõ | Nghĩa |
| --- | --- |
| `U` hoặc `u` | hợp ∪ |
| `n` (hoặc `N` đứng giữa hai biểu thức) | giao ∩ |
| `'` hoặc `^c` | phần bù |
| `\` | hiệu tập hợp (`A \ B` = `A n B'`) |
| `\|` | điều kiện (`A\|B` là P(A \| B)) |
| viết liền `AB` | giao ngầm định: `AB` = `A n B` |

`P(…)` có thể có hoặc không. Tên có số như `B1`, `B2` được giữ nguyên là một tập. Ví dụ: `P(A U (B n C))`, `P(ABC'D)`, `P(B1|A)`.

### Tab “LaTeX”

Cùng ý nghĩa, viết bằng LaTeX: `\cup`, `\cap`, `\overline{A}`, `\setminus`, `\mid`, `\emptyset`, `\Omega`. Có sẵn một ví dụ.

### Tab “Ảnh”

Chọn ảnh, kéo-thả vào khung, hoặc **dán ảnh chụp màn hình bằng `Ctrl`+`V`**.

- Ảnh một dòng không có dấu `=` → chữ nhận diện được đưa thẳng vào ô biểu thức ở tab “Ký hiệu thường”.
- Ảnh nhiều dòng (ví dụ vài dòng `P(A) = 0.6`) → mỗi dòng hiện thành một thẻ gồm **ảnh cắt của dòng đó** và **ô chữ nhận diện được — bạn sửa trực tiếp** nếu sai. Dòng có dạng `biểu thức = số` được gắn nhãn *dạng giả thiết* và có nút **+ Thêm giả thiết**; có thêm nút **Thêm tất cả** khi nhiều dòng cùng dạng.
- Đọc được: chữ in/gõ máy rõ nét, **chữ nghiêng kiểu công thức** (Word Equation, LaTeX), chữ có chân (Times New Roman) kể cả khi các chữ gần như dính nhau, nền trắng hoặc nền tối, ký hiệu ∪ ∩ thật, **gạch ngang trên đầu chữ** (phần bù: C̄ → `C'`). Phần sau dấu `=` luôn được đọc như số, nên chữ số mảnh không còn bị đọc thành chữ cái.
- Mẹo để chính xác hơn: cắt sát phần chữ, phóng to khi chụp, tránh ảnh mờ/xiên.
- **Phân số xếp chồng** (tử trên – gạch – mẫu dưới) được đọc thành `tử/mẫu`, ví dụ dòng `P(A|B̄) = ⅔` ra `P(A|B')=2/3`; chỉ số dưới (`B₁`) ra `B1`.
- Không đọc được: chữ viết tay, ảnh quá nhỏ/mờ (chữ cao dưới khoảng 10 điểm ảnh — hãy phóng to hoặc chụp lại rõ hơn).

> Nhận diện ảnh không bao giờ chắc chắn 100%. **Luôn nhìn lại chữ nhận diện được** trước khi bấm Giải.

## 3. Giả thiết đã biết

Nhập vào hai ô rồi bấm **Thêm** (hoặc `Enter`):

- **Biểu thức:** ví dụ `A`, `A n B`, `A U B`, `A|B` (điều kiện), `AB`. Bạn cũng có thể gõ cả `P(A)=0.6` vào ô biểu thức và để trống ô giá trị — công cụ tự tách.
- **Giá trị:** số thập phân (dấu chấm hoặc dấu phẩy: `0.375`, `0,375`) hoặc **phân số** (`3/8`, `3 / 8`), **trong đoạn [0, 1]**.

Nhập lại cùng một biểu thức sẽ **cập nhật** giá trị cũ thay vì thêm dòng trùng.

### Giả thiết mâu thuẫn bị từ chối

Công cụ kiểm tra giả thiết mới cùng với những gì đã có. Nếu chúng không thể cùng đúng, giả thiết mới bị từ chối và có lý do. Ví dụ đã có `P(A)=0.2`, nhập `P(A∩B)=0.4` sẽ báo vùng `A ∩ B'` có xác suất âm. Các trường hợp được bắt: xác suất giao lớn hơn xác suất thành phần, xác suất hợp nhỏ hơn thành phần, dữ liệu bù trừ không khớp, phân hoạch có tổng khác 1, vừa độc lập vừa xung khắc nhưng xác suất dương.

### Khai báo quan hệ

Khi đề bài nói… hãy dùng nút:

- **+ Độc lập** — chọn ≥ 2 biến cố độc lập với nhau. Công cụ dùng `P(giao) = tích` khi biết các xác suất thành phần.
- **+ Xung khắc** — chọn từ 2 biến cố trở lên đôi một không thể cùng xảy ra; chọn k biến cố sẽ khai báo cả k(k−1)/2 cặp.
- **+ Phân hoạch** (khai báo được nhiều phân hoạch, mỗi lần thêm một phân hoạch mới) — chọn các biến cố đôi một xung khắc và hợp lại là cả không gian mẫu; cần cho xác suất toàn phần và Bayes. (Ví dụ mẫu “Bayes & xác suất toàn phần”.)

Hộp thoại dùng được bằng bàn phím: `Tab` để di chuyển, `Space`/`Enter` để chọn, `Esc` để đóng.

### Xóa và hoàn tác

Bấm dấu × cuối mỗi dòng hoặc **Xóa hết**. Một thông báo hiện ra vài giây với nút **Hoàn tác** — bấm để khôi phục.

## 4. Đọc kết quả

- **Thẻ Kết quả:** giá trị thập phân, phân số tương ứng (nếu có phân số nhỏ khớp; dấu ≈ nghĩa là xấp xỉ), phần trăm, và các nút **Sao chép LaTeX**, **Tải .tex**, **Tải ảnh PNG**.
- **Các bước giải:** mỗi bước ghi tên quy tắc rồi công thức. Khi bài phải giải “ngược” từ các dữ kiện (ví dụ cho `P(A∪B)` mà hỏi `P(A∩B)`), bước giải ghi rõ cách kết hợp các giả thiết: `P(A∩B) = P(A) + P(B) − P(A∪B) = 0.5 + 0.6 − 0.8 = 0.3`.
- **Chưa đủ giả thiết:** nếu dữ kiện chưa xác định được đáp số, thẻ kết quả báo thiếu gì thay vì đoán.
- **Thanh cảnh báo đỏ:** xuất hiện khi các giả thiết đang có mâu thuẫn nhau (ví dụ do nạp từ lần làm trước).
- **Biểu đồ Venn:** 1–4 tập vẽ hình, kèm *bảng số liệu các vùng* bấm mở ra bên dưới; từ 5 tập hiển thị bảng. Vùng chưa xác định ghi `?`.

## 5. Phím tắt và tiện ích

| | |
| --- | --- |
| `Ctrl`+`Enter` (hoặc `⌘`+`Enter`) | Giải |
| `Enter` trong ô biểu thức | Giải (`Shift`+`Enter` để xuống dòng) |
| `Enter` trong ô “Biểu thức” của giả thiết | chuyển sang ô giá trị |
| `Ctrl`+`V` | dán ảnh chụp màn hình |
| `←` `→` `Home` `End` trên thanh tab | đổi tab |

Công việc đang làm dở (biểu thức, giả thiết, khai báo) được **tự lưu trong trình duyệt** trên máy bạn và khôi phục khi mở lại. Muốn bắt đầu mới, chọn một ví dụ mẫu hoặc bấm **Xóa hết**.

## 6. Gặp sự cố

- **Công thức hiện thành mã LaTeX thô:** chưa tải được KaTeX (cần mạng ít nhất lần đầu).
- **“Không đọc được biểu thức”:** kiểm tra ngoặc, và các ký hiệu theo bảng ở mục 2. Ký hiệu thừa sau `P(…)` (ví dụ `P(A)=0.6` đưa vào ô biểu thức cần giải) cũng bị báo lỗi — phần `=0.6` thuộc về giả thiết.
- **Nhận diện ảnh sai chữ:** sửa trực tiếp trong ô chữ của dòng đó; thử cắt ảnh sát hơn hoặc dùng ảnh rõ hơn.
- **Nút tải PNG không chạy:** cần mạng để tải thư viện html2canvas; hoặc dùng *Tải .tex* và *Sao chép LaTeX*.

## 7. Các tiện ích khác

### Bảng 2×2
Nút **Bảng 2×2** (cạnh các nút khai báo) mở một bảng xác suất của bốn ô `A∩B`, `A∩B'`, `A'∩B`, `A'∩B'`. Điền bốn ô (tổng phải bằng 1) hoặc chỉ ba ô — ô trống tự suy ra. Bấm **Thêm vào giả thiết** để thêm cả bốn giả thiết một lúc; bảng mâu thuẫn với dữ kiện đang có sẽ bị từ chối kèm lý do.

### Luyện tập
Nút **Luyện tập** (góc trên) sinh một đề ngẫu nhiên: bù trừ 2–3 biến cố, xác suất có điều kiện, bài suy ngược, độc lập, xung khắc, xác suất toàn phần và Bayes (theo phân hoạch hoặc theo {B, B̄}). Tự tính rồi gõ đáp án (thập phân, `0,667` hay phân số `2/3`) và bấm **Kiểm tra**; **Gợi ý** cho biết nên dùng công thức nào; **Đề khác** sinh đề mới; **Xem lời giải trong công cụ** nạp đề vào công cụ và giải từng bước. Mọi đề đều nhất quán và có đáp án đúng.

### Chia sẻ liên kết
**Chia sẻ liên kết** sao chép một đường dẫn chứa toàn bộ bài toán (biểu thức, giả thiết, khai báo). Ai mở đường dẫn sẽ thấy đúng bài toán và lời giải hiện ra ngay. Dữ liệu nằm sau dấu `#` của đường dẫn nên **không được gửi tới máy chủ nào**. Lưu ý: nếu bạn đang mở trang trực tiếp từ máy (đường dẫn bắt đầu bằng `file://`) thì người khác chưa mở được — hãy đưa trang lên web (xem hướng dẫn GitHub Pages).

### Xuất lời giải
- **Sao chép LaTeX**: mã LaTeX thuần, không kèm màu, dán thẳng vào tài liệu của bạn (cần gói `amsmath`).
- **Tải .tex**: một tài liệu LaTeX đầy đủ (có đề bài, giả thiết, từng bước và kết quả; màu bằng gói `xcolor`), biên dịch được bằng pdfLaTeX — Overleaf chạy ngay, dòng `[T5]{fontenc}` + `lmodern` giúp gõ được tiếng Việt.
- **Sao chép mã TikZ / Tải TikZ (.tex)** (dưới biểu đồ Venn 1–4 tập): hình vẽ dạng mã vector để chèn vào bài báo cáo, đề thi (cần `\usepackage{tikz}`).
- **Tải ảnh PNG** chụp toàn bộ phần kết quả.

### Khi ký hiệu không được hiểu
Công cụ không còn lặng lẽ bỏ qua ký tự lạ. Gõ `A + B`, `A & B`, `A|~B` hay `\subset` sẽ nhận thông báo cụ thể (kèm gợi ý ký hiệu đúng, như dùng `U` thay `+`, dấu `'` thay `~`). Riêng `u` thường luôn là phép hợp, còn `N` chỉ là phép giao khi đứng giữa hai biểu thức (`A N B`); `P(N)` vẫn hiểu `N` là tên một biến cố.

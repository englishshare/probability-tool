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
| `U` | hợp ∪ |
| `n` | giao ∩ |
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
- Không đọc được: chữ viết tay, phân số xếp chồng (tử trên mẫu dưới). Hãy gõ phân số dạng `3/8` ở ô giá trị.

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
- **+ Xung khắc** — chọn đúng 2 biến cố không thể cùng xảy ra.
- **+ Phân hoạch** — chọn các biến cố đôi một xung khắc và hợp lại là cả không gian mẫu; cần cho xác suất toàn phần và Bayes. (Ví dụ mẫu “Bayes & xác suất toàn phần”.)

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

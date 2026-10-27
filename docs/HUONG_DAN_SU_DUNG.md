# Hướng dẫn sử dụng

Mở file `index.html` bằng trình duyệt (Chrome, Edge, Firefox... đều được). Giao diện chia làm 2 cột: bên trái để nhập biểu thức và giả thiết, bên phải hiển thị lời giải. Công cụ hoạt động với **bất kỳ số lượng tập hợp/biến cố nào** (không chỉ 2) — ví dụ có sẵn khi mở file là một bài 3 tập hợp.

## 1. Nhập biểu thức cần giải

Có 3 tab ở đầu cột trái:

### Tab "Ký hiệu thường"
Gõ trực tiếp bằng quy ước:

| Ký hiệu | Ý nghĩa | Ví dụ |
|---|---|---|
| `U` | Hợp (∪) | `A U B` |
| `n` | Giao (∩) | `A n B` |
| viết liền chữ | Cũng là giao (∩), viết tắt quen thuộc | `AB` = `A n B`, `ABC` = `A n B n C` |
| `'` hoặc `^c` | Phần bù | `A'` hoặc `A^c` |
| `\` | Hiệu (A trừ B) | `A \ B` |
| `\|` | Điều kiện | `P(A\|B)` |
| `()` | Nhóm | `P(A U (B n C))` |

Lưu ý: `U` và `n` đã được dùng làm ký hiệu phép toán, nên **không đặt tên tập hợp là U hoặc n** — hãy dùng các chữ khác (A, B, C, D1, D2...). Tên có chữ số ở cuối (B1, B2...) vẫn được hiểu là một tên trọn vẹn, không bị tách chữ và số.

### Tab "LaTeX"
Dùng giống hệt tab "Ký hiệu thường", chỉ khác cú pháp: gõ hoặc dán biểu thức bằng LaTeX vào ô, rồi bấm **Giải** như bình thường. Hỗ trợ `\cup`, `\cap`, `\overline{...}`, `\setminus`, `\mid`, `\emptyset`, `\Omega`. Ví dụ: `P(A \cup (B \cap C))` — ô này có sẵn ví dụ, bấm Giải để thử ngay.

### Tab "Ảnh"
Chọn hoặc kéo-thả ảnh chứa biểu thức. Việc nhận diện chạy hoàn toàn trong trình duyệt (không gửi ảnh đi đâu cả), và hoạt động với **cả chữ đen trên nền trắng lẫn chữ sáng trên nền tối**, **cả chữ thường lẫn chữ nghiêng kiểu công thức toán** (vd gõ bằng Word Equation/Cambria Math, LaTeX). Ảnh có dấu gạch ngang trên đầu một chữ cái (ký hiệu phần bù, vd Ā, B̄) cũng được nhận ra và tự chuyển thành dấu `'` sau chữ đó (vd `A'`).

Ảnh có thể chứa **nhiều dòng** — ví dụ chụp cùng lúc "P(A) = 0.6", "P(B) = 0.5", "P(A|B) = 0.8" trên 3 dòng riêng. Sau khi nhận diện, mỗi dòng hiện ra kèm nút:
- **"+ Thêm giả thiết"** — nếu dòng đó có dạng `biểu thức = số`, thêm thẳng vào danh sách giả thiết.
- **"Dùng làm biểu thức"** — đặt dòng đó vào ô biểu thức cần giải.

Nếu nhận diện được nhiều dòng dạng giả thiết, có thêm nút **"Thêm tất cả... làm giả thiết"** để thêm một lượt.

**Luôn kiểm tra lại** chữ nhận diện được trước khi dùng — cách này phù hợp nhất với chữ in/gõ máy rõ nét theo đúng quy ước ở trên; chữ viết tay, ảnh mờ, hoặc ảnh chụp lẫn lộn cả vùng nền sáng lẫn nền tối trong cùng một khung hình có thể bị sai vài ký tự. Nếu chụp màn hình, nên cắt sát vào đúng phần chữ cần dùng thay vì để lẫn nhiều mảng màu nền khác nhau.

## 2. Khai báo giả thiết đã biết

Trong khung "Giả thiết đã biết":

- **Thêm giả thiết đơn:** gõ biểu thức vào ô đầu, giá trị số vào ô bên dưới, rồi bấm **Thêm**. Ô biểu thức nhận cả hai cách viết — `A n B` hoặc `P(A n B)` — có hay không có `P(...)` bọc ngoài đều được. Gõ `A|B` (hoặc `P(A|B)`) để khai báo xác suất có điều kiện.
- **+ Độc lập:** mở bảng chọn các biến cố (từ 2 trở lên) thực sự độc lập với nhau — công cụ sẽ dùng để tính P(giao) = tích các xác suất riêng khi cần.
- **+ Xung khắc:** mở bảng chọn đúng 2 biến cố không giao nhau (ô thứ 3 trở đi sẽ mờ đi sau khi chọn đủ 2) — công cụ sẽ coi P(giao) = 0.
- **+ Phân hoạch (Bayes / xs toàn phần):** mở bảng chọn các biến cố tạo thành một phân hoạch của không gian mẫu (vd B1, B2, B3). Cần khai báo thêm P(Bi) và P(A|Bi) cho từng i để công cụ áp dụng được công thức xác suất toàn phần hoặc định lý Bayes. Chỉ có **một** phân hoạch tại một thời điểm — khai báo phân hoạch mới sẽ thay thế cái cũ.

Mỗi bảng chọn đều có dòng giải thích ngay phía trên và một dòng "Đã chọn: ..." cập nhật theo lựa chọn, để biết trước điều sắp xảy ra trước khi bấm Xác nhận. Nếu bảng chọn trống, nghĩa là công cụ chưa thấy tên tập hợp nào — hãy nhập biểu thức hoặc thêm một giả thiết có tên tập hợp trước, rồi mở lại.

Mỗi giả thiết/khai báo hiển thị trong danh sách kèm nút ✕ để xóa riêng, hoặc bấm **Xóa hết giả thiết** để làm lại từ đầu.

## 3. Xem lời giải

Bấm **Giải**. Cột phải hiển thị:

- **Các bước giải:** mỗi bước ghi rõ tên nguyên lý áp dụng (bù trừ, phần bù, độc lập, Bayes...) và công thức LaTeX tương ứng. Tên tập hợp được tô màu nhất quán xuyên suốt để dễ đối chiếu với biểu đồ Venn.
- **Kết quả:** giá trị số cuối cùng. Nếu thiếu giả thiết để tính hết, công cụ vẫn hiển thị công thức đã rút gọn tối đa và ghi chú rõ còn thiếu giả thiết cho tập hợp nào.

## 4. Biểu đồ Venn

Tự động vẽ theo số tập hợp xuất hiện trong biểu thức đang giải (không giới hạn ở 2):

- 1 tập hợp: một hình tròn.
- 2–3 tập hợp: hình tròn kinh điển.
- 4 tập hợp: 4 hình ellipse (cách vẽ duy nhất cho phép thể hiện đủ cả 16 vùng bằng đường cong lồi).
- Từ 5 tập hợp trở lên: bảng liệt kê tất cả các vùng (2ⁿ dòng) kèm giá trị, vì không thể vẽ chính xác bằng hình khi có ≥ 5 tập hợp.

Vùng nào chưa đủ giả thiết để tính sẽ hiển thị dấu `?`.

## 5. Xuất kết quả

Ở cuối phần lời giải có các nút:

- **Sao chép LaTeX lời giải** — sao chép toàn bộ các bước dưới dạng mã LaTeX vào clipboard, dán thẳng vào file `.tex` hoặc Overleaf.
- **Tải mã LaTeX (.tex)** — tải cùng nội dung đó thành một file `.tex`.
- **Tải ảnh PNG** — chụp lại toàn bộ phần lời giải + biểu đồ Venn thành một ảnh PNG.

## Mẹo & xử lý sự cố

- **Báo lỗi cú pháp:** thường do thiếu dấu ngoặc đóng, hoặc dùng `U`/`n` làm tên tập hợp. Kiểm tra lại biểu thức.
- **Kết quả ra dấu `?`:** thêm giả thiết còn thiếu (xem ghi chú "Cần thêm giả thiết cho..." ngay dưới kết quả).
- **Bảng chọn Độc lập/Xung khắc/Phân hoạch trống:** công cụ chỉ liệt kê tên tập hợp đã xuất hiện trong ô biểu thức hoặc trong danh sách giả thiết — thêm ít nhất một trong hai trước.
- **Nhận diện ảnh sai ký tự hoặc thiếu dòng:** sửa trực tiếp trong ô "Ký hiệu thường", hoặc dùng nút "Dùng làm biểu thức"/"+ Thêm giả thiết" trên đúng dòng cần — không cần chụp lại ảnh. Nếu cả dòng bị sai nhiều, thử cắt ảnh sát hơn vào phần chữ, tránh lẫn nhiều nền sáng/tối khác nhau trong cùng một ảnh.
- **Muốn giải bài mới:** bấm "Xóa hết giả thiết" rồi nhập lại, hoặc chỉ cần sửa biểu thức và các giả thiết liên quan nếu bài mới dùng lại phần lớn dữ kiện cũ.

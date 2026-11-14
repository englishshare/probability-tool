# Công cụ giải Xác suất & Tập hợp

Công cụ web (1 file HTML, chạy hoàn toàn trong trình duyệt) giúp nhập một biểu thức xác suất/tập hợp — ví dụ `P(A ∪ (B ∩ C))` — rồi tự động khai triển từng bước bằng các nguyên lý xác suất, kèm biểu đồ Venn tương ứng.

## Tính năng

- **3 cách nhập biểu thức** (hoạt động với bất kỳ số lượng tập hợp/biến cố nào, không chỉ 2):
  - Ký hiệu thường: `U` = hợp, `n` = giao, `'`/`^c` = phần bù, `\` = hiệu — ví dụ `P(A U (B n C))`; viết liền chữ như `AB` cũng được hiểu là `A n B` (viết tắt quen thuộc cho P(AB))
  - Mã LaTeX: `\cup`, `\cap`, `\overline{...}`, `\setminus`, `\mid`, `\emptyset`, `\Omega`
  - Ảnh: nhận diện chữ in/gõ máy ngay trong trình duyệt (không qua máy chủ ngoài), hỗ trợ ảnh nhiều dòng (ví dụ nhiều giả thiết chụp cùng lúc) — mỗi dòng nhận diện được cho chọn dùng làm giả thiết hoặc làm biểu thức cần giải, luôn kiểm tra lại trước khi giải
- **Khai báo giả thiết đã biết:** xác suất đơn `P(A)=...`, xác suất có điều kiện `P(A|B)=...`, độc lập, xung khắc, và phân hoạch (dùng cho Bayes / công thức xác suất toàn phần)
- **Bộ giải từng bước:** áp dụng đệ quy nguyên lý bù trừ (Inclusion–Exclusion, tổng quát cho n tập hợp), quy tắc phần bù, luật phân phối, định nghĩa xác suất có điều kiện, độc lập/xung khắc, định lý Bayes, công thức xác suất toàn phần — mỗi bước hiển thị bằng LaTeX (KaTeX)
- **Biểu đồ Venn tự động:** chính xác cho 2–4 tập hợp (4 tập hợp dùng cách vẽ 4-ellipse); từ 5 tập hợp trở lên hiển thị bảng liệt kê vùng thay vì hình vẽ, vì không có cách vẽ nào bằng đường cong lồi thể hiện đúng hết mọi vùng giao khi ≥ 5 tập hợp
- **Xuất kết quả:** sao chép mã LaTeX, tải file `.tex`, hoặc tải ảnh PNG của lời giải

## Bắt đầu nhanh

Không cần cài đặt gì — chỉ cần mở `index.html` bằng trình duyệt (double-click hoặc kéo thả vào cửa sổ trình duyệt).

Xem hướng dẫn chi tiết:
- [`docs/HUONG_DAN_SU_DUNG.md`](docs/HUONG_DAN_SU_DUNG.md) — hướng dẫn sử dụng công cụ
<!-- - [`docs/HUONG_DAN_PUSH_GITHUB.md`](docs/HUONG_DAN_PUSH_GITHUB.md) — hướng dẫn đưa project này lên GitHub -->

## Cấu trúc thư mục

```
probability-set-theory-tool/
├── index.html                      # Toàn bộ công cụ (HTML + CSS + JS trong 1 file)
├── README.md                       # File này
└── docs/
    ├── HUONG_DAN_SU_DUNG.md
```

## Công nghệ sử dụng

- HTML/CSS/JavaScript thuần (không framework, không bước build)
- [KaTeX](https://katex.org/) — render công thức LaTeX (tải qua CDN)
- [html2canvas](https://html2canvas.hertzen.com/) — xuất lời giải ra ảnh PNG (tải qua CDN)
- Bộ nhận diện ảnh tự viết bằng so khớp mẫu (template matching) trên `<canvas>`, không dùng dịch vụ OCR ngoài

## Giới hạn đã biết

- Nhận diện ảnh phù hợp nhất với chữ in/gõ máy rõ nét theo đúng quy ước `U`/`n`; chữ viết tay, công thức LaTeX phức tạp (phân số, số mũ lồng nhau...), hoặc ảnh có lẫn nhiều vùng nền sáng/tối khác nhau trong cùng một khung hình sẽ kém chính xác hơn — nên cắt ảnh sát vào phần chữ cần dùng.
- Biểu đồ Venn chỉ vẽ hình chính xác đến 4 tập hợp; từ 5 tập hợp trở lên dùng bảng liệt kê.
- Dự án chưa gắn giấy phép (license) cụ thể — nếu muốn chia sẻ công khai, bạn có thể tự thêm file `LICENSE` (ví dụ MIT) sau.

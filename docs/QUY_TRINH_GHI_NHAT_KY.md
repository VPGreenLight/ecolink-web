# Quy định Ghi Nhật Ký Làm Việc & Minh Chứng Mã Nguồn

> **Mục đích:** Tài liệu này quy định quy trình bắt buộc về việc ghi chép nhật ký làm việc (Work Log) và lịch sử trao đổi kỹ thuật cho mỗi phiên làm việc trên dự án EcoLink Web. Đây là **bằng chứng minh bạch gửi tới Giảng viên hướng dẫn** chứng minh toàn bộ mã nguồn được xây dựng qua quá trình tự tư duy, phân tích yêu cầu, phản biện giải pháp và lập trình từng bước, **hoàn toàn không sao chép (copy-paste)** từ bất kỳ nguồn nào.

---

## 1. Ý nghĩa học thuật & Cam kết liêm chính

Khi thực hiện đồ án, giảng viên cần thấy được **tiến trình tư duy và nỗ lực thực tế** của sinh viên thay vì chỉ nhìn vào sản phẩm cuối cùng.

1. **Minh chứng tự làm (Proof of Work):** Mọi chức năng, giao diện, bảng màu, luồng dữ liệu đều được ghi lại từ lúc còn là câu hỏi hoặc ý tưởng thô cho đến khi thành mã nguồn hoàn chỉnh.
2. **Hiểu bản chất (No Blind Copying):** Bằng chứng thể hiện rõ sinh viên hiểu từng file, từng hook (`useState`, `useEffect`), từng class CSS (`Tailwind v4`), và lý do vì sao chọn cách làm này mà không chọn cách khác.
3. **Minh bạch lỗi & sửa lỗi (Debugging Process):** Không có phần mềm nào hoàn hảo ngay từ đầu. Việc lưu lại các lần test fail, lỗi typecheck, lỗi giao diện và cách tìm nguyên nhân để sửa là bằng chứng thuyết phục nhất về năng lực lập trình thật.

---

## 2. Quy chuẩn bắt buộc cho mỗi phiên làm việc

Mỗi lần ngồi vào máy làm việc (dù là thêm tính năng mới, sửa một nút bấm, tối ưu giao diện, hay refactor code), **phải ghi lại một bản ghi vào thư mục `docs/`** (theo tên file ngày làm việc, ví dụ: `docs/2026-10-31.md`).

> **⚡ Nguyên tắc cập nhật liên tục (Real-time Continuous Logging):**
> Không gom lại cuối buổi mới viết. Sau **mỗi lượt câu hỏi / yêu cầu và phản hồi thực hiện**, nhật ký phải được cập nhật ngay lập tức: người học vừa chat gì, trợ lý đã giải quyết ra sao, file nào đã sửa và kết quả kiểm tra.

Mỗi bản ghi phải có đủ các nội dung:

| # | Mục | Nội dung cần ghi |
|---|---|---|
| 1 | **Mục tiêu phiên làm việc** | Hôm nay cần giải quyết bài toán gì? |
| 2 | **Lịch sử đối thoại chi tiết (Prompt & Response)** | **BẮT BUỘC:** Ghi lại nguyên văn người học đã chat gì và trợ lý đã phản hồi / đưa ra giải pháp gì. |
| 3 | **Phân tích kỹ thuật & Quyết định** | Giải pháp kỹ thuật được đưa ra là gì? Vì sao chọn giải pháp này (tối giản, dễ bảo trì, đúng chuẩn)? |
| 4 | **Chi tiết thay đổi code** | Đã sửa hoặc tạo những file nào? Từng thay đổi giải quyết vấn đề gì? |
| 5 | **Kiểm thử thực tế** | Đã chạy những lệnh kiểm tra nào (`npm run typecheck`, `npm run check`, `npm run build`)? Kết quả ra sao? |
| 6 | **Đúc kết & Tồn đọng** | Hôm nay học được gì? Còn việc gì cần hoàn thiện trong buổi sau? |

---

## 3. Khuôn mẫu (Template) mẫu cho một phiên làm việc

Khi bắt đầu một buổi làm việc mới, tạo file `docs/YYYY-MM-DD.md` (hoặc bổ sung vào file của ngày nếu cùng ngày) theo mẫu sau:

```markdown
# Nhật ký làm việc EcoLink — [YYYY-MM-DD]

## 1. Mục tiêu phiên làm việc
- [Mô tả ngắn gọn mục tiêu của buổi làm việc]

## 2. Chi tiết lịch sử đối thoại (Chat Transcript: Prompt & Response)

### Lượt trao đổi #1
- **Người học (Chat / Prompt):**
  > "[Nguyên văn nội dung người học yêu cầu hoặc câu hỏi đặt ra]"
- **Trợ lý (Phản hồi / Response):**
  > "[Nội dung phản hồi, phân tích nguyên nhân và giải pháp đề xuất]"

### Lượt trao đổi #2
- **Người học (Chat / Prompt):**
  > "[Phản hồi tiếp theo hoặc yêu cầu chỉnh sửa/bổ sung]"
- **Trợ lý (Phản hồi / Response):**
  > "[Giải pháp thực hiện và hướng dẫn cụ thể]"

## 3. Lịch sử trao đổi & Phân tích giải pháp
- **Vấn đề đặt ra:** [Chi tiết câu hỏi/yêu cầu của sinh viên]
- **Thảo luận phương án:** [Phân tích ưu/nhược điểm các cách làm]
- **Quyết định kỹ thuật:** [Chọn cách làm tối ưu, tuân thủ kiến trúc dự án]

## 4. Chi tiết thực hiện mã nguồn
| File | Thao tác | Lý do & Bản chất thay đổi |
|---|---|---|
| `src/path/to/File.tsx` | Sửa / Tạo | [Giải thích ngắn gọn tại sao sửa dòng code đó] |

## 5. Biên bản kiểm thử (Verification Log)
- Chạy lệnh kiểm tra TypeScript: `npm run typecheck` → Kết quả: PASS
- Chạy smoke test SSR: `npm run check` → Kết quả: All pages render OK
- Chạy build đóng gói: `npx vite build` → Kết quả: Build thành công không có warning/error

## 6. Vấn đề phát sinh & Cách giải quyết (nếu có)
- Lỗi gặp phải: ...
- Nguyên nhân: ...
- Cách khắc phục: ...

## 7. Việc còn lại cho phiên tiếp theo
- [ ] Việc 1
- [ ] Việc 2
```

---

## 4. Danh mục các nhật ký đã lưu

- [`docs/2026-09-28.md`](2026-09-28.md): Tái cấu trúc Navbar, thiết kế lại bảng màu theo hue sinh thái, đo đạc tương phản WCAG, sửa 56 màn hình và smoke test.
- [`docs/2026-10-31.md`](2026-10-31.md): Thiết lập quy chuẩn lưu trữ nhật ký làm việc và minh chứng quá trình phát triển mã nguồn gửi giảng viên.

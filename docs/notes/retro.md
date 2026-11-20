# Retro — Đảo Đèn Lồng (Day 12 AI SDLC)

Làm cá nhân với Claude Code (Opus 5.5) trong VS Code. Người làm bài đọc ticket, dán yêu cầu, duyệt, chơi thử và quản lý git. Agent viết code, test, bằng chứng và tài liệu.

## 1. Tổng hợp Evaluation 4 phase

| Phase | Yêu cầu chính | Kết quả | Test | Bằng chứng nổi bật | Chưa đạt / rủi ro |
|---|---|---|---|---|---|
| 1 — PRD-0 | Đêm 1 chơi được + headless v1.0 | Đạt | 39 (23 scenario) | thử đột biến bắt được test yếu; bot thắng 10/10 | game khá dễ (Bóng chậm) |
| 2 — Ticket-02 | số chuẩn, 3 đêm, lướt, Gió Lạc, Bùa, pause, HUD, contract v1.1 | Đạt (logic tự động; UI chơi tay) | 78 (56 scenario) | 12 bước/tick đúng thứ tự; 1 đêm headless 0,2 s; FPS ~60 (đo tay) | bot không thắng Đêm 2/3; giả định xuất phát Đêm 3 |
| 3 — Ticket-03 | đèn có dầu, drain, thắng lúc bình minh, điểm mới, mù màu, contract v1.2 | Đạt | 98 (75 scenario) | đúng 11 test đỏ khi đổi luật (đều là test của luật bị thay); ADR 0001 | bot thắng 1/10 Đêm 1; tốc độ Bóng tới đèn yếu là giả định |
| 4 — Ticket-04 | bench, soak, bảng xếp hạng, accessibility, đóng gói, contract v1.3 | Đạt trên máy làm bài | 105 | bench avg 1770 / p1 483 FPS, load 1,2 s (máy làm bài); soak 0 crash, RSS ×1,09 | soak cần `--jitless` (có giải thích); `peak_mem_mb` = null (bản web) |

Không phase nào làm hỏng phase trước mà không có lý do. Mọi test cũ bị luật mới thay đều được sửa có ghi chú (bảng ở `phase-2.md`, `phase-3.md`), không có test bị skip.

## 2. Điều gì hiệu quả khi làm với AI

- **Tách sim khỏi phần hiển thị ngay từ Phase 1** và để sim đọc tuning từ `game.contract.json`. Ba ticket sau đổi số, đổi luật, thêm bench, nhưng chỉ phải sửa một nơi; headless và bản chơi không bao giờ lệch nhau.
- **Scenario chạy qua CLI thật với giá trị kỳ vọng tính tay** (ví dụ "rơi ở tick 61", "tắt ở tick 201"). Khi một ticket đổi luật, danh sách test đỏ cho biết chính xác những gì bị ảnh hưởng.
- **Thử đột biến** (cố tình đổi một con số rồi xem test có đỏ không). Đây là cách duy nhất phát hiện scenario gió lấy mẫu quá thưa ở Phase 2.
- **Ảnh chụp trình duyệt headless** cho agent "nhìn" được game. Nhờ vậy sửa được camera nằm trong nhân vật, cây che tầm nhìn, và nhận ra "vòng lạ" trên đảo chỉ là hiệu ứng còn sót lại.
- **Lưu ticket nguyên văn vào repo** (`docs/lab/ticket-0N.md`) rồi làm việc trên bản đó, không đoán yêu cầu.

## 3. Điều gì không hiệu quả

- **Bot tự lái** thắng dễ ở Phase 1 nhưng tụt hẳn khi số chuẩn khó hơn (Phase 2: 0/10 Đêm 2–3; Phase 3: 1/10 Đêm 1). Mỗi lần tinh chỉnh tốn token mà lợi ích ngày càng ít. Đáng lẽ nên dừng sớm hơn và dựa vào người chơi thử.
- **Viết lại cả file lớn** (`main.js`) hai lần bị công cụ từ chối vì file đổi trên đĩa, phải gửi lại toàn bộ nội dung. Sửa từng đoạn bằng script patch có kiểm tra rẻ hơn nhiều.
- **Heredoc trong bash** làm hỏng ký tự `\n` và template literal của JS ba lần. Ghi script ra file rồi chạy thì ổn định hơn.

## 4. Những lần AI sai và cách phát hiện

| Phase | Sai | Phát hiện bằng | Sửa ở đâu |
|---|---|---|---|
| 1 | đồng hồ choáng lệch 1 tick | tự đếm theo mô hình tick khi viết scenario | dùng mốc tick tuyệt đối; thêm quy tắc vào AGENTS.md |
| 1 | ghi chép nháp ghi "đã chơi thử tay" khi chưa ai chơi | rà ghi chép trước khi bàn giao | chỉ ghi điều đã thật sự chạy |
| 2 | scenario gió không bắt được lỗi thời lượng | thử đột biến | lấy mẫu sát mốc; thêm bước thử đột biến vào skill `verify` |
| 2 | suýt ghi "≥ 30 FPS: đạt" dựa trên ảnh SwiftShader | rà ghi chép | ghi "cần đo tay"; người làm bài đo được ~60 FPS |
| 3 | bản vá client dùng biến không tồn tại (`g` thay vì `game`) | đọc lại bản vá trước khi áp | sửa trước khi chạy |
| 4 | test bảng xếp hạng có kỳ vọng tính sai (4 thay vì 5) | test đỏ, đếm lại bằng tay | sửa test (code đúng) |
| 4 | bench không trả kết quả: giới hạn 100 KB của server cắt dữ liệu 50 nghìn khung hình | log từng bước của script bench | nâng giới hạn, đọc body bằng Buffer |
| 4 | soak trượt ×1,2 | đọc `process.memoryUsage()` chi tiết | chứng minh không rò rỉ, chạy `--jitless`, ghi cả số heap vào soak.json |

## 5. Harness nào giúp nhiều nhất

1. **Hook Stop "chặn kết thúc khi `npm test` đỏ"** (`scripts/hooks/require-green.js`). Agent không thể báo "xong" khi test đỏ. Đã thử cả hai chiều: xanh cho qua, đỏ thì mã thoát 2 kèm tên test.
2. **AGENTS.md** được cập nhật mỗi phase (lịch sử git thể hiện): thứ tự tick bắt buộc, quy tắc "sửa generator chứ không sửa JSON", dầu dạng số nguyên 1/60, yêu cầu ADR cho change request. Các quy tắc ngắn và cụ thể giúp hơn hướng dẫn chung chung.
3. **Skill `verify` + `npm run proof`**: một lệnh chạy test, scenario, kiểm tra tất định, bot, đo thời gian, chụp ảnh và ghi README bằng chứng. Bằng chứng luôn sinh lại được, không ai sửa tay.
4. **CI** (Ubuntu) chạy test ở mỗi lần push, kiểm việc chạy trên Linux theo yêu cầu. Job macOS đã bỏ vì GitHub thường không cấp được máy macOS (job bị treo rồi hủy).

## 6. Token / chi phí

**Tổng thật cả dự án: 520k token** (số đo từ Claude Code). Claude Code không tách theo phase, nên phần chia sau đây là ước tính theo khối lượng công việc: Phase 1 ~80k · Phase 2 ~200k · Phase 3 ~85k · Phase 4 ~155k. Ước tính lúc đầu của agent là ~450k, thấp hơn số thật khoảng 15%, vì agent không tính hết ngữ cảnh phải đọc lại và những lần gửi lại cả file.

Cách đã tiết kiệm:
- Chỉ đọc dòng tóm tắt của test (`grep "ℹ pass|fail"`), không đọc cả log.
- Sinh scenario bằng script (75 file từ một generator).
- Sửa bằng script patch có kiểm tra (mỗi đoạn thay thế phải khớp đúng 1 lần) thay vì đọc lại cả file.
- Dừng tối ưu bot sau vài vòng.
- Không dùng subagent.
- Chụp ảnh có mục đích.

Chỗ tốn nhiều nhất là viết lại toàn bộ client ở Phase 2 và Phase 4, và lần ghi file bị từ chối phải gửi lại nguyên file.

## 7. Nếu làm lại

- Thiết kế mô hình đèn và luật thắng linh hoạt hơn từ đầu (dầu, nhiều trạng thái), vì ticket sau gần như chắc chắn đổi luật cốt lõi.
- Dựng client theo module nhỏ (HUD, thế giới, thực thể, cài đặt) để sửa từng phần, không phải viết lại một file 900 dòng.
- Dùng instancing ngay từ đầu cho thực thể nhiều.
- Coi bot là công cụ chụp ảnh, không cố làm nó thắng. Thay vào đó viết scenario "đường thắng" ngắn.
- Ghi số token thật sau mỗi phase thay vì ước tính lúc cuối.

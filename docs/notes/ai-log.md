# Nhật ký dùng AI

Công cụ: **Claude Code** (VS Code extension), model Claude Opus 5.5. Harness: [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), [.claude/settings.json](../../.claude/settings.json) (hooks), [.claude/skills/verify](../../.claude/skills/verify/SKILL.md).

## Phase 1

**Lời nhắc chính:** "đọc bài lab day 12 và làm cho t (không comment, phần git t tự làm)".

**Trình tự agent đã làm:**
1. Đọc README/GUIDE/RUBRIC trong repo, sau đó đọc tab Phase 1 trên lab board (PRD-0 + Test Contract v1.0) và trích nguyên văn phần contract.
2. Chọn kiến trúc: sim JS thuần, tách khỏi phần hiển thị, đọc tuning từ `game.contract.json`.
3. Viết sim + CLI, chạy thử bằng chính ví dụ scenario/inputs trong contract (nhặt đom đóm ở tick 35, đúng 1,5 m; sự kiện pulse ở tick 201).
4. Viết 23 scenario với giá trị kỳ vọng tính tay, kèm test contract/CLI/unit. 38/38 đạt ngay lần đầu.
5. **Thử đột biến** (đổi `player_speed` 6→5, `invuln_s` 1,5→1): 4 scenario đỏ đúng chỗ, nên test không phải loại "luôn đạt". Sau đó trả lại số cũ.
6. Viết client Three.js, chụp ảnh bằng Edge headless, xem ảnh và sửa (camera ban đầu nằm trong nhân vật; cây che camera).
7. Viết bot tự lái, dùng để chứng minh Đêm 1 thắng được (10/10 seed) và để chụp ảnh màn thắng.
8. Harness: hook Stop chặn kết thúc khi `npm test` đỏ, hook PostToolUse chạy test sau khi sửa `src/`, `tests/` hoặc contract. Đã thử: test xanh thì mã thoát 0; cố tình làm hỏng scenario 01 thì mã thoát 2 kèm tên test đỏ.

**Những lần AI sai và cách phát hiện:**

| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| Đồng hồ choáng/bất tử đếm ngược lệch 1 tick (choáng 178 tick thay vì 180) | Tự đếm theo mô hình tick của contract khi viết scenario 15 | Đổi sang mốc tick tuyệt đối. Thêm quy tắc vào AGENTS.md |
| `index.html` dùng `./main.js` trong khi trang được phục vụ ở `/`, nên đường dẫn sai | Đọc lại trước khi chạy | Đổi sang đường dẫn tuyệt đối `/src/web/main.js` |
| Ảnh đầu tiên: camera nằm trong nhân vật, cảnh quá tối | Xem ảnh chụp headless | Đặt camera ngay vị trí đích khi ở quá xa, tăng ánh sáng |
| Cây che tầm nhìn camera | Xem ảnh chụp | Chỉ đặt cây ở mép đảo (32–38 m) |
| Edge headless chạy trong bash sandbox không ra file và không báo lỗi | Kiểm tra file đầu ra | Chạy proof từ PowerShell. Ghi lưu ý vào skill verify |
| Ghi chép nháp ghi "đã chơi thử bằng tay" trong khi chưa ai chơi | Rà lại ghi chép trước khi bàn giao | Sửa thành "cần chơi thử tay". Bằng chứng chỉ ghi điều đã thật sự chạy |

**Token / chi phí (ước tính):** khoảng 1 phiên Claude Code. Phần lớn là ngữ cảnh đọc lại (được cache), khoảng 60–80 nghìn token đầu ra. _Chủ repo thay bằng số thật từ `/cost` hoặc trang usage._

**Cách tiết kiệm token:**
- Đọc lab board một lần, trích phần text của contract rồi làm việc trên bản đó, không mở lại HTML 180 KB.
- Sinh 23 file scenario bằng một script thay vì viết tay từng file.
- Dùng `grep`/`tail` để chỉ xem dòng tóm tắt của test, không đọc toàn bộ log.
- Không dùng subagent. Dùng ảnh chụp có mục đích (3 lần chụp để sửa hiển thị), không chụp lặp.

## Phase 2

**Lời nhắc chính:** "xong phase 1 rồi, làm phase 2 đi" kèm nội dung Ticket-02 dán từ lab board.

**Trình tự agent đã làm:**
1. Đọc lab board: nội dung ticket được trang tải động từ cơ sở dữ liệu nên agent không đọc được. Agent dừng lại và nhờ người dán nguyên văn, **không đoán yêu cầu**. Ticket được lưu vào `docs/lab/ticket-02.md` để truy vết.
2. Liệt kê chỗ mơ hồ, viết 27 giả định trước khi code (`docs/notes/phase-2.md`).
3. Viết lại sim theo thứ tự 12 bước bắt buộc, tách bản đồ ra `maps.js`, cập nhật contract v1.1.
4. Viết lại 23 scenario cũ theo số mới (ghi lý do từng cái) và thêm 33 scenario mới. Giá trị kỳ vọng tính tay (ví dụ rơi ở tick 61, lướt 7.6 m, bục Đêm 3 đáp ở Y=6). 56/56 đạt ngay lần đầu.
5. Thử đột biến 5 con số (stun, vùng an toàn, bán kính chạm Gió Lạc, thời lượng gió…). Bốn số bị bắt ngay. **Thời lượng gió không bị bắt** vì scenario chỉ lấy mẫu mỗi 300 tick, nên đã sửa scenario lấy mẫu ở tick 2097 rồi thử lại: đã bắt được.
6. Bản chơi viết lại; chụp ảnh headless để kiểm tra từng đêm và góc nhìn từ trên xuống.

**Những lần AI sai và cách phát hiện:**

| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| Bot cũ thua 30/30 với số chuẩn (bị Bóng Mực chạm, không phải lỗi luật) | Thống kê nguyên nhân `player_hit` theo `by` | Thêm né tránh + lướt + tỏa sáng sớm: Đêm 1 thắng 7/10. Đêm 2/3 vẫn chưa thắng, ghi trung thực |
| Scenario gió không bắt được đột biến thời lượng gió | Thử đột biến | Lấy mẫu sát mốc kết thúc cơn gió |
| Heredoc bash có template literal JS bị lỗi phân tích | Lệnh lỗi | Ghi script sửa ra file `.py` rồi chạy |
| Ảnh Đêm 3 có "vòng cát" lạ | Xem ảnh | Truy ra đó là hiệu ứng vòng Tỏa Sáng còn sót từ bước tua nhanh (warp), không phải lỗi bản đồ. Kiểm bản đồ lại bằng góc nhìn từ trên |
| Suýt ghi "đạt" cho FPS ≥ 30 dựa trên ảnh headless | Rà lại ghi chép | Ghi "cần đo tay trên máy thật" vì SwiftShader không đại diện |

**Chỉnh harness:** AGENTS.md thêm thứ tự tick bắt buộc, quy tắc "sửa generator chứ không sửa JSON", và bước thử đột biến. Skill `verify` thêm bước thử đột biến, ghi chú về FPS và âm thanh chỉ kiểm được bằng tay.

**Token / chi phí (ước tính):** Phase 2 tốn nhiều hơn Phase 1 vì ticket lớn và client viết lại: ước khoảng 150–200 nghìn token đầu ra trong phiên Claude Code. _Chủ repo thay bằng số thật từ `/cost`._

**Cách tiết kiệm token:** sinh scenario bằng script, chỉ đọc dòng tóm tắt test, dừng tối ưu bot sau 3 vòng (bot chỉ là công cụ bằng chứng), không dùng subagent.

## Phase 3

**Lời nhắc chính:** "xong phase 2 rồi, làm phase 3 đi" kèm nội dung Ticket-03 dán từ lab board. Phase chỉ có 30 phút nên ưu tiên luật và test, tối ưu bot để sau.

**Trình tự agent đã làm:**
1. Lưu ticket nguyên văn; lập bảng "luật bị thay → code/test/tài liệu bị ảnh hưởng" trước khi sửa.
2. Đổi mô hình đèn sang dầu nguyên đơn vị 1/60 (theo khuyến nghị của ticket), vùng an toàn và sức chứa thành giá trị suy ra. Ghi lại trong ADR 0001.
3. Chạy test sau khi sửa sim: **đúng 11 test đỏ, đều là test của luật bị thay**, không test nào khác đỏ. Sửa hoặc thay từng test kèm lý do; thêm 18 scenario mới. 75/75 đạt.
4. Thử đột biến 4 số mới: cả 4 đều bị bắt.

**Những lần AI sai và cách phát hiện:**

| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| Scenario 63 ban đầu chạy 200 tick, chưa đủ để Bóng đi 12 m rồi hút đủ 60 tick | Tính tay trước khi chạy | Tăng lên 300 tick, kiểm thêm dầu của đèn khỏe |
| Bản vá client dùng biến `g` (không tồn tại trong main.js) thay vì `game` | Đọc lại bản vá trước khi áp | Sửa trước khi chạy |
| Bot thắng Đêm 1 seed 1 không còn đúng với luật mới (1/10 seed) | Test đỏ | Đổi sang seed 9 và điều kiện "≥ 3 đèn sáng lúc bình minh", ghi lý do; không chỉnh bot thêm vì thiếu thời gian |
| Ticket nói "đèn đầy dầu không được chọn" nhưng sau khi hao 1/60 thì đèn hầu như không bao giờ đúng 100 | Tính tay công thức | Giữ đúng công thức của ticket (ceil làm châm 1 đom đóm ngay cả khi thiếu 0.02 dầu); kiểm trường hợp đầy bằng unit test |

**Token / chi phí (ước tính):** khoảng 60–90 nghìn token đầu ra. _Chủ repo thay bằng số thật từ `/cost`._

**Cách tiết kiệm:** sửa bằng script patch có kiểm tra (mỗi đoạn thay thế phải khớp đúng 1 lần), chạy test để thấy đúng danh sách test bị ảnh hưởng thay vì đọc lại toàn bộ code, ít ảnh chụp (2 ảnh kiểm tra).

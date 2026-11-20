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

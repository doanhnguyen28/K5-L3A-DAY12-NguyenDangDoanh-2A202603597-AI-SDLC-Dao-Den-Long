# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Release `v1.0.0`)_ · **Bằng chứng:** [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md) · **Đề bài:** [lab](docs/lab/README.md), [Ticket-02](docs/lab/ticket-02.md), [Ticket-03](docs/lab/ticket-03.md)

Game 3D góc nhìn thứ ba qua **3 Đêm**: Mây, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp lại các Đèn Lồng Lớn trên Đảo Bến, Đảo Cau và Đảo Chuông trước bình minh, né Bóng Mực và Gió Lạc trong sương đen.

Công nghệ: JavaScript thuần. Logic game (`src/sim/`) tất định, không phụ thuộc DOM, dùng chung cho bản chơi (Three.js trong trình duyệt) và chế độ headless (Node). Chạy trên macOS, Linux và Windows. Cần Node ≥ 18 và trình duyệt có WebGL.

## Cài đặt và chạy (3 lệnh)

```bash
git clone https://github.com/doanhnguyen28/K5-L3A-DAY12-NguyenDangDoanh-2A202603597-AI-SDLC-Dao-Den-Long.git && cd K5-L3A-DAY12-NguyenDangDoanh-2A202603597-AI-SDLC-Dao-Den-Long
npm install
npm start          # rồi mở http://localhost:8080
```

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` | Di chuyển (theo hướng camera) |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0,2 s, hồi chiêu 1,5 s) |
| `E` | Nạp đom đóm vào đèn chưa sáng gần nhất (trong 2 m) |
| `F` hoặc chuột trái | Tỏa Sáng: tốn 3 đom đóm, choáng và đẩy lùi Bóng Mực trong 5 m |
| Kéo chuột, `←` `→` | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `F3` | Bật/tắt bộ đếm FPS |
| `B` | Bật/tắt tự lái (bot demo) |

## Luật chơi và điểm (Ticket-02 + Ticket-03 "Đèn cạn dầu")

- **3 Đêm:** Đêm 1 Đảo Bến (5 đèn, 240 s) → Đêm 2 Đảo Cau (2 đảo nối bằng cầu tre và bục nhảy, 6 đèn, 270 s) → Đêm 3 Đảo Chuông (3 tầng, dốc, bục, gió mạnh, 7 đèn, 300 s).
- **Mục tiêu: giữ đảo sáng tới bình minh.** Thắng nếu còn sống khi hết giờ và có ít nhất 3/5 (Đêm 1), 4/6 (Đêm 2), 5/7 (Đêm 3) đèn đang sáng. Thắp đủ đèn không kết thúc đêm sớm. Thua nếu hết Ngọn Lửa hoặc trời sáng mà không đủ đèn.
- **Đèn cạn dầu:** đèn vừa thắp có 100 dầu, hao 1/giây. Bấm `E` ở đèn đang sáng để châm (mỗi đom đóm +10 dầu). Hết dầu thì đèn tắt; thắp lại chỉ cần 5 đom đóm (lần đầu cần 10). Đèn dưới 30 dầu nhấp nháy và **mất vùng an toàn**.
- **Bóng Mực hút dầu:** Bóng đang lang thang tìm tới đèn yếu (< 30 dầu), đứng cạnh và hút 5 dầu/giây. Lại gần (≤ 6 m) thì nó quay sang đuổi Mây; Tỏa Sáng làm nó choáng; châm dầu lên ≥ 30 thì nó bị đẩy ra.
- **Mây:** chạy 6 m/s, nhảy 7 m/s, lướt 14 m/s, 3 Ngọn Lửa. Sức chứa đom đóm bắt đầu 10, +2 mỗi lần thắp thành công trong đêm (tối đa 20).
- **Bóng Mực, Gió Lạc, Bùa Gió, rơi khỏi đảo:** như Ticket-02 (xem [ticket-02](docs/lab/ticket-02.md)).

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Bóng Mực trúng Tỏa Sáng | +5 (+15 nếu nó đang hút dầu) |
| Bình minh (chỉ khi thắng): mỗi đèn đang sáng | +50 + số dầu còn lại (làm tròn xuống) |
| Bình minh (chỉ khi thắng): mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm = tổng điểm các đêm đã thắng. Tuning đọc trực tiếp từ `game.contract.json`.

## Test Contract v1.2 / chế độ headless

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```

- `--night` nhận 1, 2, 3. Headless không cần `npm install`. Một đêm đầy đủ (21.600 tick) chạy khoảng 0,1–0,3 s.
- Khai báo: [`game.contract.json`](game.contract.json). Giả định cho chỗ ticket chưa nói rõ: [Phase 2](docs/notes/phase-2.md), [Phase 3](docs/notes/phase-3.md). Quyết định thiết kế: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG](CHANGELOG.md). Đáng chú ý: Đêm 3 xuất phát ở (0, 0, −30) vì tâm đảo là tháp chuông.
- Mã thoát: `0` thành công · `2` file inputs/scenario không đọc được hoặc sai định dạng · `1` lỗi tham số dòng lệnh.

## Test và bằng chứng

```bash
npm test                     # 98 test: unit, contract, 75 scenario headless (chạy qua CLI thật)
npm run proof -- phase-3     # tạo lại docs/proof/phase-3/
```

CI (GitHub Actions, Ubuntu + macOS) chạy `npm test` và bộ proof ở mỗi lần push.

## Sáng tạo của tôi

Mọi phần thêm chỉ nằm ở lớp hiển thị (`src/web/`), không đụng `src/sim/`, nên đầu ra headless không đổi. Bằng chứng: 75 scenario và hash tất định trong [docs/proof/phase-3](docs/proof/phase-3/README.md) chạy trên `src/sim`, không có code nào của `src/web`.

- **Đom đóm dẫn đường:** khi Mây đang mang đom đóm, một đốm sáng nhỏ bay lên phía trước, chỉ hướng tới đèn chưa sáng gần nhất.
- **Lời Ông Đăng:** mỗi đêm mở đầu bằng một lời dặn riêng của người giữ đèn già.
- **Âm thanh tự tổng hợp** bằng WebAudio (không dùng file ngoài): nhạc nền ngũ cung, hiệu ứng cho từng sự kiện, tiếng gió báo trước cơn gió.
- **Đảo sáng dần, bình minh khi thắng Đêm 3.** Đèn đã sáng có vòng sáng cho biết vùng an toàn 6 m. Bóng Mực mờ dần lúc xuất hiện.
- **Bảng màu dễ phân biệt** (Ticket-03, trong Cài đặt) đi kèm vết rách trên giấy đèn tắt, để phân biệt đèn tắt/sáng không cần màu.
- **Bot tự lái** (`B`, `?bot=1`): dùng đúng các input người chơi có. Dùng để chụp ảnh bằng chứng tự động và làm số liệu độ khó.

## Cấu trúc

```text
game.contract.json     khai báo Test Contract v1.1 (nguồn tuning)
src/sim/               logic tất định: game, maps (3 bản đồ), constants, inputs, rng, bot, run
src/headless.js        CLI theo contract
src/web/               Three.js, HUD, menu, âm thanh
tests/                 node:test; tests/gen_scenarios.py sinh tests/scenarios/*.json
scripts/               serve, make-proof, screenshot, hooks
docs/lab/              đề bài + ticket (nguyên văn)
docs/notes/            giả định, tiêu chí nghiệm thu, đánh giá từng phase, nhật ký AI, retro
docs/proof/phase-N/    bằng chứng sinh tự động
AGENTS.md, CLAUDE.md, .claude/   harness AI (hướng dẫn, hooks, skill verify)
```

## Ghi chép

- Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md) · Phase 2: [docs/notes/phase-2.md](docs/notes/phase-2.md) · Phase 3: [docs/notes/phase-3.md](docs/notes/phase-3.md) · ADR: [docs/adr/](docs/adr/)
- Nhật ký dùng AI và token: [docs/notes/ai-log.md](docs/notes/ai-log.md) · Retro: [docs/notes/retro.md](docs/notes/retro.md)
- Nguồn tài nguyên và giấy phép: [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)

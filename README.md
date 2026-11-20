# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Release `v1.0.0`)_ · **Bằng chứng:** [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · **Đề bài:** [lab](docs/lab/README.md), [Ticket-02](docs/lab/ticket-02.md)

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

## Luật chơi và điểm (số chuẩn của Ticket-02)

- **3 Đêm:** Đêm 1 Đảo Bến (5 đèn, 300 s) → Đêm 2 Đảo Cau (2 đảo nối bằng cầu tre và bục nhảy, 6 đèn, 330 s) → Đêm 3 Đảo Chuông (3 tầng, dốc, bục, gió mạnh, 7 đèn, 360 s). Thắng thì sang đêm sau. Thua thì chơi lại đêm đó. Thắng Đêm 3 thì thấy Bình Minh và tổng điểm.
- **Mây:** chạy 6 m/s, nhảy 7 m/s, 3 Ngọn Lửa (hồi đầy mỗi đêm), mang tối đa 10 đom đóm. Tự nhặt trong 1 m.
- **Đèn:** cần 10 đom đóm, nạp nhiều lần được. Đèn sáng tạo vùng an toàn 6 m mà Bóng Mực không vào được.
- **Bóng Mực:** sinh từ giây thứ 5, đuổi khi cách ≤ 12 m (bỏ khi > 18 m), 4 m/s (Đêm 3: 4,5 m/s). Bị chạm: −1 Ngọn Lửa, rơi một nửa số đom đóm ra quanh Mây (nhặt lại được trong 8 s), bất tử 1,5 s.
- **Gió Lạc** (Đêm 2–3): dải lụa xám xanh, lao tới khi Mây mang ≥ 5 đom đóm, cướp 3 rồi bỏ chạy. Tỏa Sáng lúc nó đang bỏ chạy thì nó thả lại đom đóm.
- **Bùa Gió** (Đêm 2–3): chạy 7,2 m/s và lướt không hồi chiêu trong 10 s.
- **Rơi khỏi đảo:** −1 Ngọn Lửa, mất hết đom đóm, hồi sinh sau 1 s ở điểm xuất phát.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi lần) | +5 |
| Khi thắng một đêm: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng một đêm: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm = tổng điểm các đêm đã thắng. Tuning đọc trực tiếp từ `game.contract.json`.

## Test Contract v1.1 / chế độ headless

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```

- `--night` nhận 1, 2, 3. Headless không cần `npm install`. Một đêm đầy đủ (21.600 tick) chạy khoảng 0,1–0,3 s.
- Khai báo: [`game.contract.json`](game.contract.json). Các giả định cho chỗ ticket chưa nói rõ: [docs/notes/phase-2.md](docs/notes/phase-2.md#giả-định-chỗ-ticket-chưa-nói-rõ). Đáng chú ý: Đêm 3 xuất phát ở (0, 0, −30) vì tâm đảo là tháp chuông.
- Mã thoát: `0` thành công · `2` file inputs/scenario không đọc được hoặc sai định dạng · `1` lỗi tham số dòng lệnh.

## Test và bằng chứng

```bash
npm test                     # 78 test: unit, contract, 56 scenario headless (chạy qua CLI thật)
npm run proof -- phase-2     # tạo lại docs/proof/phase-2/
```

CI (GitHub Actions, Ubuntu + macOS) chạy `npm test` và bộ proof ở mỗi lần push.

## Sáng tạo của tôi

Mọi phần thêm chỉ nằm ở lớp hiển thị (`src/web/`), không đụng `src/sim/`, nên đầu ra headless không đổi. Bằng chứng: 56 scenario và hash tất định trong [docs/proof/phase-2](docs/proof/phase-2/README.md) chạy trên `src/sim`, không có code nào của `src/web`.

- **Đom đóm dẫn đường:** khi Mây đang mang đom đóm, một đốm sáng nhỏ bay lên phía trước, chỉ hướng tới đèn chưa sáng gần nhất.
- **Lời Ông Đăng:** mỗi đêm mở đầu bằng một lời dặn riêng của người giữ đèn già.
- **Âm thanh tự tổng hợp** bằng WebAudio (không dùng file ngoài): nhạc nền ngũ cung, hiệu ứng cho từng sự kiện, tiếng gió báo trước cơn gió.
- **Đảo sáng dần, bình minh khi thắng Đêm 3.** Đèn đã sáng có vòng sáng cho biết vùng an toàn 6 m. Bóng Mực mờ dần lúc xuất hiện.
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

- Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md) · Phase 2: [docs/notes/phase-2.md](docs/notes/phase-2.md)
- Nhật ký dùng AI và token: [docs/notes/ai-log.md](docs/notes/ai-log.md) · Retro: [docs/notes/retro.md](docs/notes/retro.md)
- Nguồn tài nguyên và giấy phép: [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)

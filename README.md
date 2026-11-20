# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Release `v1.0.0`)_ · **Bằng chứng Phase 1:** [docs/proof/phase-1/](docs/proof/phase-1/README.md) · **Đề bài lab:** [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, chạy khắp Đảo Bến gom đom đóm để thắp lại 5 Đèn Lồng Lớn trước bình minh, đồng thời né và xua Bóng Mực trong sương đen.

Công nghệ: JavaScript thuần. Logic game (`src/sim/`) tất định, không phụ thuộc DOM, dùng chung cho bản chơi (Three.js trong trình duyệt) và chế độ headless (Node). Chạy trên macOS, Linux và Windows. Cần Node ≥ 18 và một trình duyệt có WebGL.

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
| `E` | Nạp đom đóm vào đèn gần nhất (trong 3 m) |
| `F` hoặc chuột trái | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| Kéo chuột, `←` `→` | Xoay camera |
| `R` | Chơi lại (bất cứ lúc nào, kể cả sau khi thắng/thua) |
| `M` | Tắt/bật âm thanh |
| `B` | Bật/tắt tự lái (bot demo) |

## Luật chơi và cách tính điểm

- Đảo tròn bán kính 40 m, 5 Đèn Lồng Lớn trên vòng tròn bán kính 25 m (L1 ở (0, 0, 25)). Mây xuất phát ở tâm, có **3 ngọn lửa** (máu).
- 30 đom đóm rải ngẫu nhiên; cứ 2 giây sinh thêm 1 con nếu đang dưới 30. Tự nhặt khi đi tới trong **1,5 m**. Mang tối đa **10**.
- Mỗi đèn cần **5** đom đóm. Bấm `E` trong **3 m** để nạp (nạp được một phần).
- Bóng Mực: 2 con lúc đầu, thêm 1 con mỗi 30 giây (tối đa 6). Đuổi theo Mây với **3,5 m/s** (Mây chạy **6 m/s**). Chạm trong **1 m**: mất 1 lửa, rơi **50%** đom đóm đang mang (làm tròn xuống, rơi mất), bất tử **1,5 s**.
- Bóng Mực **không vào được vòng 5 m quanh đèn đã thắp**: đứng cạnh đèn sáng là an toàn.
- Tỏa sáng: tốn 1 đom đóm, hồi chiêu 1 s, choáng **3 s** và đẩy lùi **4 m** mọi Bóng Mực trong **6 m**.
- **Thắng:** thắp đủ 5 đèn. **Thua:** hết lửa, hoặc hết **300 giây** (bình minh).

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi 1 lần tỏa sáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +5 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

Mọi con số trên được đọc trực tiếp từ `game.contract.json` (nguồn duy nhất), nên số khai báo luôn trùng số game dùng.

## Test Contract v1.0 / chế độ headless

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```

- Khai báo: [`game.contract.json`](game.contract.json). Headless không cần `npm install`.
- `fall_enabled: false`: Mây không thể rơi khỏi đảo (bị chặn ở mép bán kính 40 m), nên không bao giờ có sự kiện `player_hit` với `by: "fall"`.
- Không có `dash`. Trường `dash` trong inputs được chấp nhận nhưng bị bỏ qua.
- Snapshot có thêm mảng `motes` (`id`, `pos`) như khuyến nghị.
- Mã thoát: `0` thành công · `2` file inputs/scenario không đọc được hoặc sai định dạng · `1` lỗi tham số dòng lệnh.
- Các giả định cho chỗ contract chưa nói rõ: [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Test và bằng chứng

```bash
npm test                     # unit + contract + 23 scenario headless (chạy qua CLI thật)
npm run proof -- phase-1     # tạo lại docs/proof/phase-1/ (bảng yêu cầu → kết quả, tính tất định, bot, ảnh chụp)
```

CI (GitHub Actions, Ubuntu + macOS) chạy `npm test` và bộ proof ở mỗi lần push.

## Sáng tạo của tôi

Mọi phần thêm chỉ nằm ở lớp hiển thị (`src/web/`), không đụng `src/sim/`, nên đầu ra headless không đổi (bằng chứng: toàn bộ scenario và hash tất định trong [docs/proof/phase-1](docs/proof/phase-1/README.md) chạy trên `src/sim` không có code nào của `src/web`).

- **Đom đóm dẫn đường:** một đốm sáng nhỏ bay quanh Mây; khi Mây đang mang đom đóm, nó bay lên phía trước, chỉ hướng tới đèn chưa thắp gần nhất.
- **Âm thanh tự tổng hợp** bằng WebAudio (không dùng file âm thanh): tiếng chuông khi nhặt, hợp âm khi thắp đèn, tiếng "vút" khi tỏa sáng, tiếng trầm khi bị chạm.
- **Đảo sáng dần và bình minh:** sương và bầu trời ấm dần theo số đèn đã thắp; khi thắng, trời chuyển màu bình minh. Đèn đã thắp có vòng sáng cho biết vùng an toàn 5 m.
- **Bot tự lái** (`B` trong game, `?bot=1` trên URL): dùng đúng các input người chơi có; dùng để chứng minh Đêm 1 thắng được và để chụp ảnh bằng chứng tự động.

## Cấu trúc

```text
game.contract.json     khai báo Test Contract (nguồn tuning duy nhất)
src/sim/               logic game tất định (game, inputs, rng, bot, run)
src/headless.js        CLI theo contract
src/web/               Three.js + HUD + âm thanh
tests/                 node:test; tests/scenarios/*.json = yêu cầu → kỳ vọng
scripts/               serve, make-proof, screenshot, hooks
docs/notes/            giả định, nhật ký AI, retro
docs/proof/phase-N/    bằng chứng sinh tự động
AGENTS.md, CLAUDE.md, .claude/   harness AI (hướng dẫn, hooks, skill verify)
```

## Ghi chép

- Giả định, tiêu chí nghiệm thu, đánh giá Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md)
- Nhật ký dùng AI và token: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Retro: [docs/notes/retro.md](docs/notes/retro.md)
- Nguồn tài nguyên và giấy phép: [CREDITS.md](CREDITS.md), [LICENSE](LICENSE)

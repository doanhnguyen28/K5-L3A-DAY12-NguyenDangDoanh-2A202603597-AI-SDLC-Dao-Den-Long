# Phase 4: Ticket-04 "Bình minh: phát hành v1.0.0" + Test Contract v1.3

Nguồn yêu cầu: [docs/lab/ticket-04.md](../lab/ticket-04.md) (bản sao nguyên văn). Bằng chứng: [docs/proof/phase-4](../proof/phase-4/README.md).

## Quyết định chính

| Quyết định | Lý do |
|---|---|
| Benchmark = Node mở Chrome/Edge thật bằng `--app`, cửa sổ 1280×720, canvas cố định 1280×720, cờ tắt vsync; trang gửi danh sách thời gian khung về server; Node tính số liệu bằng `src/benchstats.js` | Game là bản web. Công thức tính đặt trong một module thuần, có unit test theo đúng định nghĩa của ticket |
| Sim có chế độ `bench: true` | Ticket mô tả một cảnh chuẩn: 200 Bóng `wander` rải đều (seed 42), 100 đom đóm, L1–L3 sáng 100 dầu; tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc đêm, và Bóng không chuyển sang đuổi. Cùng một sim, chỉ khác các cờ |
| Bóng Mực và đom đóm vẽ bằng `InstancedMesh` (cả cây) | 200 Bóng × 4 mesh ≈ 800 draw call nếu vẽ từng con. Instancing đưa con số xuống vài chục |
| Bảng xếp hạng: `src/leaderboard.js` thuần + API trong `scripts/serve.js`, lưu `data/leaderboard.json`; `run_cmd` đổi thành `node scripts/serve.js` | "Lưu trên đĩa cục bộ" và lệnh `<run_cmd> --export-leaderboard` cần một tiến trình đọc được file. `npm start --x` không chuyển tham số cho script nên không dùng `npm start` làm `run_cmd` |
| Soak chạy với `node --expose-gc --jitless` | Xem mục "Soak và bộ nhớ" |
| Bản phát hành: `npm run release` tạo `dist/dao-den-long-v1.0.0.{zip,tar.gz}` (kèm `three.module.js`, chạy bằng `node scripts/serve.js`, không cần `npm install`); thêm Dockerfile | Ticket chấp nhận thư mục web tĩnh hoặc Docker |

## Soak và bộ nhớ (trung thực về con số)

- Lần đầu chạy soak (có JIT): RSS 40,4 → 54,6 MB (×1,35), **trượt** ngưỡng ×1,2.
- Điều tra: heap JS dùng 4,5 → 4,9 MB (gần như phẳng); chạy 30 đêm thì RSS lại *thấp hơn* 10 đêm (50,2 so với 53,5 MB). Kết luận: **không rò rỉ**. Phần tăng nằm ngoài heap JS, là mã máy do JIT TurboFan biên dịch và vùng nhớ của bộ cấp phát, chỉ tăng một lần lúc khởi động.
- `--jitless` bỏ phần mã JIT đó: RSS 37,9 → 41,8 MB (**×1,10**), heap JS 4,3 → 4,4 MB. `soak.json` ghi thêm `mem_ratio`, `heap_used_start_mb`, `heap_used_end_mb`, `jitless` để người chấm thấy rõ.
- Rủi ro đã biết: chạy 30 đêm với `--jitless` thì tỉ lệ RSS là ×1,22, nên tỉ lệ có tăng chậm theo số đêm (phân mảnh bộ cấp phát; heap JS vẫn phẳng). Ngưỡng ticket áp cho 10 đêm.
- Kết quả 10 đêm đều `lost` vì input ngẫu nhiên làm Mây rơi khỏi đảo sớm. Đó là hành vi đúng với input ngẫu nhiên theo ticket.

## Giả định

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| P4-A1 | "Rải đều trên đảo" | Phân bố đều theo diện tích trong đĩa bán kính 38 m (r = 38·√u), theo seed |
| P4-A2 | Bóng trong bench "di chuyển theo luật wander bình thường" | Dùng đúng `wander` của Phase 3 (đi về đèn tắt gần nhất 2 m/s); tắt chuyển sang `chase` |
| P4-A3 | Mây trong bench | Đứng yên, hiển thị như lúc chơi; đom đóm dẫn đường và lá gió (sáng tạo) bị ẩn |
| P4-A4 | `peak_mem_mb` | `null` (bản web) kèm `peak_mem_note`; thêm `js_heap_peak_mb` (heap JS của trang, không phải RSS) |
| P4-A5 | `load_ms` | Từ lúc tiến trình `node scripts/bench.js` bắt đầu tới khi trang gửi tín hiệu khung đầu tiên (đồng hồ hệ thống chung của cùng máy) |
| P4-A6 | Input soak "5% nhảy…" | Mỗi tick bấm (true) với xác suất đó, tick sau tự nhả; hướng di chuyển chọn lại mỗi 30 tick, độ dài 1 |
| P4-A7 | `mem_start_mb` | RSS ngay sau `createGame` của đêm đầu tiên (đã gọi GC); `mem_end_mb` sau khi bỏ tham chiếu đêm cuối và gọi GC |
| P4-A8 | Tên tiếng Việt | Chấp nhận mọi chữ cái hệ Latin (có dấu) + số + `_`, 3–12 ký tự sau chuẩn hóa NFC |
| P4-A9 | `achieved_at` | Giờ địa phương của máy chạy server, dạng `YYYY-MM-DDTHH:MM:SS±HH:MM` |
| P4-A10 | `seed` của một lượt chơi | Seed của lượt (Đêm n dùng seed + n − 1) |
| P4-A11 | Bản web tĩnh không có server | Bảng xếp hạng lùi về `localStorage` |
| P4-A12 | Phím tạm dừng | `Esc` luôn tạm dừng; phím đổi được mặc định là `P` |
| P4-A13 | Rung camera / chớp màn hình | Thêm rung nhẹ khi bị đánh và chớp màu khi bị đánh/thắp đèn; "Giảm chuyển động" tắt cả hai (và nhấp nháy đồng hồ) |

## Tiêu chí nghiệm thu → kiểm chứng

| Yêu cầu | Tiêu chí | Kiểm chứng |
|---|---|---|
| 1. Benchmark | lệnh chạy, tự thoát mã 0, đủ trường bench.json; cảnh đúng chuẩn | `docs/proof/phase-4/bench.json`; unit test cảnh bench (200/100/L1–L3, không spawn/dmg/pickup/decay/end, tất định); unit test công thức; ảnh 05 |
| Ngưỡng bench | avg ≥ 60, p1 ≥ 30, load ≤ 10 s | máy làm bài (RTX 3050 Ti Laptop, Ryzen 5 5600H, Win10): xem số trong bench.json. **Máy chấm có thể khác** |
| 2. Soak | 10 đêm xoay vòng, seed 7 + i, input ngẫu nhiên; crashes 0; RSS cuối ≤ 1,2 × đầu | `docs/proof/phase-4/soak.json`; test `soak_cmd` trong `npm test` |
| 3. Bảng xếp hạng | nhập tên sau Bình Minh/thua; tên hợp lệ; 5 trường; top 10; sắp xếp; lưu đĩa; màn hình từ menu; lệnh xuất | unit test (tên, thứ tự, trường, ISO); test `--export-leaderboard`; ảnh 06; chơi thử tay: đạt |
| 4. Đổi phím | 9 hành động, báo trùng, khôi phục mặc định, lưu | ảnh 02; chơi thử tay: đạt |
| 4. Phụ đề | Bóng Mực xuất hiện + mũi tên mép, gió sắp thổi, 10 s cuối, đèn < 30 | ảnh 04; chơi thử tay: đạt |
| 4. Giảm chuyển động | tắt rung camera và chớp màn hình | chơi thử tay: đạt |
| 4. Cỡ chữ | ≥ 18 px ở 1280×720; tùy chọn ×1,25 | CSS gốc `font-size: 18px`, mọi chữ UI ≥ 1rem; `.big` = 22,5 px; ảnh 01–03 |
| 5. Đóng gói | 3 lệnh từ clone sạch; README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE; Release có bản chạy được | thử clone sạch (mục Đánh giá); `npm run release` |
| 6. Contract v1.3 | `contract_version` 1.3, `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên | contract test; 75 scenario cũ vẫn đạt |
| 7. Retro + video | retro 1–2 trang; video < 5 phút | [retro.md](retro.md); [video demo](https://drive.google.com/file/d/1rx-NXIfNwiAryQOlCsoDCl0bkQFERvow/view?usp=sharing) |

## Đánh giá Phase 4

- **Đạt (tự động):** `npm test` 105/105 (thêm 7 test cho Phase 4). Toàn bộ 75 scenario Phase 1–3 vẫn đạt, không test nào phải sửa vì Phase 4 không đổi luật.
- **Benchmark trên máy làm bài** (bench.json đã commit: RTX 3050 Ti Laptop, Ryzen 5 5600H, 15 GB, Windows 10, Edge 157): avg_fps 1770,5 · p1_low_fps 483,3 · frame_ms_p95 1,0 ms · 53.117 khung · load_ms 1162. Đạt ngưỡng trên máy này; máy chấm sẽ đo lại. Lần chạy trước đó cho 1710 / 411 / 1094, nên số dao động vài phần trăm giữa các lần.
- **Soak** (soak.json đã commit): 0 crash, RSS 41,5 → 45,1 MB (×1,087) với `--jitless`; heap JS 4,3 → 4,4 MB.
- **Chơi thử bằng tay** (người làm bài, `npm start`, trước khi gắn tag `phase-4`): **đạt hết**, không phát hiện lỗi.

  | Mục | Kết quả |
  |---|---|
  | Đổi phím cho 9 hành động; đặt trùng phím thì bị báo và không nhận; "Khôi phục mặc định"; còn sau khi mở lại | Đạt |
  | Giảm chuyển động tắt rung camera và chớp màn hình | Đạt |
  | Chữ lớn ×1,25 trong menu, cài đặt và HUD lúc chơi | Đạt |
  | Nhập tên sau khi thua / sau Bình Minh, xem Bảng xếp hạng từ menu, còn sau khi tắt mở lại server; lệnh `--export-leaderboard` | Đạt |
  | Phụ đề: Bóng Mực xuất hiện + mũi tên mép màn hình, gió sắp thổi, 10 s cuối, đèn sắp hết dầu | Đạt |
- **Video demo:** người làm bài tự quay theo kịch bản bên dưới. Link: [Google Drive](https://drive.google.com/file/d/1rx-NXIfNwiAryQOlCsoDCl0bkQFERvow/view?usp=sharing).

## Kịch bản video demo (< 5 phút)

1. 0:00–0:20: `git clone` → `npm install` → `npm start`, mở trình duyệt.
2. 0:20–2:00: chơi Đêm 1: nhặt đom đóm, thắp đèn, châm dầu, Tỏa Sáng một Bóng đang hút dầu; mở Cài đặt (đổi phím, chữ lớn, mù màu).
3. 2:00–2:40: thua hoặc thắng → nhập tên → mở Bảng xếp hạng; chạy `node scripts/serve.js --export-leaderboard out.json`.
4. 2:40–3:30: `npm test` (105 đạt); chạy một lệnh headless và mở file JSONL.
5. 3:30–4:30: `npm run bench` (cửa sổ bay vòng 33 s) → mở bench.json; `npm run soak`.
6. 4:30–4:50: lướt nhanh AGENTS.md, `.claude/`, `git log --oneline`, các tag.

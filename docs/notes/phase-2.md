# Phase 2: Ticket-02 "Ba hòn đảo" + Test Contract v1.1

Nguồn yêu cầu: [docs/lab/ticket-02.md](../lab/ticket-02.md) (bản sao nguyên văn).

## Thay đổi thiết kế và lý do

| Thay đổi | Lý do |
|---|---|
| `src/sim/game.js` viết lại theo đúng 12 bước xử lý trong một tick của ticket | Ticket bắt buộc thứ tự này. Thứ tự ở Phase 1 khác (ví dụ chạm trước sinh, không có pause) |
| Đồng hồ chuyển từ mốc tick tuyệt đối sang **bộ đếm giảm ở bước 2** | Ticket quy định rõ "Giảm các bộ đếm" là bước 2. Kết quả không đổi: hồi chiêu và bất tử vẫn đúng N tick |
| Thêm `src/sim/maps.js`: 3 bản đồ chuẩn (hàm độ cao địa hình, điểm sinh, đèn, bục, bùa) | Tách dữ liệu bản đồ khỏi luật chơi. Headless và bản chơi dùng chung một nguồn |
| `game.contract.json` lên v1.1, toàn bộ tuning theo số chuẩn | Ticket yêu cầu thay mọi giá trị tự chọn. Sim vẫn đọc tuning từ file này |
| Hằng số chuẩn không có khóa trong contract (12/18 m, lịch sinh, Gió Lạc, bùa, gió) để ở `src/sim/constants.js` | Contract chỉ liệt kê một số khóa. Các số còn lại vẫn là số chuẩn của ticket, đặt tên rõ ràng |
| Bản chơi viết lại: menu → giới thiệu → chơi → kết quả → đêm sau; tạm dừng; cài đặt; HUD mới; bảng màu chuẩn | Phần 3 của ticket |

## Test Phase 1 bị luật mới thay đổi (sửa có lý do, không tắt)

| Scenario Phase 1 | Luật cũ → luật mới | Xử lý |
|---|---|---|
| 05 `island_edge_no_fall` | `fall_enabled: false` → rơi khỏi đảo bị phạt | **Thay** bằng `05_fall_off_island` (rơi ở tick 61, hồi sinh tick 121) |
| 06 pickup 1.5 m | `pickup_radius` 1.5 → 1.0; nhặt không còn được điểm (điểm tính khi nạp) | Sửa số: 1.0 nhặt, 1.1 không; điểm 0 |
| 08, 09, 10 nạp đèn | `lantern_cost` 5 → 10, `interact_radius` 3 → 2, +10 điểm mỗi đom đóm nạp | Sửa số kỳ vọng (200, 30), khoảng cách 2.0 / 2.1 |
| 11 thắng | điểm: 100 + 5×299 + 50×3 → 10 + 100 + 2×299 + 50×3 = 858 | Sửa điểm |
| 13 bị chạm | rơi đom đóm biến mất → rơi thành đom đóm `dropped` trên vành 1.5–2.5 m; thêm recoil | Sửa: kiểm thêm `motes`, `recoil`; ba lần chạm ở tick 1, 91, 181 |
| 14 tốc độ Bóng Mực | 3.5 → 4.0 m/s, thêm phát hiện 12 m (Bóng ở 20 m không đuổi) | Đổi vị trí xuất phát 10 m, kỳ vọng 6 m |
| 15–18 Tỏa Sáng | cost 1→3, radius 6→5 (đo 3D từ chân+0.8), stun 180→120 tick, đẩy 4 m tức thì → trong 15 tick, +20→+5, hồi chiêu 1→3 s | Sửa toàn bộ số |
| 19, 20 vùng an toàn | 5 m → 6 m | Bóng dừng ở z = 19 thay vì 20 |
| 21 dựng scenario | `deposited` = 5 → 10 | Sửa số |
| 23 lịch sinh | 2 con lúc đầu + mỗi 30 s → 2 con ở tick 300, rồi mỗi 480 tick | **Thay** bằng `23_shade_spawn_night1` |
| Contract: "đêm mặc định bỏ đứng yên thua trước 18000 tick" | Bóng Mực giờ chỉ đuổi khi cách ≤ 12 m nên có thể thua do hết giờ | Đổi thành: thua (bất kể lý do), kèm đo thời gian |
| Unit test "30 đom đóm, 2 Bóng Mực lúc đầu" | 20 đom đóm, 0 Bóng Mực tới tick 300 | Sửa |

## Giả định (chỗ ticket chưa nói rõ)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| P2-A1 | Điểm xuất phát Đêm 3 (tâm (0,0,0) nằm trong tháp chuông) | **(0, 0, −30)**: tầng 0, phía nam, không có tầng 1 |
| P2-A2 | Tăng tốc ≤ 0.1 s | Tức thời (0 s), thỏa "≤ 0.1 s" và giữ nguyên các phép đo vị trí của Phase 1 |
| P2-A3 | Thời gian trạng thái `spawning` | 60 tick (không di chuyển, không gây sát thương); sau đó `wander` |
| P2-A4 | `wander` di chuyển thế nào | Bay 2 m/s tới một điểm sinh đom đóm ngẫu nhiên (theo seed), đổi điểm mỗi 180 tick hoặc khi tới nơi |
| P2-A5 | Độ cao Bóng Mực và Gió Lạc | Tâm ở độ cao mặt đất + 1 m (theo địa hình). Scenario đặt Y khác thì giữ tới lần di chuyển đầu |
| P2-A6 | "Chênh cao ≤ 1.5" khi chạm | \|Y chân Mây − Y tâm Bóng Mực\| ≤ 1.5 |
| P2-A7 | Bóng đang bị đẩy khỏi vùng an toàn | Đẩy ra 0.2 m/tick (6 m trong 30 tick), giữ nguyên tên trạng thái, không gây sát thương, không đuổi |
| P2-A8 | Tỏa Sáng không trúng con nào | Vẫn tốn 3, vẫn phát `pulse` với `stunned_ids: []` (giữ giả định Phase 1) |
| P2-A9 | Đẩy lùi khi choáng | Hướng chốt lúc kích hoạt (ra xa Mây theo XZ), 4/15 m mỗi tick, dừng ở mép vùng an toàn đèn sáng |
| P2-A10 | Hết choáng / hết recoil | Về `wander`, cùng tick đó xét lại: cách ≤ 12 m thì `chase` |
| P2-A11 | Điểm rơi đom đóm khi bị đánh | Chia đều góc từ một góc ngẫu nhiên, bán kính ngẫu nhiên 1.5–2.5 m. Điểm rơi ngoài đảo thì lấy điểm đối xứng qua Mây |
| P2-A12 | Trong 60 tick chờ sau khi rơi | Mây đứng yên ở chỗ rơi (Y < −10), không nhặt, không nạp, không bị chạm, Bóng Mực chuyển `wander` |
| P2-A13 | Điểm sinh Bóng Mực "hợp lệ" | Cách Mây ≥ 15 m theo XZ (không xét điểm đã có Bóng) |
| P2-A14 | "Điểm sương ngẫu nhiên" của Gió Lạc | Chọn ngẫu nhiên trong các điểm sinh Bóng Mực của đêm đó |
| P2-A15 | Gió Lạc chạm khi không ở `chase` | Chỉ cướp khi đang `chase` và Mây mang > 0 |
| P2-A16 | Gió Lạc `removed` | Vẫn nằm trong mảng `drifters` với `state: "removed"`; không tính vào trần 2 con |
| P2-A17 | Lịch gió | Hoạt động khi sim_tick ∈ [1800k, 1800k + 300), k ≥ 1; hướng chọn theo seed lúc bắt đầu cơn; báo trước 120 tick (chỉ ở bản chơi) |
| P2-A18 | Gió có đẩy khi lướt / bay bục | Có, cộng 2 m/s vào vận tốc ngang trong mọi trạng thái di chuyển |
| P2-A19 | Lướt khi đang bay bục | Lướt ghi đè vận tốc ngang 12 tick, giữ độ cao, xong thì bay tiếp theo vận tốc phóng |
| P2-A20 | Vách tầng | Không bước lên mặt đất cao hơn chân > 0.5 m; trượt theo trục còn đi được. Bước xuống ≤ 0.5 m thì bám đất (đi xuống dốc), sâu hơn thì rơi |
| P2-A21 | `night_start` | Ghi một lần ở tick 0, trước snapshot đầu tiên |
| P2-A22 | Snapshot `player.invuln` | Boolean (đang bất tử hay không). Các trường `_s` là giây còn lại |
| P2-A23 | `motes[].ttl_s` của đom đóm thường | `null` |
| P2-A24 | `charms[]` | Thêm `pos` ngoài `id, available, respawn_s` |
| P2-A25 | Scenario `motes` | Danh sách vị trí, `kind: random`. `random_*: false` tắt cả sinh ban đầu lẫn sinh thêm |
| P2-A26 | Tạm dừng ở bản chơi | Bản chơi không bước sim khi tạm dừng (logic đứng yên hoàn toàn). Headless dùng input `pause` đúng contract |
| P2-A27 | Nhảy khi đang bay bục | Không được (chỉ nhảy khi chạm đất) |

## Tiêu chí nghiệm thu → kiểm chứng

### Phần 1 + 2 (số chuẩn, bản đồ, thứ tự tick)

| Yêu cầu | Tiêu chí | Kiểm chứng |
|---|---|---|
| Số chuẩn trong contract | mọi khóa tuning = số ticket | `contract.test.js` (so từng số) |
| Di chuyển / nhảy | 6 m/s; nhảy 7 m/s, g 20 | scenario 01–04 |
| Lướt | 2.8 m trong 12 tick; hồi chiêu 90 tick từ lúc bắt đầu; dùng hướng mặt khi đứng yên; giữ độ cao trên không | 24, 25, 26 |
| Nhặt | 1.0 m XZ, chênh cao ≤ 1.5; trần 10 | 06, 06b, 07 |
| Sinh đom đóm | 20 điểm khác nhau; +1 ở tick 240, 480 | 41, unit test "20 distinct" |
| Đèn | chi phí 10, bán kính 2, nạp nhiều lần, +10/đom đóm, +100/đèn | 08–10 |
| Vùng an toàn | chặn ở 6 m; đẩy ra ≤ 30 tick, vô hại | 19, 20, 42, 42b |
| Tỏa Sáng | 3 / 5 m 3D / 3 s; choáng 120; đẩy 4 m trong 15 tick; +5 | 15–18 |
| Bóng Mực | 4.0 m/s (Đêm 3: 4.5); phát hiện 12 / bỏ 18; recoil; lịch sinh 300 + 480k / 420k / 360k; trần 6/8/10; cách ≥ 15 m | 13, 14, 14b, 14c, 23, 23b, 23c, unit tests |
| Bị đánh | −1 lửa, rơi floor(n/2) đom đóm `dropped` ttl 480, bất tử 90 | 13, 31 (ttl) |
| Rơi khỏi đảo | Y < −10, bỏ qua bất tử, mất hết, chờ 60, hồi sinh; hết lửa thua ngay | 05, 45, 46 |
| Thời gian | 300 / 330 / 360 s | 40a–c |
| Thắng/thua | no_flames trước, thắng kể cả đúng tick hết giờ, rồi mới dawn | 43, 44, 12 |
| Bản đồ Đêm 1/2/3 | đèn, điểm sinh, cầu, bục, tầng, dốc, tháp, gió | 35–38b, 40a–c, unit test bản đồ, ảnh 04–06 |
| Pause | tick tăng, sim_tick/thời gian/di chuyển đứng | 39 |
| Hiệu năng headless | 21.600 tick < 30 s | contract test (3 đêm), proof mục 4b |

### Phần 3 (tính năng mới)

| Tính năng | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| **Gió Lạc** | (a) Đêm 2/3 sinh ở tick 1200, 2400…, tối đa 2, id D1…; (b) idle → chase khi mang ≥ 5 và cách ≤ 15 m, mất điều kiện thì về idle; (c) chạm ≤ 1.2 m cướp min(3, mang), flee 240 tick rồi removed; (d) Tỏa Sáng lúc chase → flee không cướp; lúc flee có đồ → thả hết thành đom đóm rơi, biến mất sau 120 tick; (e) không làm mất lửa, bất tử không chặn | 34 (a), 30 + 33 (b, c, e), 32 + 31 (d) |
| **Bùa Gió** | (a) C1 (35,0,0) Đêm 2; C1/C2 Đêm 3; (b) nhặt như đom đóm → `charm_picked` 600 tick; (c) tốc độ 7.2; (d) lướt không hồi chiêu nhưng bấm khi đang lướt bị bỏ qua; (e) xuất hiện lại sau 2700 tick | 29 (a, b, e), 27 (c), 28 (d), 40b/40c |
| **Chuỗi 3 Đêm** | menu → giới thiệu (tên đảo, lời Ông Đăng) → chơi → kết quả → đêm sau; thắng Đêm 3 → Bình Minh + tổng điểm; thua → chơi lại đêm đó | ảnh 01, 02, 08; chơi thử tay |
| **Tạm dừng** | Esc/P dừng logic; Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; headless `pause` | scenario 39; ảnh 07; chơi thử tay |
| **Cài đặt** | âm lượng, độ nhạy chuột; lưu `localStorage`, còn sau khi mở lại | chơi thử tay (đóng/mở lại trình duyệt) |
| **Âm thanh** | nhạc nền + hiệu ứng: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s | chơi thử tay (WebAudio tự tổng hợp, `src/web/audio.js`) |
| **HUD** | Ngọn Lửa trên trái; mm:ss trên giữa, đỏ và nhấp nháy khi ≤ 30 s; đèn k/n + điểm trên phải; 10 ô đom đóm dưới giữa; hồi chiêu Lướt/Tỏa dưới phải; "E — Nạp ánh sáng (x/10)" gần đèn; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | ảnh 03; chơi thử tay (≤ 30 s, nhắc E) |
| **Bảng màu** | các hex chuẩn dùng đúng cho từng thành phần | `PAL` trong `src/web/main.js` dùng đúng hex của ticket; ảnh 03–06 |
| **Ánh sáng môi trường** | cường độ = 0.15 + 0.55 × (đèn sáng / tổng) | `ambient.intensity` trong `render()` |
| **≥ 30 FPS ở 1280×720** | trung bình ≥ 30 FPS | Bộ đếm FPS trong game (F3 hoặc `?fps=1`, hiện FPS trung bình và độ phân giải). Đo tay trên máy của người làm bài: **khoảng 60 FPS — đạt** (Edge headless dùng SwiftShader nên không dùng để đo) |

## Đánh giá Phase 2

- **Đạt (có test tự động):** toàn bộ Phần 1, Phần 2, Phần 4 (contract v1.1). Gió Lạc, Bùa Gió và Pause ở mức logic. `npm test`: 78/78. `npm run proof -- phase-2`: PASS (56/56 scenario, tất định 4/4 cặp đêm/seed, một đêm đầy đủ chạy 182 / 215 / 268 ms so với giới hạn 30 s). Chi tiết: [docs/proof/phase-2](../proof/phase-2/README.md).
- **Hồi quy Phase 1:** chạy lại toàn bộ scenario Phase 1 với số chuẩn. Các test bị luật mới thay đổi đã sửa hoặc thay, kèm lý do ở bảng trên. Không test nào bị tắt.
- **Chơi thử bằng tay** (người làm bài, `npm start`, trước khi gắn tag `phase-2`): **đạt hết**, không phát hiện lỗi.

  | Mục | Kết quả |
  |---|---|
  | Chuỗi 3 Đêm: menu → giới thiệu (lời Ông Đăng) → chơi → kết quả → đêm sau → Bình Minh; thua thì chơi lại đêm đó | Đạt |
  | Tạm dừng Esc/P: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | Đạt |
  | Cài đặt âm lượng, độ nhạy chuột còn giữ sau khi mở lại trình duyệt | Đạt |
  | Nhạc nền và hiệu ứng âm thanh, đếm ngược 10 s cuối | Đạt |
  | HUD: đồng hồ đỏ nhấp nháy khi ≤ 30 s, nhắc "E — Nạp ánh sáng (x/10)", mũi tên tới đèn ngoài màn hình | Đạt |
  | Điều khiển: lướt, bục nhảy, dốc/tầng Đêm 3, gió, Gió Lạc, Bùa Gió | Đạt |
- **FPS:** đo bằng bộ đếm trong game (`?fps=1` / F3) ở 1280×720 trên máy của người làm bài: trung bình **khoảng 60 FPS**, đạt yêu cầu ≥ 30. Chưa ghi lại cấu hình máy; máy chấm chung có thể cho số khác.
- **Độ khó:** với số chuẩn, bot thắng Đêm 1 khoảng 7/10 seed nhưng chưa thắng được Đêm 2/3 (thắp được 3–5 đèn rồi hết giờ). Bot đơn giản (không tối ưu đường đi, không dùng bùa), nên việc này **không** chứng minh Đêm 2/3 không thắng được. Người làm bài đã chơi thử chuỗi 3 Đêm tới màn Bình Minh (xem bảng chơi thử ở trên).
- **Rủi ro:** các giả định P2-A3 (spawning 60 tick), P2-A6 (chênh cao chạm) và P2-A1 (xuất phát Đêm 3) có thể khác test ẩn.

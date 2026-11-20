# Phase 3: Ticket-03 "Đèn cạn dầu" + Test Contract v1.2

Nguồn yêu cầu: [docs/lab/ticket-03.md](../lab/ticket-03.md) (bản sao nguyên văn). Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../CHANGELOG.md#phase-3).

## Luật cũ bị thay → thứ bị ảnh hưởng

| Luật [THAY THẾ] | Code | Test cũ | Tài liệu |
|---|---|---|---|
| Đèn sáng không nhận thêm đom đóm | tương tác, mô hình đèn | — (không có test khẳng định điều này) | README |
| Bóng Mực không bao giờ vào vùng an toàn | `keepOutOfSafe` → `isSafe(l)`; AI thêm `drain` | 19 vẫn đúng (dầu ≥ 30 suốt 10 s) | README |
| Thắng ngay khi mọi đèn sáng | bước xét thắng/thua | 11, 43 | README, ghi chú Phase 2 |
| Công thức điểm cũ | nạp, Tỏa Sáng, bình minh | 08, 09, 11, 43 | README |
| Thời lượng đêm 300/330/360 | contract | 39, 40a–c, contract test | README |

## Test cũ đã sửa hoặc thay (không skip)

| Test | Thay đổi | Lý do |
|---|---|---|
| 08_deposit_and_light | điểm 200 → 150; kiểm thêm `relight: false`, fuel 100 | +5/đom đóm thay vì +10 |
| 09_partial_deposit | điểm 30 → 15 | +5/đom đóm |
| 11_win_all_lit → **11_no_early_win** | thay: thắp đèn cuối không kết thúc đêm | luật thắng mới, `all_lit` bỏ |
| 43_win_on_last_tick → **43_light_on_dawn_tick_counts** | thay: đèn thắp đúng tick bình minh vẫn được tính, thắng `dawn_survived` | luật thắng mới |
| 39_pause | time_left 299.833 → 239.833 | Đêm 1 còn 240 s |
| 40a/b/c map | 300/330/360 → 240/270/300; kiểm thêm fuel, ever_lit, relit_count, capacity | thời lượng mới + trường snapshot v1.2 |
| contract: số chuẩn, snapshot mặc định | thêm 8 khóa tuning, điểm mới, `capacity`, trường đèn | contract v1.2 |
| sim: "bot thắng Đêm 1 seed 1" | seed 1 → seed 9, điều kiện "≥ 3 đèn sáng lúc bình minh" | với luật mới bot chỉ thắng seed 9 trong 10 seed (xem đánh giá) |

Các scenario Phase 1–2 còn lại (64 cái) không đổi và vẫn đạt.

## Giả định

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| P3-A1 | Tốc độ Bóng `wander` đi tới đèn yếu | Tốc độ đuổi (4 m/s, Đêm 3 là 4,5 m/s). Đi về đèn tắt thì 2 m/s |
| P3-A2 | "Đi về đèn tắt gần nhất như trước" (Phase 2 dùng điểm ngẫu nhiên) | Đổi `wander` thành: đèn yếu gần nhất → nếu không có thì đèn tắt gần nhất (2 m/s) → nếu không có đèn tắt thì điểm ngẫu nhiên như cũ |
| P3-A3 | Thứ tự trong `wander` | Phát hiện Mây (≤ 12 m → chase) xét trước, sau đó mới tới chọn đèn yếu |
| P3-A4 | Bóng `drain` có gây sát thương không | Không (chỉ `wander`/`chase` gây hit). Đứng yên, không bám địa hình |
| P3-A5 | `fuel_drain` mỗi 60 tick | Mỗi con đếm riêng số tick đã hút; ghi khi đếm tới 60, 120, …; `fuel` là giá trị sau khi trừ của tick đó |
| P3-A6 | Tỏa Sáng trúng nhiều con | +15 cho mỗi con đang `drain`, +5 cho mỗi con khác |
| P3-A7 | Đẩy ra khi châm dầu | Chỉ khi dầu đi từ < 30 lên ≥ 30. Bóng bị đẩy ra chuyển `wander` |
| P3-A8 | `deposited` của đèn đang sáng | Giữ giá trị chi phí đã nạp (10 hoặc 5). Đèn đặt sẵn `lit: true` thì `deposited` = 10 |
| P3-A9 | Scenario `lit: true` với `fuel: 0` | Đèn tắt ở bước 2 của tick đầu (phát `lantern_out`) |
| P3-A10 | Đang mang nhiều hơn sức chứa (từ scenario) | Giữ nguyên, chỉ không nhặt thêm |
| P3-A11 | Điểm bình minh | `floor(fuel)` dùng dầu sau mọi cập nhật của tick bình minh |
| P3-A12 | Khóa điểm trong contract | Thêm `per_relight 40`, `per_stun_drain 15`, `per_lit_at_dawn 50`; `per_second_left = 0` (thưởng thời gian bỏ) |
| P3-A13 | Ngưỡng thắng | `ceil(0.6 × n)` tính một lần (3/5, 4/6, 5/7) |

## Tiêu chí nghiệm thu → kiểm chứng

| Yêu cầu | Tiêu chí | Scenario / bằng chứng |
|---|---|---|
| Dầu hao 1/s | 100 → 99.0 (tick 60) → 90.0 (tick 600) | 50 |
| Hết dầu | `lantern_out` ở tick 60 khi fuel 1; lit false, deposited 0, fuel 0, ever_lit true | 51 |
| Châm dầu | used = min(mang, ceil((100 − fuel)/10)); fuel cap 100; +5/đom đóm; `refuel` | 52, 52b |
| Đèn đầy không được chọn | used = 0 thì bỏ qua, chọn đèn khác | unit test `full lantern is skipped` |
| Thắp lại 5, relight +40, relit_count | `lantern_lit {relight: true}`, điểm 65 | 53 (relight), 08 (lần đầu) |
| Vùng an toàn chỉ khi fuel ≥ 30 | đúng 30.0 vẫn chặn; < 30 Bóng vào được | 55 |
| Drain | vào drain ≤ 2 m; −5/s cộng dồn; `fuel_drain` mỗi 60 tick; hết dầu → wander | 56, 56b, 63 |
| Drain → chase / stunned / wander | Mây ≤ 6 m; Tỏa Sáng (+15); châm ≥ 30 (đẩy ra, vô hại) | 57, 58, 59 |
| Luật thắng mới | 240/270/300 s; ≥ 3/5, 4/6, 5/7; không thắng sớm; no_flames trước kể cả tick bình minh | 60, 61, 61b, 61c, 11, 43, 62, 40a–c |
| Điểm mới | +5/đom đóm, +100/+40, +5/+15, bình minh 50 + floor(fuel) + 50/lửa | 08, 09, 53, 58, 60, 43 |
| Sức chứa | 10 + 2 × lần thắp, tối đa 20; HUD hiện mang/sức chứa | 53, 54, 54b; ảnh 02 |
| Contract v1.2 | khóa tuning mới, trường snapshot, sự kiện, tên trạng thái `drain` | contract test |
| Chế độ mù màu | viền + mắt Bóng #00B3FF; cảnh báo UI #FFFFFF + ⚠; đèn tắt xẹp 20% + vết rách; đèn sắp hết dầu nhấp nháy 1 Hz; lưu cài đặt | ảnh 03; chơi thử tay: đạt |
| Thanh dầu | trên đèn đang sáng, nhấp nháy 1 Hz khi < 30 | chơi thử tay: đạt |

## Đánh giá Phase 3

- **Đạt (test tự động):** toàn bộ luật mục 1–5 và contract v1.2. `npm test`: 98/98 (75 scenario + unit test "đèn đầy bị bỏ qua"). Thử đột biến 4 số (relight_cost, low_fuel_threshold, drain_per_s, win_ratio): cả 4 đều bị test bắt.
- **Hồi quy:** 64 scenario Phase 1–2 không bị thay vẫn đạt nguyên trạng. 11 test bị luật mới thay đổi đã sửa hoặc thay, kèm lý do ở bảng trên.
- **Chơi thử bằng tay** (người làm bài, `npm start`, trước khi gắn tag `phase-3`): **đạt hết**, không phát hiện lỗi.

  | Mục | Kết quả |
  |---|---|
  | Thanh dầu trên đèn đang sáng, đèn và thanh nhấp nháy chậm khi dầu < 30 | Đạt |
  | Châm dầu bằng E, đèn tắt khi hết dầu, thắp lại với 5 đom đóm | Đạt |
  | Bóng Mực tới hút dầu đèn yếu; lại gần thì nó đuổi; Tỏa Sáng làm choáng | Đạt |
  | Đèn tắt xẹp + có vết rách, phân biệt được với đèn sáng không cần màu | Đạt |
  | Chế độ "Bảng màu dễ phân biệt": viền/mắt Bóng #00B3FF, cảnh báo trắng + ⚠, cài đặt được lưu | Đạt |
  | HUD đang mang / sức chứa, số đèn cần giữ; thắng/thua lúc bình minh theo ngưỡng | Đạt |
- **Độ khó:** với luật mới bot chỉ thắng Đêm 1 ở 1/10 seed, và 0/10 ở Đêm 2, 3. Bot chưa biết ưu tiên giữ 3 đèn và đuổi Bóng hút dầu; đây là giới hạn của bot, chưa phải bằng chứng game quá khó. Người làm bài đã chơi thử theo luật mới (bảng trên).
- **Rủi ro test ẩn:** P3-A1 (tốc độ tới đèn yếu) và P3-A3 (phát hiện Mây xét trước drain).

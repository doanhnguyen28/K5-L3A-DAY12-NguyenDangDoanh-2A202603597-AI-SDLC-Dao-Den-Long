# Phase 1: PRD-0 + Test Contract v1.0

## Quyết định kiến trúc

| Quyết định | Lý do |
|---|---|
| JavaScript: logic ở `src/sim/`, hiển thị Three.js ở `src/web/` | Một mã logic cho cả headless và bản chơi, không cần GPU khi chấm; chạy trên macOS/Linux chỉ cần Node |
| `game.contract.json` là nguồn tuning duy nhất, sim đọc trực tiếp | Không thể khai báo một số mà game dùng số khác (lỗi "khai sai làm trượt test") |
| Đồng hồ bằng mốc tick tuyệt đối (`stunUntil`, `invulnUntil`, `pulseReadyAt`) | Tránh lệch 1 tick khi đếm ngược; thời lượng = đúng N tick |
| RNG mulberry32 có seed, không dùng `Math.random`/`Date` trong sim | Tính tất định theo `--seed` |
| Scenario test chạy qua CLI thật, kỳ vọng tính tay | Kiểm tra đúng thứ giảng viên chạy; tránh test "luôn đạt" |

## Giả định (chỗ PRD-0 / contract chưa nói rõ)

| # | Chỗ mơ hồ | Giả định của tôi |
|---|---|---|
| A1 | Hình dạng đảo | Đĩa tròn bán kính 40 m, tâm (0,0,0). 5 đèn trên vòng 25 m, L1 ở (0,0,25), các đèn sau cách nhau 72°: L2 (23.776, 0, 7.725), L3 (14.695, 0, −20.225), L4 (−14.695, 0, −20.225), L5 (−23.776, 0, 7.725) |
| A2 | Rơi khỏi đảo | Không có: người chơi bị chặn ở mép (`fall_enabled: false`), không có sự kiện `by: "fall"` |
| A3 | "Ánh sáng" tốn khi tỏa sáng | Là đom đóm đang mang: tỏa sáng tốn `pulse_cost = 1`. Mang ít hơn 1 thì bấm không có tác dụng, không phát sự kiện `pulse` |
| A4 | Tỏa sáng không trúng con nào | Vẫn tốn 1 đom đóm, vẫn phát `pulse` với `stunned_ids: []` |
| A5 | Bán kính an toàn | Chỉ áp dụng cho **đèn đã thắp** ("Bóng Mực sợ những chiếc đèn" hiểu là đèn sáng). Bóng Mực đi vào trong vòng 5 m bị đẩy ra đúng mép vòng |
| A6 | Đom đóm rơi khi bị chạm | `floor(carried × 0.5)`, các đom đóm rơi biến mất (không rơi lại xuống đất) |
| A7 | Nhiều Bóng Mực chạm cùng lúc | Chỉ tính 1 lần chạm, sau đó bất tử 1,5 s (90 tick) |
| A8 | Bóng Mực bị choáng | Không di chuyển, không gây sát thương; hết choáng thì đuổi tiếp. Bị tỏa sáng lại khi đang choáng thì tính lại 3 s và vẫn cộng điểm |
| A9 | Nạp đèn | Bấm interact: nạp vào đèn **chưa thắp** gần nhất trong 3 m, lượng = `min(carried, 5 − deposited)`. Không mang gì thì không có sự kiện |
| A10 | Nhặt đom đóm | Tự động khi trong 1,5 m (không cần bấm). Nhiều con cùng lúc thì nhặt theo khoảng cách, mỗi con một sự kiện, dừng khi đầy 10 |
| A11 | Thua do hết giờ | Hết `night1_duration_s = 300` giây (hoặc `time_left_s` của scenario) mà chưa thắp đủ thì thua, lý do `dawn` |
| A12 | Điểm thưởng khi thắng | `per_second_left × floor(time_left_s)` + `per_flame_left × flames`, chỉ cộng khi thắng |
| A13 | Thứ tự trong một bước | input → di chuyển/nhảy → nhặt → nạp → tỏa sáng → Bóng Mực di chuyển → kiểm tra chạm → sinh thêm → tick+1 → kiểm tra thắng/hết lửa/hết giờ (theo thứ tự đó) |
| A14 | Sinh ngẫu nhiên | 30 đom đóm lúc đầu (cách tâm 3–38 m), sinh lại 1 con mỗi 2 s nếu dưới 30. 2 Bóng Mực lúc đầu ở vòng 36 m, thêm 1 con mỗi 30 s (tối đa 6), phát `shade_spawned`. Sinh ban đầu là một phần của bước dựng nên không phát sự kiện |
| A15 | Scenario `random_motes: true` kèm `motes` | `motes` thay danh sách ban đầu, việc sinh lại vẫn chạy. `random_*: false` tắt cả sinh ban đầu lẫn sinh lại |
| A16 | `id` của Bóng Mực trong scenario | Con không có id nhận `S<n>` nhỏ nhất chưa bị dùng (tránh trùng id đã cho) |
| A17 | Scenario đèn có `deposited ≥ 5` | Coi là đã thắp (không phát sự kiện, không cộng điểm). `lit: true` thì `deposited` = 5 |
| A18 | Độ cao Bóng Mực | Giữ nguyên Y được cho (mặc định 1 m, lơ lửng). Mọi khoảng cách chỉ đo trên mặt XZ, nên nhảy không né được Bóng Mực |
| A19 | Snapshot cuối | Chỉ ghi snapshot ở các tick là bội của `--snapshot-every` (đúng contract). Trạng thái cuối nằm ở dòng `end` |
| A20 | `move` ngoài [−1, 1] hoặc tick không tăng | File sai định dạng, thoát mã 2 |
| A21 | Nhảy | Vận tốc 7 m/s, trọng lực 20 m/s², chỉ nhảy khi đang chạm đất |

## Tiêu chí nghiệm thu → kiểm chứng

| Yêu cầu (PRD-0 / Contract) | Tiêu chí kiểm tra được | Kiểm chứng |
|---|---|---|
| R1 Đi lại, nhảy, camera 3D | move [0,1] trong 60 tick → (0,0,6); [1,1] được chuẩn hóa; yaw 90° xoay hướng; nhảy rời đất rồi chạm đất; không rơi khỏi đảo | scenario 01–05, ảnh 02 |
| R2 Đom đóm nhặt được | nhặt ở 1,5 m, không nhặt ở 1,6 m; không vượt quá 10 | scenario 06–07 |
| R3 Nạp ánh sáng thắp đèn | nạp trong 3 m, đủ 5 thì `lantern_lit` +100; nạp một phần; 3,1 m thì không | scenario 08–10, test "chỉ kích hoạt khi chuyển từ false sang true" |
| R4 Bóng Mực xuất hiện, đuổi theo | đuổi với 3,5 m/s; chạm thì mất lửa, rơi đom đóm, bất tử 90 tick; vùng an toàn 5 m quanh đèn sáng; sinh thêm mỗi 30 s | scenario 13, 14, 19, 20, 23 |
| R5 Tỏa sáng xua Bóng Mực | tốn 1, choáng đúng 180 tick, đẩy 4 m, +20; cần có ánh sáng; bán kính 6 m; hồi chiêu 60 tick | scenario 15–18 |
| R6 Thắng / thua / điểm | thắng `all_lit` với điểm 1745 tính tay; thua `dawn` ở tick 60 với `time_left_s` = 1; thua `no_flames` sau 3 lần chạm | scenario 11, 12, 13 |
| R7 HUD | hiển thị lửa, đom đóm mang theo, số đèn đã thắp, thời gian, điểm, thanh tỏa sáng | ảnh 02, 03; chơi thử tay |
| R8 Chơi lại | nút / phím R sau khi thắng hoặc thua | ảnh 04 (màn thắng có nút chơi lại); chơi thử tay: đạt |
| R9 Đêm 1 chơi được từ đầu tới thắng | bot dùng đúng input người chơi thắng 10/10 seed | proof mục 4, test bot |
| C-A `game.contract.json` | đủ các trường, số khớp với game | test contract + sim đọc file đó |
| C-B Tham số, mã thoát, mô hình tick | snapshot 0,10,…; dòng `end` ở cuối; mã 2 / khác 0 | tests/contract.test.js |
| C-C/D Inputs, scenario | giữ giá trị cũ, chỉ kích hoạt khi chuyển false→true, dựng scenario không có điểm, id | tests/sim.test.js, scenario 21–22 |
| C-E Tính tất định, làm tròn 3 chữ số | cùng seed thì giống từng byte, khác seed thì khác; không có số > 3 chữ số thập phân | contract test + proof mục 3 |
| Phong cách | nón lá + đèn nhỏ, vàng cam = tốt, tím đen = nguy hiểm, đảo sáng dần | ảnh 02–04 (kiểm bằng mắt) |

## Đánh giá Phase 1

- **Đạt:** R1–R9, toàn bộ contract A–E. `npm test`: 39/39 đạt. `npm run proof -- phase-1`: PASS (23/23 scenario, tất định 3/3 seed, bot thắng 10/10).
- **Chơi thử bằng tay** (người làm bài, `npm start` trên trình duyệt, trước khi gắn tag `phase-1`): **đạt hết**, không phát hiện lỗi.

  | Mục | Kết quả |
  |---|---|
  | WASD di chuyển theo hướng camera, Space nhảy | Đạt |
  | E nạp đom đóm vào đèn, đèn sáng khi đủ 5 | Đạt |
  | F / chuột trái tỏa sáng, Bóng Mực bị choáng và đẩy lùi | Đạt |
  | Kéo chuột, ← → xoay camera | Đạt |
  | HUD cập nhật (lửa, đom đóm, đèn, thời gian, điểm, thanh tỏa sáng) | Đạt |
  | Thắng / thua hiện màn kết thúc, R hoặc nút chơi lại | Đạt |
  | Âm thanh, phím M tắt/bật | Đạt |

- **Giới hạn kiểm chứng:** điều khiển, camera, chơi lại và âm thanh chỉ được kiểm bằng chơi thử tay, chưa có test tự động.
- **Rủi ro đã biết:** bot thắng mà không mất lửa nào, nên game khá dễ với người chơi giỏi (Bóng Mực 3,5 m/s, chậm hơn Mây 6 m/s). Chưa đổi để giữ số tuning ổn định giữa các phase; sẽ cân nhắc khi có ticket.
- **AI sai ở đâu / chỉnh harness:** xem [ai-log.md](ai-log.md).

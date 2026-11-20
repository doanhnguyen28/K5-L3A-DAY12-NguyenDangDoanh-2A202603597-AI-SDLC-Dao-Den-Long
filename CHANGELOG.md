# Changelog

## phase-3

### Breaking changes (Test Contract v1.1 → v1.2)
- `contract_version` "1.2"; thời lượng đêm 300/330/360 → **240/270/300 s**.
- **Không còn thắng sớm.** `game_over.reason` `all_lit` bị bỏ; thắng chỉ có `dawn_survived` (còn sống lúc bình minh và ≥ ceil(0.6 × tổng đèn) đèn sáng).
- **Đèn có thể tắt:** dầu hao 1/s, `lantern_out` khi hết; đèn sáng nhận đom đóm để châm dầu (`refuel`) thay vì bỏ qua.
- **Vùng an toàn chỉ khi fuel ≥ 30** (trước: mọi đèn sáng).
- Bóng Mực có trạng thái mới `drain`; `wander` giờ đi tới đèn yếu / đèn tắt thay vì điểm ngẫu nhiên.
- **Điểm thay toàn bộ:** +5/đom đóm nạp (trước +10), +100 thắp lần đầu, +40 thắp lại, +5/+15 Tỏa Sáng, bình minh 50 + floor(fuel) mỗi đèn + 50/lửa; bỏ thưởng thời gian.
- Sức chứa không cố định 10 nữa: 10 + 2 × lần thắp, tối đa 20.
- Snapshot: đèn thêm `fuel`, `ever_lit`, `relit_count`; `player.capacity`. Sự kiện mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.
- Scenario: đèn nhận `fuel`, `ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`.

### Khác
- Bản chơi: thanh dầu trên đèn (nhấp nháy 1 Hz khi < 30), HUD đang mang / sức chứa, mục tiêu đèn lúc bình minh, cài đặt "Bảng màu dễ phân biệt".
- ADR 0001; 97 test (75 scenario); 11 test cũ sửa/thay có lý do trong docs/notes/phase-3.md.

## phase-2
- Test Contract v1.1: số chuẩn, `--night 1|2|3`, snapshot/scenario/input/sự kiện mới, tên trạng thái Bóng Mực chuẩn.
- Sim viết lại theo thứ tự 12 bước/tick; 3 bản đồ chuẩn (Đảo Bến, Đảo Cau, Đảo Chuông); lướt, rơi khỏi đảo, đom đóm rơi, recoil, vùng an toàn đẩy ra, Gió Lạc, Bùa Gió, gió mạnh, bục nhảy, tầng/dốc/tháp, tạm dừng.
- Bản chơi: menu → giới thiệu đêm → chơi → kết quả → đêm sau → Bình Minh; tạm dừng; cài đặt lưu localStorage; HUD đầy đủ; bảng màu chuẩn; nhạc nền + hiệu ứng.
- 78 test (56 scenario). Scenario Phase 1 bị luật mới thay đổi được sửa kèm lý do trong docs/notes/phase-2.md.

## phase-1
- Đêm 1 (Đảo Bến): di chuyển, nhảy, camera góc nhìn thứ ba, đom đóm, nạp đèn, Bóng Mực, tỏa sáng, thắng/thua, điểm, HUD, chơi lại.
- Chế độ headless và `game.contract.json` theo Test Contract v1.0.
- 39 test (unit, contract, 23 scenario headless), CI, bộ proof tự động, hooks và skill verify.

# Changelog

## phase-2
- Test Contract v1.1: số chuẩn, `--night 1|2|3`, snapshot/scenario/input/sự kiện mới, tên trạng thái Bóng Mực chuẩn.
- Sim viết lại theo thứ tự 12 bước/tick; 3 bản đồ chuẩn (Đảo Bến, Đảo Cau, Đảo Chuông); lướt, rơi khỏi đảo, đom đóm rơi, recoil, vùng an toàn đẩy ra, Gió Lạc, Bùa Gió, gió mạnh, bục nhảy, tầng/dốc/tháp, tạm dừng.
- Bản chơi: menu → giới thiệu đêm → chơi → kết quả → đêm sau → Bình Minh; tạm dừng; cài đặt lưu localStorage; HUD đầy đủ; bảng màu chuẩn; nhạc nền + hiệu ứng.
- 78 test (56 scenario). Scenario Phase 1 bị luật mới thay đổi được sửa kèm lý do trong docs/notes/phase-2.md.

## phase-1
- Đêm 1 (Đảo Bến): di chuyển, nhảy, camera góc nhìn thứ ba, đom đóm, nạp đèn, Bóng Mực, tỏa sáng, thắng/thua, điểm, HUD, chơi lại.
- Chế độ headless và `game.contract.json` theo Test Contract v1.0.
- 39 test (unit, contract, 23 scenario headless), CI, bộ proof tự động, hooks và skill verify.

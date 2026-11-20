# ADR 0001 — Đèn có nhiên liệu và luật thắng "giữ sáng tới bình minh"

- Trạng thái: Chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu")
- Ngày: 2026-11-20

## Bối cảnh

Tới Phase 2, đèn là máy trạng thái một chiều: `tắt (deposited < cost) → sáng`, sáng là vĩnh viễn. Thắng ngay khi mọi đèn sáng (`all_lit`), điểm thưởng theo thời gian còn lại. Vùng an toàn 6 m của đèn sáng luôn chặn Bóng Mực. Ticket-03 yêu cầu đèn có thể tắt lại, Bóng Mực có thể hút dầu, và mục tiêu đổi thành sống sót tới bình minh với đủ số đèn sáng.

## Quyết định

### 1. Mô hình trạng thái đèn

```
          nạp đủ cost (10, hoặc 5 nếu ever_lit)
  TẮT ───────────────────────────────────────► SÁNG (fu = 6000)
   ▲  deposited tích lũy                          │ mỗi tick: fu -= 1 + 5 × số Bóng drain
   │                                              │ châm dầu: fu += 600 × used (tối đa 6000)
   └──────────── fu ≤ 0: lantern_out, deposited = 0, ever_lit giữ true ──┘
```

- Dầu lưu bằng **số nguyên đơn vị 1/60** (`fu`, tối đa 6000 = 100 dầu). Hao 1/s = 1 đơn vị/tick; hút 5/s = 5 đơn vị/tick/con; 1 đom đóm = 600 đơn vị. Không có sai số số thực. Chỉ làm tròn 1 chữ số thập phân khi xuất (`Math.round(fu/6)/10`).
- Thuộc tính mới: `fu`, `everLit`, `relitCount`. `deposited` vẫn là tiến độ thắp và về 0 khi tắt.
- "Có vùng an toàn" là trạng thái suy ra: `lit && fu ≥ 1800` (đúng 30 vẫn an toàn). Không lưu thành cờ riêng, nên không thể lệch với dầu.
- Hao và hút được trừ ở **bước 2** (cùng các bộ đếm khác). Ngay sau đó đèn hết dầu thì tắt và các Bóng đang hút đèn đó về `wander`.
- Tương tác: chọn đèn **nhận được** (chưa sáng, hoặc sáng mà `ceil((6000 − fu)/600) > 0`), gần nhất, bằng nhau thì id nhỏ hơn. Đèn đang sáng thì châm dầu (`refuel`), đèn tắt thì nạp/thắp như trước nhưng chi phí phụ thuộc `everLit`.
- Bóng Mực thêm trạng thái `drain`, vào khi đang `wander` và cách đèn yếu (fu < 1800) gần nhất ≤ 2 m. Ra: `chase` (Mây ≤ 6 m), `stunned` (Tỏa Sáng), `wander` (đèn tắt, được châm ≥ 30, hoặc > 2 m). Châm qua ngưỡng 30 dùng lại cơ chế đẩy ra 30 tick sẵn có của lúc vừa thắp.

### 2. Luật thắng

- Bỏ thắng sớm. Kết quả chỉ được xét ở bước cuối mỗi tick theo thứ tự cố định: (1) hết Ngọn Lửa → `no_flames` (kể cả tick bình minh); (2) hết giờ → đếm đèn đang sáng sau mọi cập nhật của tick: ≥ `ceil(0.6 × tổng)` → `dawn_survived`, ngược lại `dawn`.
- Ngưỡng tính một lần lúc tạo đêm: `ceil(win_ratio × n − 1e-9)` để tránh `0.6 × 5` cho ra 3.0000000000000004 và bị làm tròn lên 4.
- Điểm bình minh: Σ(50 + floor(fuel)) cho đèn đang sáng + 50 × Ngọn Lửa. Bỏ thưởng thời gian (`per_second_left = 0`).

### 3. Sức chứa

`capacity = min(capacity_max, carry_capacity + 2 × successfulLights)`. Đây là giá trị suy ra (hàm), không phải bộ đếm, nên không cần đồng bộ. `successfulLights` chỉ tăng khi thắp (lần đầu hoặc thắp lại) qua tương tác. Đèn đặt sẵn bằng scenario không tính.

## Hệ quả

- Tích cực: không có sai số dầu. Vùng an toàn và sức chứa là giá trị suy ra nên luôn nhất quán. Thứ tự tick vẫn đúng 12 bước của Ticket-02, chỉ thêm việc trừ dầu vào bước 2.
- Phá vỡ tương thích: xem [CHANGELOG.md](../../CHANGELOG.md#phase-3). 11 test cũ phải sửa hoặc thay (xem [docs/notes/phase-3.md](../notes/phase-3.md)).
- Rủi ro: tốc độ Bóng `wander` đi tới đèn yếu không được quy định. Chọn tốc độ đuổi (4 m/s, Đêm 3 là 4,5) và ghi giả định. Đổi được bằng một hằng số nếu test ẩn dùng tốc độ khác.

## Phương án đã cân nhắc

- Lưu dầu bằng số thực rồi so sánh với epsilon: bỏ, vì ticket khuyến nghị đơn vị nguyên và số thực dễ lệch ở mốc 30.0.
- Lưu cờ `safe` riêng cho đèn: bỏ, vì dễ quên cập nhật khi dầu đổi.

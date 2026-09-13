# ART BIBLE (CẨM NANG NGHỆ THUẬT & GIAO DIỆN)
## Dự án: Canopy - Tropical Survival Management

---

### 1. PHONG CÁCH CHỦ ĐẠO (ART DIRECTION)
* **Phong cách**: Semi-realistic Stylized Tropical Survival (Sinh tồn nhiệt đới bán hiện thực, không màu mè hoạt hình gacha, không 3D thô thiển).
* **Góc nhìn (Camera Angle)**: Top-down 3/4 hoặc Isometric 2D nhẹ (góc chiếu 55°–65° từ trên xuống), tạo cảm giác bao quát cả khu trại lẫn các node tài nguyên.
* **Ánh sáng (Lighting)**: Ánh sáng ban ngày nhiệt đới dịu (Soft tropical daylight), có vệt nắng xuyên qua tán rừng già (canopy dappled light), chuyển dần sang ánh hoàng hôn ấm áp (amber twilight) và bóng đêm rừng sâu huyền bí (deep jungle night) với đốm lửa bập bùng.

---

### 2. BẢNG MÀU CHỦ ĐẠO (COLOR PALETTE PHILOSOPHY)
* **Màu nền giao diện (Dark Natural Slate)**:
  * `#0f1412` (Deep Forest Base): Nền tối tự nhiên của màn đêm nhiệt đới.
  * `#18221c` (Canopy Surface): Bề mặt thẻ, bảng điều khiển và khung chứa.
  * `#24332b` (Weathered Wood/Border): Viền phân cách tế nhị, chống nhức mắt.
* **Màu điểm xuyết (Accents & Highlights)**:
  * `#3da868` (Lush Moss Green): Trạng thái sức khỏe, sinh lực, cây trồng tươi tốt.
  * `#d9822b` (Campfire Amber): Cảnh báo đói/khát nhẹ, đốm lửa trại, ánh hoàng hôn, công cụ hoàn thành.
  * `#e65151` (Tropical Danger Red): Thương tích nặng, nguy cơ mất nước, thú dữ, cảnh báo bão.
  * `#48a9e6` (Crystalline Stream Blue): Nguồn nước ngọt sạch, độ ẩm đất, thời tiết mưa.
  * `#e2d5bd` (Bamboo Parchment): Màu chữ chính, tạo cảm giác nhật ký viết trên giấy tre hoặc vỏ cây khô.

---

### 3. QUY CHUẨN GIAO DIỆN (UI/UX SPECIFICATIONS)
* **Bố cục khung hình chuẩn**:
  * **Top Bar**: Đồng hồ Ngày/Giờ thực tế, Bộ điều khiển tốc độ (Pause, 1x, 2x, 4x), Icon Thời tiết, Nhiệt độ môi trường, Tóm tắt tổng nhân khẩu & tài nguyên thiết yếu.
  * **Left Panel**: Danh sách chân dung người sống sót (Survivor Portraits) với thanh sinh lực (Health/Hunger/Thirst) mini để người chơi theo dõi tức thì mà không cần chuyển tab.
  * **Center Stage**: Toàn cảnh trại (Camp Scene) hoặc Bản đồ thế giới (World Map) với các node tương tác rõ ràng.
  * **Right Panel**: Bảng tác vụ đang diễn ra (Active Tasks/Crafting Queue/Expedition tracker) và thông báo nhật ký đảo (Event Logs).
  * **Bottom Dock**: Các tab nghiệp vụ chính: *Trại (Camp), Bản đồ (Map), Kho bãi (Inventory), Chế tạo (Crafting), Xây dựng (Build), Phân công (Survivors), Nông nghiệp (Farming - unlock sau)*.
* **Quy chuẩn Font & Nhãn (Typography)**:
  * Tiêu đề: Phong cách phiêu lưu, trang trọng, tự nhiên.
  * Nội dung số liệu: Sans-serif hiện đại, nét số dễ đọc, độ tương phản cao đạt tiêu chuẩn WCAG AA.
  * Không ngắt dòng nhãn con (No line wrapping inside pills or badges).

---

### 4. PHÂN HẠNG TÀI NGUYÊN ĐỒ HỌA (ASSET TIERS)
* **Tier A (Biểu tượng chuẩn & Code-based)**:
  * Hệ thống icon từ `lucide-react` cho toàn bộ UI điều hướng, phân loại kho, trạng thái thời tiết, công cụ.
* **Tier B (Minh họa bối cảnh & Nhân vật Stylized)**:
  * Hình nền cảnh trại rừng nhiệt đới, chân dung người sống sót theo đúng quy chuẩn Art Bible.
* **Tier C (Thành phần Procedural CSS)**:
  * Tuyệt đối không dùng ảnh AI cho thanh tiến độ (Progress bars), bảng số liệu, tooltip hay nút bấm để đảm bảo độ sắc nét tuyệt đối trên mọi màn hình.

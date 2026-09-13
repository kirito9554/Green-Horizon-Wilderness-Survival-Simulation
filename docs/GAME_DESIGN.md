# TÀI LIỆU THIẾT KẾ GAME (GAME DESIGN DOCUMENT)
## Dự án: Canopy - Tropical Survival Management

---

### 1. TẦM NHÌN & Ý TƯỞNG CỐT LÕI
* **Thể loại**: 2D Tropical Survival Settlement Management (Mô phỏng sinh tồn, quản lý trại, thám hiểm theo thời gian thực).
* **Cảm hứng cơ chế**: Cấu trúc vòng lặp chiến lược & logistics tương tự *Sector 29: Last Light*, nhưng hoàn toàn độc lập về bối cảnh, hình ảnh, cốt truyện và hệ sinh thái.
* **Bối cảnh**: Một nhóm người sống sót sau tai nạn đắm tàu trôi dạt vào bờ biển một hòn đảo rừng nhiệt đới xa xôi, chưa có tên trên bản đồ hàng hải.
* **Mục tiêu tối hậu**: Không đánh trùm hay đối đầu quân sự hoành tráng, mà là chuyển hóa dần từ trạng thái ngàn cân treo sợi tóc thành một **khu định cư tự cung tự cấp vững chãi** (Self-Sustaining Colony).
* **Triết lý 5 trụ cột**:
  1. **Survive**: Giữ mạng sống, tìm nguồn nước ngọt, chống mất nước, tìm thức ăn qua ngày, dựng lều tránh mưa gió.
  2. **Explore**: Mở rộng khảo sát từng phân khu (Biome/Area), nâng cao % hiểu biết (Knowledge %), phát hiện tài nguyên và lối đi tắt.
  3. **Gather**: Thu gom có ý thức, theo dõi sức phục hồi của hệ sinh thái bản địa (không khai thác cạn kiệt vô tội vạ).
  4. **Improve**: Chế tạo công cụ từ các thành phần (Head + Handle + Binding), dựng bếp đun, bể lọc nước than củi, kho chứa chia tải trọng.
  5. **Sustain**: Trồng trọt cây giống nhiệt đới (sắn, khoai, chuối...), chăn nuôi lấy trứng/sữa/phân bón, thiết lập dây chuyền sản xuất tự động theo định mức (Produce until stock X).

---

### 2. CORE GAME LOOP (VÒNG LẶP CHÍNH)
```text
[Quan sát tình trạng trại: Nước, Lương thực, Sức khỏe nhân sự, Thời tiết]
                           ↓
[Xác định nhu cầu cấp bách hoặc dài hạn]
                           ↓
[Phân công công việc (Job Priority) & Chuẩn bị Expedition]
                           ↓
[Khám phá / Khai thác tài nguyên từ POI / Trại]
                           ↓
[Vận chuyển (Logistics) về Kho bãi (Inventory & Containers)]
                           ↓
[Sơ chế chuyên sâu: Dừa, Cá, Tre, Thảo dược, Đất sét]
                           ↓
[Crafting công cụ / Xây dựng công trình / Nấu nướng / Lọc nước]
                           ↓
[Cải thiện điều kiện sống, sức khỏe và tinh thần (Morale)]
                           ↓
[Mở khóa công nghệ qua trải nghiệm & khám phá khu vực mới]
```

---

### 3. HỆ THỐNG CHI TIẾT

#### 3.1. Phân bổ bản đồ (World Structure)
* Không dùng open-world đi lại tự do WASD gây mệt mỏi micromanagement.
* Bản đồ dạng node: **Area → POI (Điểm quan tâm) → Resource Node**.
* Mỗi Area sở hữu:
  * Biome, nhiệt độ, độ ẩm, độ nguy hiểm, thời gian di chuyển (Travel time), khả năng tiếp cận nước.
  * Chỉ số **Knowledge % (0% - 100%)**: càng thám hiểm nhiều càng phát hiện thêm tài nguyên ẩn, thú rừng và POI đặc biệt.
  * Danh sách khu vực ban đầu: *Camp Clearing (Trại chính), Coastal Shallows (Bờ biển cạn), Riverbank (Bờ sông), Bamboo Grove (Rừng tre), Mangrove Swamp (Rừng ngập mặn), Rocky Ridge (Gờ đá), Deep Jungle (Rừng nhiệt đới rậm), Cave Entrance (Cửa hang)*.

#### 3.2. Logistics & Quản lý kho (Inventory & Weight/Volume)
* Mỗi vật phẩm đều có **Trọng lượng (kg)** và **Thể tích (L)**.
* Kho chứa phân loại theo Container chuyên dụng:
  * Túi đeo (Backpack): 15 kg / 25 L.
  * Giỏ mây (Woven Basket): 12 kg / 35 L.
  * Thùng gỗ (Wooden Crate): 50 kg / 70 L.
  * Hố đào / Giá treo (Pit / Rack): lưu trữ chuyên dụng cho gỗ, đá hoặc nông sản.
* Hệ thống lọc theo danh mục: *Thực phẩm, Nguyên liệu thô, Công cụ, Y tế, Hạt giống, Động vật, Xây dựng, Nhiên liệu*.

#### 3.3. Tương tác tài nguyên sâu (Resource Depth)
* Tránh tuyệt đối kiểu tài nguyên trừu tượng `Gỗ x 100`.
* Ví dụ chuỗi tương tác đặc trưng:
  * **Trái dừa**: Hái từ cây dừa → Uống nước dừa (giảm khát tức thì) → Bổ lấy cùi dừa (ăn bổ sung calo/chất béo) → Vỏ dừa làm gáo đựng nước/bát ăn hoặc đốt thành than hoạt tính lọc nước.
  * **Cây tre**: Đốn hạ → Thân tre (Bamboo Pole) → Chẻ tre (Split Bamboo) → Vót nan/bện sợi tre → Đan giỏ chứa, làm bẫy cá, vách lều hoặc chuôi giáo.
  * **Cá suối/biển**: Câu hoặc kéo bẫy → Cá tươi nguyên con → Mổ cá (thu Fillet thịt + Xương làm kim/lưỡi câu + Ruột cá làm mồi câu/ủ phân) → Fillet đem nướng hoặc hun khói/sấy khô để tích trữ lâu dài.

#### 3.4. Hệ thống người sống sót (Survivors) & Phân quyền việc làm (Job Priority)
* Mỗi nhân vật có: Sức khỏe (Health), Đói (Hunger), Khát (Thirst), Thể lực (Fatigue), Tinh thần (Morale), Vệ sinh (Hygiene), Thân nhiệt (Body Temp).
* Bộ kỹ năng thực chiến (Skill level tăng qua thực hành):
  * *Foraging, Hunting, Fishing, Cooking, Crafting, Building, Farming, Animal Handling, Medicine, Exploration*.
* Cơ chế tự động hóa: Bảng ưu tiên phân công việc (Highest, High, Normal, Low, Disabled) kết hợp chế độ phân công thủ công khi cần khẩn cấp.
* Chính sách khẩu phần (Food/Water Policy): Tiết kiệm (Ration), Tiêu chuẩn (Normal), Rộng rãi (Generous).

#### 3.5. Dây chuyền sản xuất & Hàng đợi lệnh (Work Queue System)
* Công trình sản xuất cho phép cài đặt 4 chế độ lặp:
  1. Sản xuất 1 lần (Produce once).
  2. Sản xuất N lần (Produce X).
  3. Sản xuất cho đến khi đạt kho (Produce until stock >= X).
  4. Sản xuất liên tục (Produce forever).

---

### 4. TIÊU CHÍ HOÀN THÀNH GIAI ĐOẠN 1 (PHASE 1 ACCEPTANCE CRITERIA)
1. Camp view trực quan, hiển thị tài nguyên thời gian thực với đồng hồ ngày/đêm và thời tiết.
2. Quản lý kho với cơ chế Trọng lượng (Weight) + Thể tích (Volume) + Phân loại danh mục.
3. Chỉ số sống sót của 3 nhân vật đầu tiên với auto-consumption và cập nhật thể lực.
4. Hệ thống khai thác (Gathering) tại chỗ và 1 chuyến thám hiểm (Expedition) đến khu vực lân cận.
5. Hệ thống chế tạo công cụ từ thành phần (Axe Head + Handle + Binding) và sơ chế tài nguyên sâu.
6. Hệ thống lưu/tải game tự động (Autosave), 3 save slot, hỗ trợ Export/Import JSON phiên bản hóa.

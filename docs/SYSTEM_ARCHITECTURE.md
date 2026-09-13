# KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)
## Dự án: Canopy - Tropical Survival Management

---

### 1. NGUYÊN TẮC THIẾT KẾ KỸ THUẬT
* **Tách bạch State & Logic (Data-driven & Pure Sim Engine)**: Tách dữ liệu tĩnh (items, recipes, biomes, buildings) khỏi trạng thái động (GameSaveState).
* **Deterministic Simulation Tick**: Engine chạy vòng lặp tick đều đặn (mặc định 1 game-second = 100ms real time ở tốc độ 1x, có nút pause / 1x / 2x / 4x), dễ đồng bộ, dễ tính toán offline progress.
* **Non-blocking & Modular**: Mỗi phân hệ (Inventory, Expedition, Health, Weather, Building, Farming) là các hàm/lớp module độc lập nhận `GameState` và trả về state biến đổi hoặc mutation rõ ràng.
* **Persistence & Save Migration**: Định dạng JSON lưu trữ chuẩn `saveVersion: 1`, tương thích backward khi mở rộng các Phase sau mà không làm gãy save cũ.

---

### 2. CẤU TRÚC THƯ MỤC DỰ ÁN
```text
/src
  /data                   # Dữ liệu tĩnh (Items, Recipes, Biomes, Buildings, Survivors)
    items.ts              # Định nghĩa chi tiết vật phẩm, cân nặng, thể tích, tags, dinh dưỡng
    recipes.ts            # Công thức chế tạo thành phần (Tool components, Processing)
    biomes.ts             # Bản đồ các vùng, POI, tỉ lệ tài nguyên, thời gian di chuyển
    buildings.ts          # Công trình, yêu cầu vật tư, chức năng và hàng đợi sản xuất
    survivors.ts          # Nhân vật khởi đầu, traits, kỹ năng ban đầu
  /types                  # TypeScript Interface & Type Definitions
    game.ts               # Core State, Save format, Time, Weather, Settings
    item.ts               # Item, Container, Inventory, Tags
    survivor.ts           # Stats, Skills, Health, Conditions, JobPriority
    world.ts              # Area, POI, Expedition, Events
    building.ts           # Construction, Queue, Stations
    farming.ts            # Soil, Crops, Seeds, Livestock (cho các Phase tiếp theo)
  /simulation             # Logic mô phỏng (Tick Engine)
    simEngine.ts          # Bộ điều phối nhịp tick thời gian, thời tiết, sinh tồn
    inventoryLogic.ts     # Tính toán tải trọng, thể tích, chuyển kho, lọc
    craftingLogic.ts      # Kiểm tra nguyên liệu, thời gian chế tác, ghép thành phần
    expeditionLogic.ts    # Tính thời gian đi lại, tiêu hao, sự kiện ngẫu nhiên
    survivalLogic.ts      # Tiêu thụ nước/thức ăn tự động, hồi phục thể lực, mệt mỏi
  /save
    saveManager.ts        # Quản lý 3 save slots, autosave định kỳ, export/import JSON
  /components             # Giao diện người dùng chia theo phân khu
    /layout
      TopHeader.tsx       # Thời gian, Ngày, Tốc độ (1x/2x/4x), Thời tiết, Cảnh báo nhanh
      LeftSidebar.tsx     # Danh sách chân dung nhân vật, trạng thái sinh tồn
      BottomNav.tsx       # Thanh điều hướng chính: Trại, Bản đồ, Kho, Xây dựng, Chế tạo...
    /camp
      CampOverview.tsx    # Toàn cảnh trại, khu sinh hoạt, công trình đang hoạt động
      QuickGatherPanel.tsx # Thu lượm tài nguyên tức thì quanh khu vực trại
    /inventory
      InventoryView.tsx   # Quản lý kho, lọc danh mục, chi tiết cân nặng & thể tích
      ItemDetailModal.tsx # Xem chi tiết vật phẩm, phân rã, ăn/uống trực tiếp
    /crafting
      CraftingView.tsx    # Chế tạo công cụ từ thành phần, sơ chế thực phẩm/tre/dừa
    /world
      WorldMapView.tsx    # Bản đồ khu vực, % khám phá, điều hướng đội thám hiểm
      ExpeditionModal.tsx # Chuẩn bị nhân sự, trang bị, đồ ăn nước uống trước khi đi
    /survivors
      SurvivorModal.tsx   # Bảng chi tiết nhân vật, kỹ năng, traits, phân công việc
    /save
      SaveLoadModal.tsx   # Bảng lưu/tải 3 slot, Export & Import Save JSON
    /common
      Tooltip.tsx         # Tooltip thông số trực quan
      ProgressBar.tsx     # Thanh tiến độ CSS chuẩn, không AI artifact
```

---

### 3. VÒNG LẶP TICK SIMULATION (SIMULATION LOOP)
```typescript
interface SimTickDelta {
  deltaGameMinutes: number;
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  weatherEffect: WeatherModifier;
}
```
1. **Time & Weather Tick**: Cập nhật phút trong game. Cứ mỗi 1440 game-minutes = 1 ngày. Thời tiết thay đổi theo chu kỳ và đặc điểm khí hậu nhiệt đới.
2. **Survival Tick**: Cứ mỗi tick, Survivor tiêu hao nhẹ chỉ số đói, khát và thể lực. Nếu có thức ăn/nước sẵn trong kho và nhân vật đang ở trại, cơ chế *Auto-consumption* sẽ tự động bù đắp theo chính sách khẩu phần (Policy).
3. **Work & Crafting Tick**: Giảm dần timer của các công việc đang tiến hành (chế tạo, xây dựng, sơ chế, thám hiểm).
4. **Logistics & Storage Tick**: Kiểm tra giới hạn kho bãi, cập nhật chất lượng và độ tươi (freshness) của thực phẩm theo nhiệt độ và phương thức bảo quản.

# Green Horizon: Tropical Survival Colony
*(Dự án mã hiệu: Canopy - Tropical Survival Management)*

> Một tựa game mô phỏng quản lý định cư và sinh tồn chiến thuật thời gian thực (Real-time Tactical Survival Colony Simulation) trên đảo hoang nhiệt đới. Xây dựng trên nền tảng web hiện đại với React 19, TypeScript, Tailwind CSS và hệ thống Shader đồ họa Canvas.

---

## 1. Giới thiệu tổng quan

**Green Horizon: Tropical Survival Colony** đưa người chơi vào vai người chỉ huy một nhóm người sống sót sau thảm họa đắm tàu, dạt vào bờ biển của một hòn đảo nhiệt đới hoang sơ chưa có tên trên bản đồ hàng hải.

Không đặt nặng yếu tố giao tranh quân sự hay quái vật viễn tưởng, trọng tâm của trò chơi xoay quanh cuộc chiến sinh tồn thực tế: đối mặt với thời tiết khắc nghiệt, tìm kiếm nguồn nước ngọt, khai thác tài nguyên tự nhiên có kiểm soát, phân công nhân sự và từng bước xây dựng một khu định cư kiên cố, tự cung tự cấp (*Self-Sustaining Colony*).

---

## 2. Triết lý thiết kế & 5 Trụ cột cốt lõi

Trò chơi được xây dựng xoay quanh 5 trụ cột phát triển liên hoàn:

1. **Survive (Sinh tồn)**: Đảm bảo nhu cầu thiết yếu hàng đầu: nước sạch, thức ăn, giấc ngủ, duy trì thân nhiệt và tinh thần (morale) cho từng người sống sót.
2. **Explore (Khảo sát)**: Mở rộng thám hiểm bản đồ dạng điểm mốc (POI - Points of Interest). Mỗi lần thám hiểm nâng cao tỷ lệ am hiểu (*Knowledge %*), mở ra các nguồn tài nguyên quý và lối đi an toàn.
3. **Gather (Thu hoạch sinh thái)**: Thu lượm tài nguyên gắn liền với chu kỳ hồi phục của tự nhiên. Khai thác quá mức sẽ làm cạn kiệt cục bộ, đòi hỏi người chơi phân bổ khu vực luân phiên.
4. **Improve (Cải tiến & Nâng cấp)**: Lắp ráp công cụ từ từng bộ phận chi tiết (*Head + Handle + Binding*), xây dựng công trình xử lý nước, bếp lửa, chòi quan sát và kho bãi chứa hàng.
5. **Sustain (Bền vững)**: Thiết lập chuỗi sản xuất tự động qua hàng đợi lệnh chế tác, phân bổ công việc theo mức độ ưu tiên và chuẩn bị kho dự trữ cho những đợt bão nhiệt đới dài ngày.

---

## 3. Kiến trúc giao diện chiến thuật (Tactical Interface)

Giao diện được thiết kế theo tỷ lệ chuẩn **16:9** khóa khung (Aspect-Locked Tactical Frame), lấy cảm hứng từ bàn chỉ huy dã chiến với chất liệu gỗ mộc, giấy da và kim loại đồng phong hóa:

* **Thanh điều khiển trên cùng (Top Header Bar)**: 
  * Đồng hồ thời gian thực trong ngày, ngày sinh tồn, nút chuyển tốc độ mô phỏng (Pause, 1x, 2x, 4x).
  * Dự báo thời tiết hiện tại và sắp tới, tốc độ và hướng gió nhiệt đới.
  * Chỉ số tổng quan về nhân sự, thể tích và tải trọng kho.
  * Lối tắt mở trình lưu game (Save/Load) và bảng điều khiển nhà phát triển (Dev Panel).
* **Cột bản đồ chiến thuật bên trái (Tactical World Map - 55% độ rộng)**:
  * Bản đồ tương tác trực quan với các vùng địa hình (Biomes): Bãi cát ven biển, Rừng tre, Vùng ngập mặn, Bờ suối, Rừng già, Gờ đá, Vách núi...
  * Tích hợp hiệu ứng Canvas/WebGL: mặt nước biển dập dềnh phản chiếu ánh sáng (*MapWaterShader*), dòng chảy thác nước (*MapWaterfallFlow*), sương mù nhiệt đới (*MapAmbientEffects*) và hạt bụi phấn bay trong gió (*MapParticleEffects*).
  * Đồng hồ định vị la bàn nhiệt đới (*TropicalMapClock*).
* **Cột tác vụ trung tâm (Tactical Center Column - 27% độ rộng)**:
  * **Thẻ địa điểm hiện tại (POI Card)**: Hình ảnh minh họa chất lượng cao theo từng khu vực, chỉ số an toàn, độ ẩm, độ hiểu biết (*Knowledge %*) và nút mở chi tiết địa bàn (*Inspect Location*).
  * **Hành trang đội (Party Inventory)**: 15 ô trang bị hiển thị trực quan biểu tượng vật phẩm, số lượng, cấp phẩm chất (*Crude, Standard, Prime, Masterwork*) và độ bền. Hỗ trợ dùng trực tiếp, sửa chữa hoặc vứt bỏ.
  * **Nhật ký sự kiện (Colony Event Logs)**: Ghi lại từng biến động thời gian thực theo thời khắc trong ngày.
* **Cột đội ngũ người sống sót bên phải (Tactical Party Column - 13% độ rộng)**:
  * Chân dung đại diện, trạng thái hành động tức thời, thanh sinh tồn rút gọn.
  * Chức năng nghỉ ngơi hồi sức cấp tốc hoặc tuyển mộ thêm thành viên dạt vào bờ.
* **Các bảng điều khiển chuyên sâu (Modals)**:
  * **Quản lý khu trại (Manage Camp Modal)**: Xây dựng công trình, điều phối hàng đợi chế tác, phân công nhiệm vụ nhân sự (*Job Priorities*) và chính sách khẩu phần (*Policies*).
  * **Khảo sát chi tiết địa điểm (Inspect Location Modal)**: Quản lý kho bãi ngoại vi (POI Storage), chuyển đổi đồ đạc hai chiều, xây tiền đồn và cử đội viễn chinh.
  * **Lưu & Tải game (Save/Load Modal)**: 3 vị trí lưu độc lập, tính năng tự động lưu và xuất/nhập tệp JSON.
  * **Bảng công cụ Sandbox (Dev Panel)**: Công cụ can thiệp chỉ số phục vụ kiểm thử nhanh.

---

## 4. Các hệ thống mô phỏng chi tiết

### 4.1. Cỗ máy mô phỏng thời gian thực (Deterministic Sim Engine)
* Hệ thống chạy theo nhịp tick đều đặn (1 giây thực = 10 giây game ở tốc độ 1x, có thể tăng tốc lên 2x, 4x hoặc tạm dừng).
* Tách biệt hoàn toàn giữa dữ liệu tĩnh (Database: vật phẩm, công thức, khu vực, công trình) và trạng thái động (`GameState`), giúp việc đồng bộ và lưu trữ diễn ra mượt mà.

### 4.2. Quản lý nhân sự & Chỉ số sinh tồn (Survivors System)
* **Chỉ số sinh tồn**:
  * Máu (Health: 0 - 100)
  * Đơn vị đói (Hunger: 0 - 100) & Khát (Thirst: 0 - 100)
  * Thể lực & Mệt mỏi (Fatigue: 0 - 100)
  * Tinh thần sống sót (Morale: 0 - 100)
  * Thân nhiệt & Khả năng chịu thời tiết
* **Kỹ năng nghề nghiệp**: Khảo sát & hái lượm (*Foraging*), Săn bắt (*Hunting*), Câu cá (*Fishing*), Chế tác (*Crafting*), Xây dựng (*Building*), Y tế (*Medicine*), Thám hiểm (*Exploration*). Kỹ năng tăng dần thông qua thực hành thực tế.
* **Cơ chế tự động hóa**: Hệ thống phân công việc làm ma trận 5 cấp độ (*Highest, High, Normal, Low, Disabled*) giúp người sống sót tự động tìm việc phù hợp khi rảnh rỗi.

### 4.3. Kho chứa hai tầng & Cơ chế Logistics thực tế
* Không sử dụng ô chứa vô tận. Mọi vật phẩm đều có hai tham số vật lý:
  * **Khối lượng (Weight - kg)**
  * **Thể tích (Volume - L)**
* **Hệ thống kho kép**:
  * **Kho di động (Party Backpack)**: Giới hạn theo sức mang của đoàn thám hiểm.
  * **Kho bãi ngoại vi (POI Outpost Storage)**: Cho phép dựng hòm đồ, giỏ chứa tại từng địa điểm trên đảo để tích trữ tài nguyên tại chỗ, giảm tải việc đi lại liên tục.
  * Hỗ trợ chuyển từng món hoặc nút bấm *Dỡ toàn bộ vào kho / Lấy toàn bộ vào túi* nhanh gọn.

### 4.4. Hệ thống vật phẩm & Phân tầng phẩm chất (Item & Quality)
* **4 bậc phẩm chất**:
  * 🟤 *Crude (Thô sơ)*: Tạo từ vật liệu tạp, độ bền thấp, hiệu suất trung bình.
  * 🟢 *Standard (Đạt chuẩn)*: Cân bằng, đáp ứng tốt nhu cầu sinh tồn thường nhật.
  * 🔵 *Prime (Tuyển chọn)*: Vật liệu chất lượng cao, độ bền vượt trội (+25%), tăng tốc độ thu hoạch.
  * 🟡 *Masterwork (Thượng phẩm)*: Chế tác bởi thợ lành nghề, tối ưu độ bền (+50%), cộng điểm tinh thần khi sở hữu.
* **Độ bền & Tái chế**: Công cụ giảm độ bền theo số lần sử dụng. Khi hỏng có thể thu hồi phế liệu (*Salvage*) hoặc dùng nguyên liệu mài sắc/sửa chữa (*Repair*).
* **Độ tươi thực phẩm (Freshness & Spoilage)**: Đồ ăn tươi sống bị ôi thiu theo thời gian nếu không được sơ chế, nướng chín, sấy khô hoặc hun khói.

### 4.5. Chế tác đa tầng, Hàng đợi sản xuất & Nghiên cứu
* Chế tác từ các linh kiện cơ bản: Lưỡi rìu đá + Thân gỗ/cán tre + Dây bện từ vỏ cây.
* **Hàng đợi sản xuất linh hoạt (Crafting Queue)**:
  * Chế tác 1 lần (*Once*)
  * Chế tác theo số lượng chỉ định (*Quantity*)
  * Duy trì mức dự trữ trong kho (*Produce until stock X*)
  * Chế tác liên tục không ngừng (*Produce forever*)
* Có thể chỉ định đích danh thợ thủ công phụ trách từng đơn hàng để tối ưu chất lượng thành phẩm.
* **Bảng nghiên cứu công nghệ**: Đầu tư thời gian và nhân lực mở khóa các kỹ thuật sinh tồn mới như lọc than hoạt tính, hun khói bảo quản, lò nung đất sét...

### 4.6. Bản đồ, Điểm mốc (POIs) & Khả năng tái sinh sinh thái
* Hệ thống bản đồ dạng lưới 18 địa điểm đặc trưng.
* Mỗi khu vực sở hữu các mỏ tài nguyên với **hồ chứa sinh thái (Ecological Regeneration Pools)**. Càng hiểu rõ khu vực, người chơi càng tìm thấy nhiều tài nguyên ẩn và lối đi tắt giảm thời gian di chuyển.
* Tài nguyên sau khi khai thác cạn kiệt sẽ cần một chu kỳ ngày nhất định để nảy mầm hoặc hồi phục tự nhiên.

### 4.7. Thời tiết nhiệt đới biến động (Dynamic Weather)
* Mô phỏng chuyển biến liên tục: *Nắng ráo (Clear), Nhiều mây (Cloudy), Mưa nhẹ (Light Rain), Mưa lớn (Heavy Rain), Bão nhiệt đới (Tropical Storm), Đợt nắng nóng (Heat Wave)*.
* Thời tiết ảnh hưởng trực tiếp đến tốc độ di chuyển của đội viễn chinh, nguy cơ hạ/tăng thân nhiệt, tốc độ hỏng của thực phẩm và lượng nước mưa có thể thu gom được tại trại.

### 4.8. Lưu trữ & Khôi phục dữ liệu an toàn (Save System)
* Quản lý 3 khe lưu thủ công (`Slot 1`, `Slot 2`, `Slot 3`).
* Cơ chế tự động lưu ngầm (*Autosave*) mỗi 30 giây trong quá trình mô phỏng.
* Hỗ trợ xuất file mã hóa `Save_Game_Canopy.json` tải về máy và nhập lại bất cứ lúc nào.
* Có cơ chế xác thực phiên bản dữ liệu (*Save Migration*) đảm bảo không gãy cấu trúc khi cập nhật phiên bản mới.

---

## 5. Cấu trúc thư mục dự án

```text
/
├── public/                       # Tài nguyên đồ họa tĩnh
│   ├── UI-BG.png                 # Khung hình nền giao diện chuẩn 16:9
│   ├── tropical-clock-frame.png  # Khung đồng hồ la bàn nhiệt đới
│   ├── maps/                     # Bản đồ nền và các mảnh ghép địa hình
│   ├── poi-bg/                   # Tranh nền phong cảnh chi tiết của từng POI
│   ├── poi-card/                 # Thẻ minh họa 18 địa điểm sinh tồn
│   ├── iconsets/                 # Bộ biểu tượng nguyên vật liệu & tài nguyên
│   ├── portraits/                # Chân dung người sống sót
│   └── ui/buildings/             # Ảnh minh họa công trình và trại
│
├── docs/                         # Tài liệu thiết kế & quy chuẩn kỹ thuật
│   ├── GAME_DESIGN.md            # Tài liệu thiết kế trò chơi (GDD)
│   ├── SYSTEM_ARCHITECTURE.md   # Kiến trúc hệ thống & quy chuẩn module
│   ├── ART_BIBLE.md              # Quy chuẩn bảng màu, nghệ thuật & typography
│   ├── DATA_SCHEMA.md            # Đặc tả cấu trúc Types & Interface dữ liệu
│   ├── ASSET_MANIFEST.md         # Danh mục tổng hợp tài nguyên hình ảnh
│   └── SHADER_OVERHAUL_PLAN.md   # Kế hoạch tối ưu hóa hiệu ứng Shader
│
├── src/                          # Mã nguồn chính của ứng dụng
│   ├── components/               # Các React Component giao diện
│   │   ├── common/               # Thành phần dùng chung (ItemIcon, QualityBadge, Portrait)
│   │   ├── layout/               # Khung bố cục chiến thuật (TopHeader, Center, Party)
│   │   ├── world/                # Bản đồ thế giới, Shader nước, hạt và đồng hồ
│   │   ├── camp/                 # Giao diện tổng quan trại
│   │   ├── crafting/             # Bảng chế tạo công cụ & chế biến
│   │   ├── inventory/            # Bảng quản lý kho đồ & phân loại
│   │   ├── buildings/            # Danh sách công trình & tiến độ thi công
│   │   ├── survivors/            # Quản lý nhân khẩu & phân bổ công việc
│   │   └── modals/               # Hộp thoại popup (ManageCamp, Inspect, Save, Dev...)
│   │
│   ├── data/                     # Dữ liệu tĩnh của trò chơi
│   │   ├── items/                # Cơ sở dữ liệu vật phẩm (Nguyên liệu, Công cụ, Cứu sinh)
│   │   ├── areas.ts              # Dữ liệu 18 khu vực trên đảo và tài nguyên gắn kèm
│   │   ├── buildings.ts          # Danh mục công trình và yêu cầu vật tư
│   │   ├── recipes.ts            # Công thức chế tạo & cây công nghệ nghiên cứu
│   │   └── survivors.ts          # Hồ sơ người sống sót ban đầu và tân binh
│   │
│   ├── simulation/               # Logic mô phỏng trò chơi (Simulation Engine)
│   │   ├── simEngine.ts          # Bộ điều phối nhịp tick trung tâm
│   │   ├── survivorSystem.ts     # Tính toán chỉ số sinh tồn và chuyển đổi trạng thái
│   │   ├── inventorySystem.ts    # Logic tải trọng, thể tích, luân chuyển kho
│   │   ├── craftingSystem.ts     # Xử lý hàng đợi chế tác và kỹ năng thợ
│   │   ├── expeditionSystem.ts   # Tính toán thời gian thám hiểm và chiến lợi phẩm
│   │   ├── resourcePools.ts      # Khả năng tái sinh tự nhiên của mỏ tài nguyên
│   │   ├── weatherSystem.ts      # Vòng tuần hoàn thời tiết và tác động môi trường
│   │   └── timeSystem.ts         # Chu kỳ ngày đêm và chuyển đổi thời gian
│   │
│   ├── save/                     # Quản lý lưu trữ
│   │   └── saveManager.ts        # Lưu/tải LocalStorage, Autosave, Export/Import JSON
│   │
│   ├── types/                    # Định nghĩa kiểu dữ liệu TypeScript
│   │   └── index.ts              # Toàn bộ Type & Interface hệ thống
│   │
│   ├── utils/                    # Các hàm tiện ích
│   │   ├── qualityUtils.ts       # Tính toán tỷ lệ phẩm chất vật phẩm
│   │   ├── poiImageManager.ts    # Quản lý nạp ảnh POI
│   │   └── portraitManager.ts    # Quản lý ảnh đại diện
│   │
│   ├── App.tsx                   # Điểm lắp ghép ứng dụng chính
│   ├── main.tsx                  # Điểm khởi chạy React DOM
│   └── index.css                 # Thiết lập Tailwind CSS
│
├── index.html                    # Trang HTML chuẩn
├── metadata.json                 # Thông tin cấu hình môi trường AI Studio
├── package.json                  # Khai báo thư viện & kịch bản lệnh
├── tsconfig.json                 # Cấu hình TypeScript
└── vite.config.ts                # Cấu hình đóng gói Vite
```

---

## 6. Công nghệ sử dụng

* **Nền tảng giao diện**: [React 19](https://react.dev/)
* **Ngôn ngữ**: [TypeScript 5.8](https://www.typescriptlang.org/) (Strict Mode)
* **Trình biên dịch & Bundler**: [Vite 6](https://vitejs.dev/)
* **Hệ thống Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
* **Bộ Icon**: [Lucide React](https://lucide.dev/)
* **Xử lý Đồ họa & Hiệu ứng**: HTML5 Canvas 2D Context & WebGL Shaders (mặt nước biển, phản xạ ánh sáng, dòng chảy hạt).
* **Lưu trữ dữ liệu**: Web Storage API (LocalStorage) kết hợp Serialization JSON tương thích đa nền tảng.

---

## 7. Hướng dẫn cài đặt & Khởi chạy

### Yêu cầu môi trường
* **Node.js**: Phiên bản 18.x hoặc mới hơn (khuyên dùng Node 20 LTS).
* **Trình quản lý gói**: `npm`, `pnpm` hoặc `bun`.

### Các bước khởi chạy

1. **Cài đặt các gói phụ thuộc**:
   ```bash
   npm install
   ```

2. **Chạy máy chủ phát triển (Development Server)**:
   ```bash
   npm run dev
   ```
   Ứng dụng sẽ được khởi chạy tại địa chỉ: `http://localhost:3000`

3. **Kiểm tra cú pháp & tính toàn vẹn kiểu (Type Checking / Lint)**:
   ```bash
   npm run lint
   ```

4. **Đóng gói sản phẩm cho môi trường Production (Build)**:
   ```bash
   npm run build
   ```
   Tệp tĩnh sau khi biên dịch sẽ nằm trong thư mục `/dist`.

5. **Xem trước bản đóng gói (Preview)**:
   ```bash
   npm run preview
   ```

---

## 8. Hộp công cụ kiểm thử nhanh (Dev Sandbox Panel)

Trong quá trình phát triển và cân bằng cơ chế, có thể bấm vào nút **Dev** ở góc trên cùng bên phải giao diện để kích hoạt bảng điều khiển gỡ lỗi:
* **Tua nhanh thời gian (Fast Forward)**: Nhảy cóc 2 giờ, 6 giờ, 12 giờ hoặc 24 giờ để kiểm tra chu kỳ sinh tồn và độ tươi thực phẩm.
* **Hồi phục tức thời (Heal & Revitalize)**: Khôi phục toàn bộ Máu, Thể lực, bù đầy Nước và Đồ ăn cho toàn đội người sống sót.
* **Bơm tài nguyên (Resource Spawner)**: Thêm ngay lập tức các gói nguyên liệu thô (gỗ tre, đá, dây bện, dừa, cá khô) vào kho để thử nghiệm xây dựng và chế tạo nhanh.
* **Thay đổi thời tiết lập tức**: Ép hệ thống chuyển sang Trời trong, Mưa bão hoặc Sóng nhiệt để quan sát phản ứng của môi trường và hiệu ứng đồ họa.

---

## 9. Định hướng phát triển tiếp theo (Roadmap)

* [ ] **Hệ thống Nông nghiệp & Thổ nhưỡng (Farming Phase)**: Gieo trồng các giống cây nhiệt đới (sắn củ, chuối rừng, khoai lang), ủ phân hữu cơ và tưới tiêu phụ thuộc vào lượng nước mưa.
* [ ] **Thuần dưỡng & Chăn nuôi (Husbandry Phase)**: Bẫy động vật hoang dã, xây chuồng chăn nuôi gà rừng, lợn lòi để thu hoạch trứng, sữa và phân bón.
* [ ] **Công sự phòng vệ & Bẫy thú (Defense & Hazards)**: Dựng hàng rào chông tre, bẫy báo động quanh trại để đề phòng thú dữ và xua đuổi dã thú trong đêm bão.
* [ ] **Tín hiệu cứu hộ & Kết thúc hành trình (Rescue Endgame)**: Sửa chữa tháp thu phát vô tuyến trên đỉnh núi đá (*Hill Lookout*), đốt đống lửa tín hiệu lớn ven biển để thu hút tàu tuần tra biển khơi.

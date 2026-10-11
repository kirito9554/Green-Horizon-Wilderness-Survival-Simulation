# Green Horizon — Wilderness Survival Simulation

**Green Horizon** là một dự án game sinh tồn rừng mưa nhiệt đới mang tính cá nhân, tập trung vào mô phỏng hệ sinh thái, quản lý tài nguyên, thám hiểm và quá trình phát triển từ sinh tồn đơn lẻ sang một khu định cư tự vận hành.

Dự án hiện ở giai đoạn **prototype / active development**. Mục tiêu chính chưa phải là tạo một bản game hoàn chỉnh để phát hành, mà là xây một nền mô phỏng đủ nhất quán để các hệ thống sinh tồn, môi trường và colony gameplay có thể tương tác với nhau lâu dài mà không phụ thuộc vào các “buff” cân bằng tùy ý.

> **Status:** simulation-first prototype. UI, gameplay systems và ecology runtime đều đang được phát triển song song; nhiều phần vẫn có thể thay đổi mạnh.

---

## Current focus

Nhánh phát triển hiện tại tập trung vào **seeded spatial world + authoritative terrestrial food web**.

Mô hình thế giới chính hiện dùng:

- **120 km²** diện tích đất đảo chuẩn.
- **10 macro regions** ổn định ở tầng thiết kế.
- Habitat lattice sinh theo seed với khoảng cách cỡ **600 m**.
- **70 natural Local Sites + 3 required landmarks**.
- **24 loài fauna trên cạn không phải predator**.
- **40+ flora taxa/guilds** qua **13 tầng cấu trúc thực vật**.
- **20+ insect taxa/guilds**.
- **5 predator species**.
- Tài nguyên thực vật, côn trùng, carrion và nước ngọt dùng **shared per-patch material budget** thay vì các proxy độc lập.

Các hệ thống ecology cũ vẫn còn trong codebase ở một số nơi để tương thích dữ liệu hoặc phục vụ migration/regression, nhưng runtime terrestrial mới đang dần trở thành authority chính.

### Predator ecology

Predator simulation hiện bao gồm:

- founder-unit seeding;
- home-range hunting;
- energy reserve / satiation;
- breeding connectivity;
- controlled recovery / recolonization;
- per-species energy accounting;
- prey-access and kill-biomass telemetry;
- intermittent, reserve-aware feeding bouts.

Các bài test dài hạn dùng deterministic seeds để so sánh trajectory qua nhiều năm thay vì chỉ nhìn một snapshot ngắn.

---

## Gameplay direction

Green Horizon hướng tới một vòng chơi dài:

**survive → explore → understand → exploit carefully → build → automate → sustain**

### Survival

Người sống sót phải quản lý các nhu cầu như:

- sức khỏe;
- đói và khát;
- fatigue;
- morale;
- nhiệt độ và tác động môi trường;
- chất lượng, độ bền và tình trạng trang bị.

### Exploration

Thế giới được khám phá theo các khu vực và Local Site có điều kiện địa hình, hydrology, ecology và resource profile riêng.

Travel không được thiết kế như một mạng node “đi đâu cũng được”; khoảng cách, địa hình, vùng ngập, ridge, swamp, mangrove và các điểm vượt địa hình đều có vai trò trong khả năng tiếp cận.

### Camp and colony

Gameplay dự kiến phát triển dần từ một survivor hoặc nhóm nhỏ thành colony:

- xây dựng cluster và công trình;
- storage và logistics theo khối lượng/thể tích;
- crafting, repair, replacement và equipment upgrade;
- farming và husbandry;
- utilities và defense;
- job assignment;
- companion/NPC autonomy;
- production chains và long-term resource planning.

### Ecology

Mục tiêu của ecology không chỉ là tạo “spawn table”.

Population, food availability, competition, carrying capacity, breeding, predation, reserve energy, hydrology và resource regeneration được mô phỏng như các state có thể thay đổi theo thời gian.

Khi một hệ thống mất cân bằng, ưu tiên của dự án là tìm **nguyên nhân cơ chế** trước khi chỉnh các hằng số như mortality, fecundity hoặc hunt success.

---

## Interface and presentation

Prototype sử dụng giao diện 2D top-down / elevated tactical view với theme rainforest survival.

Các khu vực UI chính hiện gồm:

- tactical world map;
- selected-location interaction;
- party / survivor management;
- inventory và storage;
- crafting / research / repair / upgrade;
- camp overview;
- building management;
- farming;
- utilities;
- encounter screen;
- weather, clock và environmental HUD.

Bản đồ có các lớp hiệu ứng như water shader, haze/fog, vegetation motion, ambient particles và day/night presentation. Visual fidelity vẫn đang được chỉnh liên tục và không phải mọi asset hiện tại đều là final art.

---

## Tech stack

- **React 19**
- **TypeScript 5.8**
- **Vite 6**
- **Tailwind CSS 4**
- **Lucide React**
- Canvas / shader-based map effects
- deterministic simulation scripts bằng TypeScript
- GitHub Actions cho regression và multi-year soak tests

---

## Quick start

Yêu cầu khuyến nghị:

- Node.js **22** cho môi trường giống CI hiện tại.
- npm.

Cài dependency:

```bash
npm ci
```

Chạy development server:

```bash
npm run dev
```

Mặc định Vite chạy tại:

```text
http://localhost:3000
```

Typecheck:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

Preview build:

```bash
npm run preview
```

---

## Simulation and regression tests

Repo có nhiều smoke test độc lập để tránh một thay đổi ở ecology, storage, hydrology hoặc building silently phá subsystem khác.

Một số test quan trọng:

```bash
npm run test:spatial-world
npm run test:spatial-fauna
npm run test:spatial-fauna-runtime
npm run test:spatial-fauna-competition
npm run test:spatial-fauna-resources

npm run test:spatial-predator-founders
npm run test:spatial-predator-p6
npm run test:spatial-predator-p7
npm run test:spatial-predator-p8

npm run test:spatial-trophic
npm run test:spatial-trophic-soak
```

Ngoài terrestrial ecology còn có regression cho:

- building/construction;
- storage/logistics;
- agriculture;
- hydrology;
- aquatic ecology;
- maintenance;
- production;
- save migration;
- environmental scale.

### Multi-year trophic soak

Long-run ecology test dùng deterministic seed và có thể chạy trực tiếp:

```bash
PREDATOR_P6_MODE=combined \
SPATIAL_TROPHIC_SEED=spatial-trophic-soak-alpha \
PREDATOR_P6_ASSERT=1 \
npm run test:spatial-trophic-soak
```

Seed beta:

```bash
PREDATOR_P6_MODE=combined \
SPATIAL_TROPHIC_SEED=spatial-trophic-soak-beta \
PREDATOR_P6_ASSERT=1 \
npm run test:spatial-trophic-soak
```

Các report dài hạn theo dõi population, demography, prey access, kill biomass, energy coverage, reserve, hunger risk, breeding connectivity, recovery pressure và các conservation/accounting invariants.

---

## Repository layout

```text
.
├── public/                     # Maps, POI art, UI art, weather cards, icons
├── docs/                       # Design and simulation documentation
├── scripts/                    # Smoke tests, soak tests and dev utilities
├── src/
│   ├── components/             # React UI
│   ├── data/                   # Authored game/ecology data
│   ├── encounter/              # Encounter runtime
│   ├── save/                   # Save and migration logic
│   ├── simulation/
│   │   └── spatial/            # Seeded spatial world/ecology runtime
│   ├── types/                  # TypeScript state contracts
│   └── utils/
├── .github/workflows/          # CI and long-run ecology workflows
├── package.json
└── vite.config.ts
```

Tài liệu kỹ thuật đáng chú ý:

- [Spatial world foundation](docs/spatial-world-foundation.md)
- [Spatial fauna community](docs/spatial-fauna-community.md)
- [Multi-year trophic soak](docs/spatial-trophic-multiyear-soak.md)
- [System architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Game design](docs/GAME_DESIGN.md)
- [Art bible](docs/ART_BIBLE.md)
- [Asset manifest](docs/ASSET_MANIFEST.md)

---

## Environment and secrets

Không commit credential thật vào repository.

`.gitignore` loại trừ:

```text
.env*
```

và chỉ giữ `.env.example` làm placeholder.

Nếu dùng các integration tùy chọn yêu cầu secret, hãy tạo file environment local hoặc dùng secret store của môi trường chạy. Không thay placeholder trong `.env.example` bằng API key thật.

Trước khi repository được public, codebase hiện tại đã được audit để tìm các mẫu phổ biến như API key, GitHub token, private key, JWT, credential assignment, email cá nhân và absolute home path.

---

## Assets and licensing

Repository hiện **chưa có project-wide LICENSE**.

Điều đó có nghĩa là việc repository có thể được xem công khai **không tự động cấp quyền tái sử dụng, phân phối hoặc relicensing toàn bộ source/art asset**.

Một số dependency như Lucide có license riêng của chúng. Các visual asset project-specific trong `public/` — bao gồm map art, POI imagery, weather cards, portraits, item/icon art và UI artwork — được tạo cho dự án bằng **ChatGPT / OpenAI image generation**. Không có stock-image pack hay third-party game-art pack nào được chủ ý đưa vào repo. Chi tiết provenance được ghi tại [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md).

Nếu sau này dự án được mở theo một open-source license cụ thể, source code và art assets có thể cần được cấp license riêng thay vì gom chung một license.

---

## Project status

Đây là **personal development project** và không có cam kết release schedule.

Các ưu tiên gần hiện tại:

- hoàn thiện authoritative spatial terrestrial ecology;
- kiểm chứng predator/prey equilibrium dài hạn;
- nối player gathering vào cùng material budget với ecology;
- làm rõ Local Site interaction;
- tiếp tục camp/crafting/assignment UI;
- mở rộng NPC/companion autonomy;
- tăng chiều sâu long-term colony simulation.

Những hệ thống hoặc asset trong repo có thể bị thay thế hoàn toàn nếu mô hình mới phù hợp hơn.

---

## Public-repo note

Mục tiêu khi để repo public là thuận tiện cho development, CI và việc theo dõi tiến độ của một project cá nhân — không phải biến dự án thành một package/API ổn định.

Expect breaking changes.

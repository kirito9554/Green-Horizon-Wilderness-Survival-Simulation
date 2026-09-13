# Kế hoạch Nâng cấp Toàn diện Đồ họa WebGL Shader (Shader Visual Overhaul Plan)

---

## 1. Mở rộng Hệ thống Uniform WebGL
**Mục tiêu**: Truyền các tham số thời tiết & thời gian từ `GameState` vào Shader Canvas trong `TacticalWorldMap.tsx`.

* **`uTimeOfDay`** ($0 - 1440\text{ phút}$): Vòng quay 24 giờ trong ngày.
* **`uRainIntensity`** ($0.0 - 1.0$): Cường độ mưa.
* **`uCloudCover`** ($0.0 - 1.0$): Độ phủ mây.
* **`uWindSpeed`** ($\text{km/h}$): Tốc độ gió.
* **`uWindDirection`** ($0^\circ - 360^\circ$): Hướng gió thực tế.

---

## 2. Overhaul Fragment Shader Môi trường (`MapAmbientEffects.tsx`)

### A. Tông màu Ánh sáng Ngày/Đêm GLSL (Time-of-Day Fragment Color Grading)
Mã hóa trực tiếp nhịp sinh học ánh sáng nhiệt đới trong Fragment Shader:
* **Bình minh ($05:00 - 08:00$)**: Tông nắng cam hổ phách (Golden Dawn Warmth), độ tương phản mềm dịu.
* **Giữa trưa ($10:00 - 15:00$)**: Nắng nhiệt đới rực rỡ, độ bão hòa màu cao, bóng râm sắc nét.
* **Hoàng hôn ($16:30 - 19:00$)**: Tông tím đỏ hổ phách (Crimson Amber Twilight), ánh mặt trời tà nghiêng góc.
* **Đêm tối ($19:00 - 04:30$)**: Tông xanh xám đêm huyền bí (Deep Oceanic Night).
  * **Chế độ Lửa đêm (Local Light Well)**: shader tạo quầng sáng ấm tỏa tròn (Radial Light Mask) tại vị trí Đống Lửa Trại (`CAMPFIRE`), giúp ánh lửa bùng sáng rực rỡ và chân thực giữa đêm tối.

### B. Mưa rơi Xiên góc & Mây trôi Động lực học (Wind-Driven Rain & Volumetric Clouds)
* **Vệt mưa nghiêng theo gió**: Hạt mưa rơi xiên góc theo véc-tơ gió $\vec{w} = (\cos\theta, \sin\theta)$ với vận tốc tỉ lệ thuận với `uWindSpeed`.
* **Mây FBM xoáy theo gió**: Tầng mây sương cuộn trôi mượt mà theo véc-tơ gió thực tế.
* **Lá rơi & Khói lửa trại**: Tạt nghiêng tự nhiên theo hướng gió.

---

## 3. Overhaul Fragment Shader Mặt nước (`MapWaterShader.tsx`)

* **Gợn sóng Giọt mưa (Rain Ripple Rings)**: Khi `uRainIntensity > 0`, trên mặt nước xuất hiện các vòng gợn sóng tròn nhấp nháy tan dần.
* **Sóng biển & Dòng chảy tạt theo Gió**:
  * Hướng xô sóng của mặt nước xoay theo góc `uWindDirection`.
  * Khi tốc độ gió cao ($> 50\text{ km/h}$ - Mưa to/Bão), biên độ sóng tăng và tạo bọt nước trắng xóa (Storm Water Foam).

---

## 4. Quy trình Thực hiện & Đảm bảo Hiệu năng

1. **Pha 1**: Cập nhật `TacticalWorldMap.tsx` truyền đầy đủ các Uniforms mới vào canvas.
2. **Pha 2**: Nâng cấp GLSL trong `MapAmbientEffects.tsx` (Ngày/Đêm + Mưa xiên + Gió tạt + Lửa đêm).
3. **Pha 3**: Nâng cấp GLSL trong `MapWaterShader.tsx` (Vòng mưa chạm nước + Sóng tạt theo gió).
4. **Pha 4**: Kiểm thử biên dịch `compile_applet` và đảm bảo trải nghiệm 60 FPS.

# ASSET MANIFEST
## Green Horizon — Wilderness Survival Simulation

This document records the provenance of visual assets currently shipped with the project.

---

## 1. Asset provenance

| Category | Source | Licensing / provenance note |
| :--- | :--- | :--- |
| **System & action icons** | Lucide React Icons | Uses the upstream Lucide package and its license. |
| **Maps & biome visuals** | Generated specifically for this project with ChatGPT / OpenAI image generation | No stock-image or third-party art source was used for these project assets. |
| **POI backgrounds & cards** | Generated specifically for this project with ChatGPT / OpenAI image generation | Project-specific generated artwork. |
| **Weather cards** | Generated specifically for this project with ChatGPT / OpenAI image generation | Project-specific generated artwork. |
| **Raw-material & item icon art** | Generated specifically for this project with ChatGPT / OpenAI image generation | Project-specific generated artwork. |
| **Survivor portraits** | Generated specifically for this project with ChatGPT / OpenAI image generation | Project-specific generated artwork. |
| **UI background / decorative art** | Generated specifically for this project with ChatGPT / OpenAI image generation | Project-specific generated artwork. |
| **Code-based UI components** | In-repository React / CSS / Tailwind implementation | Covered only by whatever project source license is selected in the future. |

The current contents of `public/` are therefore either:

1. project-specific visuals generated with ChatGPT / OpenAI image generation; or
2. library-provided icons such as Lucide, which retain their upstream license.

No third-party stock-image pack, scraped artwork, commercial game asset pack, or externally sourced character artwork is intentionally included.

---

## 2. Lucide icons

UI navigation and status indicators use icons from `lucide-react`, including categories such as:

- survival and status;
- weather and time;
- inventory and resources;
- camp/building actions;
- navigation and management controls.

Lucide remains subject to its own upstream license and is not reclassified as project-generated art.

---

## 3. Public repository note

The repository currently has **no project-wide LICENSE**.

Making the repository public therefore documents and exposes the work, but does not by itself declare the source code or project-specific art assets to be released under an open-source or open-asset license.

If a project-wide license is added later, source code and generated art assets can be licensed separately if desired.

---

## 4. Adding future assets

Before committing a future visual asset:

- record its source if it was not generated specifically for Green Horizon;
- retain the original license/attribution when required;
- do not commit stock, copyrighted, or third-party game art without clear permission;
- prefer project-specific generated or original assets when possible.

If an externally sourced asset is ever introduced, this manifest should be updated with its exact provenance and license.

# Evaluation model policy

No separately distributed evaluation model is bundled or downloaded. The pinned YaneuraOu build uses `YANEURAOU_ENGINE_MATERIAL` with `MATERIAL_LEVEL=1`, compiled into the engine, and `public/models/` contains no model asset.

If an external model is added later, the change requires prior approval and must record:

- model name, format, exact upstream URL, author, and redistribution license;
- upstream revision or release date, uncompressed size, and SHA-256;
- whether modification, repackaging, and browser redistribution are allowed;
- exact loader path, memory requirements, and fallback behavior.

If redistribution rights cannot be confirmed, it must not be embedded in a release. Use an explicit user-supplied local model flow instead.

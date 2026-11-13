"""
Image processing utilities for YUV/RGB conversions, dimension extraction, and residual diffs.
Adheres to HEVC reference encoder data locality and full-range ITU-R BT.709 color standards.
"""
import os
import tempfile
from pathlib import Path
from PIL import Image, ImageChops
from app.core.config import settings

# Full-range ITU-R BT.709 RGB -> Y, Cb, Cr 4-tuple matrices for Pillow convert("L", matrix=...)
_BT709_Y_MATRIX = (0.2126, 0.7152, 0.0722, 0.0)
_BT709_CB_MATRIX = (-0.114572, -0.385428, 0.5, 128.0)
_BT709_CR_MATRIX = (0.5, -0.454153, -0.045847, 128.0)


def _atomic_save_png(img: Image.Image, target: Path) -> None:
    """Writes PNG atomically via temp file + os.replace to prevent partial reads."""
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{target.stem}_", suffix=".png", dir=str(target.parent))
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        img.save(tmp_path, format="PNG")
        os.replace(tmp_path, target)
    except Exception:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass
        raise


class ImageProcessor:
    """Encapsulates image operations, PIL transforms, and pixel matrix generation"""

    @staticmethod
    def read_image_dims(img_path: Path) -> tuple[int, int]:
        """Reads width & height with decompression bomb safeguards"""
        Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_PIXELS
        with Image.open(img_path) as img:
            return img.size

    @staticmethod
    def write_file_bytes(target: Path, data: bytes) -> None:
        """Writes binary data atomically to file on disk"""
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(prefix=f".{target.stem}_", suffix=target.suffix or ".tmp", dir=str(target.parent))
        os.close(fd)
        tmp_path = Path(tmp_name)
        try:
            with open(tmp_path, "wb") as f:
                f.write(data)
            os.replace(tmp_path, target)
        except Exception:
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except OSError:
                    pass
            raise

    @staticmethod
    def generate_residual_image(
        input_img: Path,
        recon_png: Path,
        residual_png: Path,
        gain: int,
        img_w: int,
        img_h: int
    ) -> None:
        """Generates visual residual difference image with configurable amplification gain"""
        if recon_png.exists():
            with Image.open(input_img) as orig_raw, Image.open(recon_png) as recon_raw:
                orig = orig_raw.convert("RGB")
                recon = recon_raw.convert("RGB")
                if orig.size != (img_w, img_h):
                    orig = orig.resize((img_w, img_h), Image.Resampling.LANCZOS)
                if recon.size != (img_w, img_h):
                    recon = recon.resize((img_w, img_h), Image.Resampling.NEAREST)
                diff = ImageChops.difference(orig, recon)
                if gain != 1:
                    diff = diff.point(lambda p: min(255, p * gain))
                _atomic_save_png(diff, residual_png)
        else:
            empty = Image.new("RGB", (img_w, img_h), (0, 0, 0))
            _atomic_save_png(empty, residual_png)

    @staticmethod
    def generate_prediction_image(
        input_img: Path,
        recon_png: Path,
        pred_png: Path,
        img_w: int,
        img_h: int,
        trace_path: Path | None = None,
    ) -> None:
        """
        Generates real HM Prediction image P from trace telemetry (INTRA_TU_PRED / RDO_INTRA_SEARCH).
        Never fabricates synthetic blur approximations; un-dumped regions remain neutral mid-gray (128).
        """
        from app.storage.trace_reader import trace_reader

        canvas = bytearray([128] * (img_w * img_h))
        wrote_samples = False

        if trace_path and trace_path.exists():
            def _blit_block(bx: int, by: int, bw: int, bh: int, samples: list[int]) -> None:
                nonlocal wrote_samples
                if bw <= 0 or bh <= 0 or len(samples) < bw * bh:
                    return
                for row in range(bh):
                    py = by + row
                    if py < 0 or py >= img_h:
                        continue
                    row_off = py * img_w
                    src_off = row * bw
                    for col in range(bw):
                        px = bx + col
                        if 0 <= px < img_w:
                            val = samples[src_off + col]
                            canvas[row_off + px] = 0 if val < 0 else (255 if val > 255 else int(val))
                wrote_samples = True

            # 1. Prefer winning INTRA_FULL_RDO trial -> INTRA_TU_PRED exact TU prediction blocks
            full_rdo = trace_reader.read_all(
                trace_path,
                event_filter="INTRA_FULL_RDO",
                predicate=lambda e: e.get("poc", 0) == 0 and bool(e.get("is_winner")),
            )
            winner_trials = {int(e["trial_id"]) for e in full_rdo if e.get("trial_id")}
            if winner_trials:
                tu_preds = trace_reader.read_all(
                    trace_path,
                    event_filter="INTRA_TU_PRED",
                    predicate=lambda e: e.get("poc", 0) == 0 and e.get("trial_id") in winner_trials,
                )
                for tu in tu_preds:
                    _blit_block(
                        int(tu.get("tu_x", 0)),
                        int(tu.get("tu_y", 0)),
                        int(tu.get("tu_width", 0)),
                        int(tu.get("tu_height", 0)),
                        tu.get("pred_data", []),
                    )

            # 2. Fallback to lowest-cost RDO_INTRA_SEARCH mode per PU if TU predictions weren't dumped
            if not wrote_samples:
                rmd_events = trace_reader.read_all(
                    trace_path,
                    event_filter="RDO_INTRA_SEARCH",
                    predicate=lambda e: e.get("poc", 0) == 0 and bool(e.get("pred_data")),
                )
                best_by_pu: dict[tuple[int, int, int], dict] = {}
                for ev in rmd_events:
                    px = int(ev.get("pu_x", ev.get("cu_x", 0)))
                    py = int(ev.get("pu_y", ev.get("cu_y", 0)))
                    psz = int(ev.get("pu_size", ev.get("cu_size", 8)))
                    key = (px, py, psz)
                    cur = best_by_pu.get(key)
                    if cur is None or float(ev.get("cost", float("inf"))) < float(cur.get("cost", float("inf"))):
                        best_by_pu[key] = ev
                for (px, py, psz), ev in best_by_pu.items():
                    _blit_block(px, py, psz, psz, ev.get("pred_data", []))

        pred_gray = Image.frombytes("L", (img_w, img_h), bytes(canvas))
        _atomic_save_png(pred_gray.convert("RGB"), pred_png)

    @staticmethod
    def generate_fallback_plane(
        input_img: Path,
        plane_png: Path,
        norm_type: str,
        img_w: int,
        img_h: int
    ) -> None:
        """Extracts normalized planar Y, Cb, or Cr image conforming to full-range ITU-R BT.709 and 4:2:0"""
        with Image.open(input_img) as img:
            rgb = img.convert("RGB")
            if rgb.size != (img_w, img_h):
                rgb = rgb.resize((img_w, img_h), Image.Resampling.LANCZOS)
            if norm_type == "y":
                plane = rgb.convert("L", _BT709_Y_MATRIX)
                _atomic_save_png(plane, plane_png)
            elif norm_type == "u":
                chroma_w = max(1, img_w // 2)
                chroma_h = max(1, img_h // 2)
                cb_plane = rgb.convert("L", _BT709_CB_MATRIX).resize((chroma_w, chroma_h), Image.Resampling.BOX)
                _atomic_save_png(cb_plane, plane_png)
            else:
                chroma_w = max(1, img_w // 2)
                chroma_h = max(1, img_h // 2)
                cr_plane = rgb.convert("L", _BT709_CR_MATRIX).resize((chroma_w, chroma_h), Image.Resampling.BOX)
                _atomic_save_png(cr_plane, plane_png)

image_processor = ImageProcessor()

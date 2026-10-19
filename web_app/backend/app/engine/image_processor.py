"""
Image processing utilities for YUV/RGB conversions, dimension extraction, and residual diffs.
Adheres to HEVC reference encoder data locality and BT.709 color standards.
"""
from pathlib import Path
from PIL import Image, ImageChops
from app.core.config import settings

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
        """Writes binary data to file on disk"""
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "wb") as f:
            f.write(data)

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
        residual_png.parent.mkdir(parents=True, exist_ok=True)
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
                diff.save(residual_png)
        else:
            empty = Image.new("RGB", (img_w, img_h), (0, 0, 0))
            empty.save(residual_png)

    @staticmethod
    def generate_fallback_plane(
        input_img: Path,
        plane_png: Path,
        norm_type: str,
        img_w: int,
        img_h: int
    ) -> None:
        """Extracts normalized planar Y, Cb, or Cr image conforming to 4:2:0 subsampling"""
        plane_png.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(input_img) as img:
            if img.size != (img_w, img_h):
                img = img.resize((img_w, img_h), Image.Resampling.LANCZOS)
            img_ycbcr = img.convert("YCbCr")
            y_plane, cb_plane, cr_plane = img_ycbcr.split()
            if norm_type == "y":
                y_plane.save(plane_png)
            elif norm_type == "u":
                chroma_w = max(1, img_w // 2)
                chroma_h = max(1, img_h // 2)
                cb_plane.resize((chroma_w, chroma_h), Image.Resampling.BOX).save(plane_png)
            else:
                chroma_w = max(1, img_w // 2)
                chroma_h = max(1, img_h // 2)
                cr_plane.resize((chroma_w, chroma_h), Image.Resampling.BOX).save(plane_png)

image_processor = ImageProcessor()

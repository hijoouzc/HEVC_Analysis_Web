import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from app.domain.models.job import JobInfo
from app.domain.models.roi import ROICoordinates, FrameMetadata
from app.domain.exceptions import JobNotFoundError
from app.services.job_manager import job_manager
from app.services.analysis_service import analysis_service
from app.storage.session_manager import session_manager
from app.engine.ffmpeg_adapter import ffmpeg_adapter
from app.engine.image_processor import image_processor
from app.core.config import settings

router = APIRouter()

async def read_and_validate_upload_file(file: UploadFile, max_bytes: int = settings.MAX_UPLOAD_SIZE) -> bytes:
    chunk_size = 65536
    total_read = 0
    buffer = bytearray()
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Uploaded file exceeds maximum permitted size of {max_bytes // (1024 * 1024)}MB."
            )
        buffer.extend(chunk)
    
    if len(buffer) < 8:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or corrupted.")

    is_png = buffer[:8] == b"\x89PNG\r\n\x1a\n"
    is_jpeg = buffer[:3] == b"\xff\xd8\xff"
    is_bmp = buffer[:2] == b"BM"
    is_webp = buffer[:4] == b"RIFF" and buffer[8:12] == b"WEBP"
    if not (is_png or is_jpeg or is_bmp or is_webp):
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Allowed formats: PNG, JPEG, BMP, WebP."
        )
    return bytes(buffer)

@router.post("/submit", response_model=JobInfo, status_code=202)
async def submit_analysis_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    ctu_x: int = Form(0),
    ctu_y: int = Form(0),
    cu_size: int = Form(0),
    scale_mode: str = Form("native"),
    all_ctus: bool = Form(False),
    profile: str = Form("all_intra"),
    frames: int = Form(1)
):
    try:
        content = await read_and_validate_upload_file(file)
        job_id = session_manager.create_session()
        input_image = session_manager.get_input_image_path(job_id)
        
        await asyncio.to_thread(_write_file_bytes, input_image, content)
            
        orig_w, orig_h = await asyncio.to_thread(_read_image_dims, input_image)
            
        ctu_size = settings.CTU_SIZE
        calc_w, calc_h = analysis_service.compute_frame_dimensions(orig_w, orig_h, scale_mode)

        num_ctu_w = (calc_w + ctu_size - 1) // ctu_size
        num_ctu_h = (calc_h + ctu_size - 1) // ctu_size

        is_all_ctus = all_ctus or ctu_x < 0 or ctu_y < 0
        target_ctu_x = -1 if is_all_ctus else max(0, min(ctu_x, max(0, num_ctu_w - 1)))
        target_ctu_y = -1 if is_all_ctus else max(0, min(ctu_y, max(0, num_ctu_h - 1)))
        clamped_frames = max(1, min(frames, 10))

        roi = ROICoordinates(
            ctu_x=target_ctu_x,
            ctu_y=target_ctu_y,
            cu_size=cu_size,
            all_ctus=is_all_ctus
        )
        frame_meta = FrameMetadata(
            width=calc_w,
            height=calc_h,
            aligned_width=calc_w,
            aligned_height=calc_h,
            max_ctu_x=max(0, num_ctu_w - 1),
            max_ctu_y=max(0, num_ctu_h - 1),
            ctu_size=ctu_size
        )
        
        job_info = await job_manager.create_job(
            roi=roi,
            frame=frame_meta,
            job_id=job_id,
            profile=profile,
            frames=clamped_frames
        )
        
        # Enqueue pipeline execution in background
        background_tasks.add_task(
            analysis_service.execute_analysis_pipeline,
            job_id=job_id,
            input_image_path=input_image,
            roi=roi,
            scale_mode=scale_mode,
            profile=profile,
            frames=clamped_frames
        )
        
        return job_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{job_id}", response_model=JobInfo)
async def get_job_status(job_id: str):
    try:
        return await job_manager.get_job(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

_write_file_bytes = image_processor.write_file_bytes
_read_image_dims = image_processor.read_image_dims
_generate_residual_image = image_processor.generate_residual_image
_generate_prediction_image = image_processor.generate_prediction_image
_generate_fallback_plane = image_processor.generate_fallback_plane

@router.get("/{job_id}/images/{image_type}")
async def get_job_image(job_id: str, image_type: str, gain: int = 4):
    """
    Serves generated images for an analysis job:
    image_type: 'original', 'reconstructed', 'residual', 'prediction', 'y', 'u', 'v'
    """
    try:
        session_dir = session_manager.get_session_dir(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    input_img = session_manager.get_input_image_path(job_id)
    if not input_img.exists():
        raise HTTPException(status_code=404, detail="Input image not found for this job.")

    # Determine aligned YUV dimensions from job metadata (HM standard)
    try:
        job = await job_manager.get_job(job_id)
        img_w = job.frame.aligned_width
        img_h = job.frame.aligned_height
    except Exception:
        orig_w, orig_h = await asyncio.to_thread(_read_image_dims, input_img)
        img_w = max(64, round(orig_w / 8) * 8)
        img_h = max(64, round(orig_h / 8) * 8)

    norm_type = image_type.lower().strip()

    if norm_type == "original":
        return FileResponse(input_img, media_type="image/png")

    recon_png = session_manager.get_recon_image_path(job_id)
    recon_yuv = session_manager.get_recon_yuv_path(job_id)

    if norm_type == "reconstructed":
        if recon_png.exists():
            return FileResponse(recon_png, media_type="image/png")
        if recon_yuv.exists():
            await ffmpeg_adapter.convert_yuv_to_png(recon_yuv, recon_png, img_w, img_h)
            if recon_png.exists():
                return FileResponse(recon_png, media_type="image/png")
        # Fallback to original if reconstructed is not yet generated
        return FileResponse(input_img, media_type="image/png")

    if norm_type == "residual":
        residual_png = session_dir / f"residual_gain{gain}.png"
        if residual_png.exists():
            return FileResponse(residual_png, media_type="image/png")

        # Ensure we have recon_png
        if not recon_png.exists() and recon_yuv.exists():
            await ffmpeg_adapter.convert_yuv_to_png(recon_yuv, recon_png, img_w, img_h)

        await asyncio.to_thread(
            _generate_residual_image,
            input_img,
            recon_png,
            residual_png,
            gain,
            img_w,
            img_h
        )
        return FileResponse(residual_png, media_type="image/png")

    if norm_type == "prediction":
        pred_png = session_dir / "prediction.png"
        if pred_png.exists():
            return FileResponse(pred_png, media_type="image/png")

        # Ensure we have recon_png
        if not recon_png.exists() and recon_yuv.exists():
            await ffmpeg_adapter.convert_yuv_to_png(recon_yuv, recon_png, img_w, img_h)

        await asyncio.to_thread(
            _generate_prediction_image,
            input_img,
            recon_png,
            pred_png,
            img_w,
            img_h
        )
        return FileResponse(pred_png, media_type="image/png")

    if norm_type in ["y", "u", "v"]:
        plane_png = session_dir / f"plane_{norm_type}.png"
        if plane_png.exists():
            return FileResponse(plane_png, media_type="image/png")

        input_yuv = session_manager.get_yuv_path(job_id)
        if input_yuv.exists():
            planes = await ffmpeg_adapter.extract_yuv_planes(input_yuv, session_dir, img_w, img_h)
            if norm_type in planes and planes[norm_type].exists():
                return FileResponse(planes[norm_type], media_type="image/png")

        # Fallback plane generation via PIL native YCbCr split in thread
        await asyncio.to_thread(_generate_fallback_plane, input_img, plane_png, norm_type, img_w, img_h)
        return FileResponse(plane_png, media_type="image/png")

    raise HTTPException(status_code=400, detail=f"Unsupported image type: {image_type}")

@router.get("", response_model=list[JobInfo])
async def list_jobs():
    return await job_manager.list_jobs()

import pytest
from pathlib import Path
from app.domain.exceptions import JobNotFoundError

def test_session_manager_create_and_paths(temp_session_manager):
    job_id = temp_session_manager.create_session("job_test_123")
    assert job_id == "job_test_123"
    
    session_dir = temp_session_manager.get_session_dir(job_id)
    assert session_dir.exists()
    assert session_dir.is_dir()
    
    input_img = temp_session_manager.get_input_image_path(job_id)
    assert input_img.name == "input_image.png"
    assert input_img.parent == session_dir
    
    yuv_path = temp_session_manager.get_yuv_path(job_id)
    assert yuv_path.name == "input.yuv"
    
    trace_path = temp_session_manager.get_trace_path(job_id)
    assert trace_path.name == "trace.jsonl"

def test_session_manager_nonexistent_job(temp_session_manager):
    with pytest.raises(JobNotFoundError):
        temp_session_manager.get_session_dir("non_existent_id")

def test_session_manager_cleanup(temp_session_manager):
    job_id = temp_session_manager.create_session("job_to_clean")
    session_dir = temp_session_manager.get_session_dir(job_id)
    assert session_dir.exists()
    
    temp_session_manager.cleanup_session(job_id)
    assert not session_dir.exists()

def test_session_manager_cleanup_old_sessions(temp_session_manager):
    import os
    import time

    # Create 3 sessions
    id1 = temp_session_manager.create_session("old_session_1")
    id2 = temp_session_manager.create_session("old_session_2")
    id3 = temp_session_manager.create_session("recent_session_3")

    dir1 = temp_session_manager.get_session_dir(id1)
    dir2 = temp_session_manager.get_session_dir(id2)
    dir3 = temp_session_manager.get_session_dir(id3)

    # Set mtime for id1 and id2 to 48 hours ago
    old_time = time.time() - (48 * 3600)
    os.utime(dir1, (old_time, old_time))
    os.utime(dir2, (old_time, old_time))

    # Prune sessions older than 24h, keeping at most 2
    deleted = temp_session_manager.cleanup_old_sessions(max_age_hours=24, max_keep=2)
    assert deleted == 2
    assert not dir1.exists()
    assert not dir2.exists()
    assert dir3.exists()

@pytest.mark.anyio
async def test_job_manager_memory_pruning():
    from app.services.job_manager import JobManager
    from app.domain.models.roi import ROICoordinates, FrameMetadata
    from app.domain.enums import JobStatus

    jm = JobManager()
    jm._MAX_JOBS = 5
    jm._PRUNE_TARGET = 3

    roi = ROICoordinates()
    frame = FrameMetadata(width=64, height=64, aligned_width=64, aligned_height=64, max_ctu_x=0, max_ctu_y=0)

    # Create 5 completed jobs
    for i in range(5):
        j = await jm.create_job(roi=roi, frame=frame, job_id=f"job_{i}")
        await jm.update_status(f"job_{i}", JobStatus.COMPLETED)

    assert len(jm._jobs) == 5

    # Creating the 6th job triggers memory pruning
    await jm.create_job(roi=roi, frame=frame, job_id="job_trigger")
    # Should prune completed down to PRUNE_TARGET (3) + 1 new = 4
    assert len(jm._jobs) <= 4

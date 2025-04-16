import os
os.environ["OPENCV_AVFOUNDATION_SKIP_AUTH"] = "1"  # Prevents OpenCV GUI errors
os.environ["QT_QPA_PLATFORM"] = "offscreen"  # Ensures OpenCV does not use a GUI-based backend

import cv2
import numpy as np
import tempfile
import base64
import uuid
from io import BytesIO
from typing import List, Optional, Dict
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image, ImageDraw
from ultralytics import YOLO
import glob
import os.path
import time

# Initialize FastAPI app
app = FastAPI(
    title="Underwater Trash Detection API",
    description="API for detecting underwater trash using YOLO model",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Create videos directory if it doesn't exist
os.makedirs("videos", exist_ok=True)

# Mount static files directory
app.mount("/videos", StaticFiles(directory="videos"), name="videos")

# Define the categories
hazardous_trash = {"trash_metal", "trash_rubber", "trash_fishing_gear", "trash_plastic"}
non_hazardous_trash = {"trash_etc", "trash_fabric", "trash_paper", "trash_wood"}
aquatic_life = {"animal_fish", "animal_starfish", "animal_shells", "animal_crab", "animal_eel", "animal_etc", "plant"}

# Response models
class Detection(BaseModel):
    class_name: str
    confidence: float
    x1: int
    y1: int
    x2: int
    y2: int
    category: str
    location: str

class ImageResponse(BaseModel):
    processed_image: str  # Base64 encoded image
    detections: List[Detection]
    detection_count: int

class MultipleImagesResponse(BaseModel):
    video_url: str  # URL to processed video
    detection_count: int
    frame_count: int

class VideoInfo(BaseModel):
    id: str
    url: str
    created_at: float
    file_size: int  # Size in bytes

# Load YOLO Model
model = None

@app.on_event("startup")
async def startup_event():
    global model
    model = YOLO("best.pt")

def get_location(x1, y1, x2, y2, img_width, img_height):
    center_x, center_y = (x1 + x2) // 2, (y1 + y2) // 2
    vertical_pos = "top" if center_y < img_height // 3 else "bottom" if center_y > 2 * (img_height // 3) else "center"
    horizontal_pos = "left" if center_x < img_width // 3 else "right" if center_x > 2 * (img_width // 3) else "center"
    return f"{vertical_pos} {horizontal_pos}" if vertical_pos != "center" or horizontal_pos != "center" else "center"

def get_category(class_name):
    if class_name in hazardous_trash:
        return "hazardous_trash"
    elif class_name in non_hazardous_trash:
        return "non_hazardous_trash"
    elif class_name in aquatic_life:
        return "aquatic_life"
    else:
        return "unknown"

def process_image(image, confidence_threshold=0.5):
    global model
    results = model(image)
    detections = []
    img_height, img_width = image.shape[:2]
    
    for r in results:
        for box in r.boxes:
            conf = box.conf[0].item()
            if conf < confidence_threshold:
                continue
                
            class_id = int(box.cls[0])
            class_name = model.names[class_id]
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            
            # Draw on image
            color = (0, 255, 0) if class_name in aquatic_life else (0, 0, 255) if class_name in non_hazardous_trash else (0, 0, 255)
            cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
            text = f"{class_name} ({conf:.2f})"
            cv2.putText(image, text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            # Add to detections
            location = get_location(x1, y1, x2, y2, img_width, img_height)
            category = get_category(class_name)
            
            detections.append(Detection(
                class_name=class_name,
                confidence=conf,
                x1=x1, y1=y1, x2=x2, y2=y2,
                category=category,
                location=location
            ))
    
    return image, detections

def encode_image_to_base64(image):
    # Convert OpenCV image to PIL Image
    if isinstance(image, np.ndarray):
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(image)
    else:
        pil_image = image
    
    # Save to buffer
    buffer = BytesIO()
    pil_image.save(buffer, format="JPEG")
    
    # Encode to base64
    img_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/jpeg;base64,{img_str}"

@app.post("/detect/image", response_model=ImageResponse)
async def detect_image(
    file: UploadFile = File(...),
    confidence_threshold: float = Form(0.5)
):
    # Check if the uploaded file is an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image")
    
    # Read and process the image
    contents = await file.read()
    np_arr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Could not read the image")
    
    # Process the image
    processed_img, detections = process_image(img, confidence_threshold)
    
    # Encode the processed image to base64
    encoded_img = encode_image_to_base64(processed_img)
    
    # Return the results
    return ImageResponse(
        processed_image=encoded_img,
        detections=detections,
        detection_count=len(detections)
    )

@app.post("/detect/multiple", response_model=MultipleImagesResponse)
async def detect_multiple_images(
    files: List[UploadFile] = File(...),
    confidence_threshold: float = Form(0.5),
    fps: int = Form(5)
):
    # Check if there are any files
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Process all images
    frames = []
    total_detections = 0
    
    for file in files:
        if not file.content_type.startswith("image/"):
            continue
            
        contents = await file.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            continue
            
        processed_img, detections = process_image(img, confidence_threshold)
        frames.append(processed_img)
        total_detections += len(detections)
    
    if not frames:
        raise HTTPException(status_code=400, detail="No valid images were processed")
    
    # Generate a video file with a unique name
    import imageio
    video_filename = f"{uuid.uuid4()}.mp4"
    video_path = os.path.join("videos", video_filename)
    
    writer = imageio.get_writer(video_path, fps=fps)
    
    for frame in frames:
        writer.append_data(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    
    writer.close()
    
    # Return the URL that can be accessed through the web
    video_url = f"/videos/{video_filename}"
    
    return MultipleImagesResponse(
        video_url=video_url,
        detection_count=total_detections,
        frame_count=len(frames)
    )

@app.get("/videos", response_model=List[VideoInfo])
def list_videos():
    """List all available videos in the videos directory."""
    videos = []
    video_files = glob.glob(os.path.join("videos", "*.mp4"))
    
    for video_path in video_files:
        file_name = os.path.basename(video_path)
        video_id = os.path.splitext(file_name)[0]
        stats = os.stat(video_path)
        
        videos.append(VideoInfo(
            id=video_id,
            url=f"/videos/{file_name}",
            created_at=stats.st_mtime,
            file_size=stats.st_size
        ))
    
    # Sort by creation time, newest first
    videos.sort(key=lambda x: x.created_at, reverse=True)
    
    return videos

@app.get("/")
def read_root():
    return {"status": "Underwater Trash Detection API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 
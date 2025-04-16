import React, { useState, useRef, useEffect } from 'react';
import { Info, Upload, Trash2, Play, Camera, FileVideo, Image as ImageIcon, Clock, Film, Loader2 } from 'lucide-react';
import SeaTrashSection from './SeaTrashSection';
import { apiClient, Detection, VideoInfo } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { formatRelativeTime } from '@/lib/utils';

const DetectionTool = () => {
  const [activeTab, setActiveTab] = useState<string>("image");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);
  const [fps, setFps] = useState<number>(5);
  const [loadingVideos, setLoadingVideos] = useState<boolean>(false);
  const [recentVideos, setRecentVideos] = useState<VideoInfo[]>([]);
  
  // Single image state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  
  // Multiple images state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagesPreviews, setImagesPreviews] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // Refs
  const singleImageInputRef = useRef<HTMLInputElement>(null);
  const multipleImagesInputRef = useRef<HTMLInputElement>(null);
  const videoSectionRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();

  // Fetch recent videos on initial load
  useEffect(() => {
    fetchRecentVideos();
  }, []);

  // Fetch recent videos when a new video is created
  useEffect(() => {
    if (videoUrl) {
      fetchRecentVideos();
      // Scroll to the video section
      setTimeout(() => {
        if (videoSectionRef.current) {
          videoSectionRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  }, [videoUrl]);

  const fetchRecentVideos = async () => {
    setLoadingVideos(true);
    try {
      const videos = await apiClient.getVideos();
      setRecentVideos(videos.slice(0, 6)); // Show up to 6 recent videos
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoadingVideos(false);
    }
  };
  
  // Handle single image selection
  const handleSingleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Reset processed data
      setProcessedImage(null);
      setDetections([]);
    }
  };

  // Handle multiple images selection
  const handleMultipleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedImages(files);
      
      // Create previews
      const previews: string[] = [];
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            previews.push(event.target.result as string);
            if (previews.length === files.length) {
              setImagesPreviews([...previews]);
            }
          }
        };
        reader.readAsDataURL(file);
      });
      
      // Reset processed data
      setVideoUrl(null);
    }
  };

  // Process single image
  const processSingleImage = async () => {
    if (!selectedImage) {
      toast({
        title: "No image selected",
        description: "Please select an image to process",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const response = await apiClient.detectImage(selectedImage, confidenceThreshold);
      setProcessedImage(response.processed_image);
      setDetections(response.detections);
      
      toast({
        title: "Image processed successfully",
        description: `Detected ${response.detection_count} objects`,
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Error processing image",
        description: "There was an error processing your image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process multiple images
  const processMultipleImages = async () => {
    if (selectedImages.length === 0) {
      toast({
        title: "No images selected",
        description: "Please select images to process",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const response = await apiClient.processMultipleImages(
        selectedImages,
        confidenceThreshold,
        fps
      );
      
      setVideoUrl(response.video_url);
      
      toast({
        title: "Images processed successfully",
        description: `Created video with ${response.frame_count} frames and detected ${response.detection_count} objects`,
      });
    } catch (error) {
      console.error('Error processing images:', error);
      toast({
        title: "Error processing images",
        description: "There was an error processing your images. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear selected data
  const clearSingleImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setProcessedImage(null);
    setDetections([]);
    if (singleImageInputRef.current) {
      singleImageInputRef.current.value = '';
    }
  };

  const clearMultipleImages = () => {
    setSelectedImages([]);
    setImagesPreviews([]);
    setVideoUrl(null);
    if (multipleImagesInputRef.current) {
      multipleImagesInputRef.current.value = '';
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="mb-12">
      <SeaTrashSection icon={Info} title="Sea Trash Detection Tool">
        <p className="text-muted-foreground mb-6">
          Our AI-powered tool helps identify various types of marine debris in images. 
          Upload your own images or use the sample images to see the detection in action.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-secondary/30 rounded-lg p-4 hover:bg-secondary/40 transition-colors">
            <div className="flex items-center mb-2">
              <span className="bg-ocean/10 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                <span className="text-ocean font-medium">1</span>
              </span>
              <p className="font-medium">Choose Detection Type</p>
            </div>
            <p className="text-muted-foreground text-sm">Select whether you want to process a single image or multiple frames for video creation.</p>
          </div>
          
          <div className="bg-secondary/30 rounded-lg p-4 hover:bg-secondary/40 transition-colors">
            <div className="flex items-center mb-2">
              <span className="bg-ocean/10 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                <span className="text-ocean font-medium">2</span>
              </span>
              <p className="font-medium">Upload Image(s)</p>
            </div>
            <p className="text-muted-foreground text-sm">Click the "Upload" button to select an image of ocean trash or marine debris.</p>
          </div>
          
          <div className="bg-secondary/30 rounded-lg p-4 hover:bg-secondary/40 transition-colors">
            <div className="flex items-center mb-2">
              <span className="bg-ocean/10 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                <span className="text-ocean font-medium">3</span>
              </span>
              <p className="font-medium">Adjust Parameters</p>
            </div>
            <p className="text-muted-foreground text-sm">Set the confidence threshold and FPS (for video) according to your needs.</p>
          </div>
          
          <div className="bg-secondary/30 rounded-lg p-4 hover:bg-secondary/40 transition-colors">
            <div className="flex items-center mb-2">
              <span className="bg-ocean/10 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                <span className="text-ocean font-medium">4</span>
              </span>
              <p className="font-medium">Process</p>
            </div>
            <p className="text-muted-foreground text-sm">Click "Process" button to analyze the image(s) and detect marine debris.</p>
          </div>
          
          <div className="bg-secondary/30 rounded-lg p-4 hover:bg-secondary/40 transition-colors">
            <div className="flex items-center mb-2">
              <span className="bg-ocean/10 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                <span className="text-ocean font-medium">5</span>
              </span>
              <p className="font-medium">View Results</p>
            </div>
            <p className="text-muted-foreground text-sm">See the processed image with bounding boxes or your processed video.</p>
          </div>
        </div>
      </SeaTrashSection>
      
      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="p-4 border-b border-border">
          <Tabs defaultValue="image" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="image" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span>Single Image</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-2">
                <FileVideo className="w-4 h-4" />
                <span>Multiple Frames</span>
              </TabsTrigger>
              <TabsTrigger value="realtime" className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span>Realtime</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Common confidence threshold slider */}
            <div className="mt-6 space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Confidence Threshold: {confidenceThreshold.toFixed(2)}</label>
              </div>
              <Slider 
                min={0.1} 
                max={1.0} 
                step={0.05} 
                value={[confidenceThreshold]} 
                onValueChange={(values) => setConfidenceThreshold(values[0])} 
              />
            </div>
            
            {/* Single Image Content */}
            <TabsContent value="image" className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div 
                    className="border-2 border-dashed border-border rounded-lg h-72 flex flex-col items-center justify-center p-4 hover:bg-secondary/5 transition-colors cursor-pointer"
                    onClick={() => singleImageInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-contain"
                        />
                        <button 
                          className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearSingleImage();
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                        <p className="text-center text-muted-foreground">
                          Drag & drop an image here or click to browse
                        </p>
                      </>
                    )}
                    <input 
                      type="file"
                      ref={singleImageInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleSingleImageChange}
                    />
                  </div>
                  <div className="flex justify-center mt-4">
                    <Button 
                      onClick={processSingleImage} 
                      className="bg-ocean hover:bg-ocean/90"
                      disabled={!selectedImage || isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : 'Process Image'}
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="border-2 border-border rounded-lg h-72 flex items-center justify-center p-4 bg-secondary/5 relative">
                    {processedImage ? (
                      <img 
                        src={processedImage} 
                        alt="Processed" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <p className="text-center text-muted-foreground">
                        Processed image will appear here
                      </p>
                    )}
                  </div>
                  {detections.length > 0 && (
                    <div className="mt-4 p-4 border border-border rounded-lg bg-secondary/5 max-h-40 overflow-y-auto">
                      <p className="font-medium mb-2">Detections: {detections.length}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {detections.map((detection, index) => (
                          <div key={index} className="text-xs p-2 border border-border rounded bg-background">
                            <div className="font-medium">{detection.class_name}</div>
                            <div className="text-muted-foreground">Confidence: {(detection.confidence * 100).toFixed(1)}%</div>
                            <div className="text-muted-foreground">Category: {detection.category}</div>
                            <div className="text-muted-foreground">Location: {detection.location}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Multiple Images Content */}
            <TabsContent value="video" className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex flex-col">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Frames Per Second (FPS): {fps}</label>
                    </div>
                    <Slider 
                      min={1} 
                      max={30} 
                      step={1} 
                      value={[fps]} 
                      onValueChange={(values) => setFps(values[0])} 
                    />
                  </div>
                  
                  <div 
                    className="border-2 border-dashed border-border rounded-lg h-48 flex flex-col items-center justify-center p-4 hover:bg-secondary/5 transition-colors cursor-pointer"
                    onClick={() => multipleImagesInputRef.current?.click()}
                  >
                    <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                    <p className="text-center text-muted-foreground">
                      Upload multiple images to create a video
                    </p>
                    <p className="text-center text-muted-foreground text-xs mt-1">
                      {selectedImages.length > 0 ? `${selectedImages.length} images selected` : 'No images selected'}
                    </p>
                    <input 
                      type="file"
                      ref={multipleImagesInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleMultipleImagesChange}
                    />
                  </div>
                  
                  {imagesPreviews.length > 0 && (
                    <div className="mt-4 flex-grow flex flex-col">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Selected Images ({imagesPreviews.length})</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive"
                          onClick={clearMultipleImages}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Clear All
                        </Button>
                      </div>
                      <div className="border border-border rounded-lg p-2 h-32 overflow-y-auto">
                        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-5 lg:grid-cols-7 gap-2">
                          {imagesPreviews.map((preview, index) => (
                            <div key={index} className="relative aspect-square border border-border rounded overflow-hidden bg-card/30 group">
                              <img 
                                src={preview} 
                                alt={`Preview ${index}`} 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-background/80 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                                  {index + 1}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-center mt-auto pt-4">
                    <Button 
                      onClick={processMultipleImages} 
                      className="bg-ocean hover:bg-ocean/90 w-full md:w-auto"
                      disabled={selectedImages.length === 0 || isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : 'Create Video'}
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="border-2 border-border rounded-lg h-72 flex flex-col items-center justify-center p-4 bg-secondary/5">
                    {videoUrl ? (
                      <div className="w-full h-full flex flex-col">
                        <video 
                          src={videoUrl} 
                          controls 
                          className="w-full h-full object-contain" 
                          onError={(e) => {
                            console.error('Video error:', e);
                            toast({
                              title: "Video Error",
                              description: "There was an error loading the video. Please try again.",
                              variant: "destructive"
                            });
                          }}
                        />
                        <a 
                          href={videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-ocean hover:underline mt-2 text-center"
                        >
                          Open video in new tab
                        </a>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Play className="w-10 h-10 text-muted-foreground mb-2 mx-auto" />
                        <p className="text-muted-foreground">
                          Processed video will appear here
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Realtime Processing Content */}
            <TabsContent value="realtime" className="mt-4 space-y-4">
              <div className="border-2 border-border rounded-lg p-8 text-center">
                <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Realtime Processing Coming Soon</h3>
                <p className="text-muted-foreground mb-4">
                  This feature will allow you to process webcam footage in real-time.
                  We're still working on it - check back soon!
                </p>
                <Button disabled>
                  Start Camera (Not Available)
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Recent Videos Section */}
      <div ref={videoSectionRef} className="mt-12">
        <SeaTrashSection icon={Film} title="Recent Processed Videos">
          <p className="text-muted-foreground mb-6">
            Browse and view your recently processed sea trash detection videos.
          </p>

          {loadingVideos ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-ocean animate-spin" />
              <span className="ml-3 text-muted-foreground">Loading videos...</span>
            </div>
          ) : recentVideos.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recentVideos.map((video) => (
                  <div 
                    key={video.id} 
                    className="border border-border rounded-lg overflow-hidden bg-card/30 hover:bg-card/50 transition-colors group shadow-sm hover:shadow-md"
                  >
                    <div className="relative aspect-video bg-background/50">
                      <video 
                        src={video.url} 
                        className="w-full h-full object-cover"
                        onMouseOver={(e) => e.currentTarget.play()}
                        onMouseOut={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="p-3 w-full">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-white">Video {video.id.substring(0, 6)}</span>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="secondary"
                                className="bg-ocean/10 text-ocean hover:bg-ocean/20"
                                asChild
                              >
                                <a href={video.url} target="_blank" rel="noopener noreferrer">
                                  Play
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 bg-background/70 text-xs px-2 py-1 rounded-full">
                        {formatFileSize(video.file_size)}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatRelativeTime(new Date(video.created_at * 1000))}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          asChild
                        >
                          <a href={video.url} download>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground hover:text-foreground">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 text-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchRecentVideos}
                  className="text-muted-foreground"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M21 2v6h-6"></path>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                    <path d="M3 22v-6h6"></path>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                  </svg>
                  Refresh Videos
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
              <FileVideo className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No videos yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Process multiple frames using the "Multiple Frames" tab above to create your first detection video.
              </p>
              <Button 
                variant="outline"
                onClick={() => setActiveTab("video")}
                className="bg-ocean/10 text-ocean hover:bg-ocean/20 border-ocean/20"
              >
                Try Multiple Frames Detection
              </Button>
            </div>
          )}
        </SeaTrashSection>
      </div>
    </div>
  );
};

export default DetectionTool;

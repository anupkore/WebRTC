import Slider from 'rc-slider';
import React, { useState, useEffect, useRef } from 'react';
import { Bars } from 'react-loader-spinner';
import { useParams } from 'react-router-dom';
import 'rc-slider/assets/index.css';

const Recordings = () => {
  const { appointmentId } = useParams();
  const [video1, setVideo1] = useState(null);
  const [video2, setVideo2] = useState(null);
  const videoRef1 = useRef(null);
  const videoRef2 = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [syncInterval, setSyncInterval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
 

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response1 = await fetch(`https://192.168.1.206:30002/api/documentation/video-recordings/${appointmentId}/doctor-stream`);
        const videoBlob1 = await response1.blob();
        setVideo1(URL.createObjectURL(videoBlob1));

        const response2 = await fetch(`https://192.168.1.206:30002/api/documentation/video-recordings/${appointmentId}/patient-stream`);
        const videoBlob2 = await response2.blob();
        setVideo2(URL.createObjectURL(videoBlob2));
      } catch (error) {
        console.error('Error fetching videos:', error);
      }
      setLoading(false);
    };

    fetchVideos();

    return () => {
      if (video1) {
        URL.revokeObjectURL(video1);
      }
      if (video2) {
        URL.revokeObjectURL(video2);
      }
      clearInterval(syncInterval);
    };
  }, [appointmentId]);

  useEffect(() => {
    if (!isPlaying) {
      clearInterval(syncInterval);
    }
  }, [isPlaying]);

  const handlePlay = () => {
    const video1Element = videoRef1.current;
    const video2Element = videoRef2.current;

    video1Element.play();
    video2Element.play();
    setIsPlaying(true);

    const intervalId = setInterval(() => {
      if (!isSeeking) {
        const currentTime = video1Element.currentTime;
        video2Element.currentTime = currentTime;
    
      }
    }, 100); // Adjust the interval as needed

    setSyncInterval(intervalId);
  };

  const handlePause = () => {
    const video1Element = videoRef1.current;
    const video2Element = videoRef2.current;

    video1Element.pause();
    video2Element.pause();
    setIsPlaying(false);

    clearInterval(syncInterval);
  };

  useEffect(() => {
    if(!loading){
    const video1Element = videoRef1.current;
      const updateCurrentTime = () => {
        setCurrentTime(video1Element.currentTime);
      };
  
      const handleLoadedMetadata = () => {
        setCurrentTime(video1Element.currentTime);
      };
  
      video1Element.addEventListener('timeupdate', updateCurrentTime);
      video1Element.addEventListener('loadedmetadata', handleLoadedMetadata);
  
      // Set the initial currentTime state if video duration is available
      if (video1Element.duration && !isNaN(video1Element.duration)) {
        setCurrentTime(video1Element.currentTime);
      }
  
      return () => {
        video1Element.removeEventListener('timeupdate', updateCurrentTime);
        video1Element.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [loading]);
  
  

  const handleSliderChange = (value) => {
    const video1Element = videoRef1.current;
    const video2Element = videoRef2.current;
    video1Element.currentTime = value;
    video2Element.currentTime = value;
    setCurrentTime(value);
  };

 
  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
  };

  const handleJumpForward = () => {
    const video1Element = videoRef1.current;
    const video2Element = videoRef2.current;

    const currentTime1 = video1Element.currentTime + 10;
    const currentTime2 = video2Element.currentTime + 10;

    video1Element.currentTime = currentTime1;
    video2Element.currentTime = currentTime2;
    
  };

  const handleJumpBackward = () => {
    const video1Element = videoRef1.current;
    const video2Element = videoRef2.current;

    const currentTime1 = Math.max(video1Element.currentTime - 10, 0);
    const currentTime2 = Math.max(video2Element.currentTime - 10, 0);

    video1Element.currentTime = currentTime1;
    video2Element.currentTime = currentTime2;
    
  };

  const handleRestart = () => {
    const video1Element = videoRef1.current;
    const video2Element = videoRef2.current;

    video1Element.currentTime = 0;
    video2Element.currentTime = 0;
    
  };

  
  return (
    <div style={{backgroundImage: `url(https://img.freepik.com/premium-vector/technology-background-web-connection-background-connection-background_759274-328.jpg?w=1060)`,backgroundSize:"cover", filter:"blur"}}>


        <div className='text-center mb-3'>
            <img src="/icons/SiteLogo.png" style={{"width":"400px","height":"90px"}}/>
              {/* <h2 className="text-dark">ArogyaMandi</h2> */}
              <h5 className="text-dark">Video Recordings Platform</h5>
        </div>




      {loading ? (
      <div className='mt-5'>
        <div className='d-flex justify-content-center align-items-center'>
          <h3>Fetching Your Recording. Please Wait</h3>
        </div>
        <div className='d-flex justify-content-center align-items-center'>
          <Bars height="80" width="80" color="#4fa94d" ariaLabel="bars-loading" wrapperStyle={{}} wrapperClass="" visible={true}/>
        </div> 
      </div>)

      :
      
      (<>
      <div className='d-flex justify-content-center'>
        <div className=''>
          <h5 className='text-center'>Doctor</h5>
          <div style={{ maxWidth: '50%', width: '10%', height: 'auto' }}>
            <video ref={videoRef1} src={video1} controlsList="nodownload"  onSeeking={handleSeekStart} onSeeked={handleSeekEnd}></video>
          </div>
        </div>
        <div className=''>
          <h5 className='text-center'>Patient</h5>
          <div style={{ maxWidth: '50%', width: '10%', height: 'auto' }}>
            <video ref={videoRef2} src={video2} controlsList="nodownload"  onSeeking={handleSeekStart} onSeeked={handleSeekEnd}></video>
          </div>
        </div>
      </div>

      <div className='d-flex justify-content-center m-5'>
          <Slider min={0} max={300} value={currentTime} onChange={handleSliderChange} styles={{
            track: { backgroundColor: 'black', height: 7 }, // Customize the track (filled part) style
            handle: {
              backgroundColor:'blue',
              borderColor: 'black', // Border color of the handle (slider thumb)
              height: 20, // Height of the handle
              width: 20, // Width of the handle
              marginLeft: -10, // Adjust the horizontal position of the handle
              marginTop: -8 // Adjust the vertical position of the handle
            }
          }} />
      </div>

      <div className='d-flex justify-content-center'>

        <div className='m-3'>
          <img src='/icons/back.png' style={{ height: "30px", width: "30px" }} className='' onClick={handleJumpBackward}/>
        </div>
      
          {!isPlaying && (
            <div className='m-3'>
              <img src='/icons/play.png' style={{ height: "30px", width: "30px" }}  className='' onClick={handlePlay}/>
            </div> 
          )}
          {isPlaying && (
            <div className='m-3'>
              <img src='/icons/pause.png' style={{ height: "30px", width: "30px" }} className='' onClick={handlePause}/>
            </div>
          )}
      

        <div className='m-3'>
          <img src='/icons/next.png' style={{ height: "30px", width: "30px" }} className='' onClick={handleJumpForward}/>
        </div>

        <div className='m-3'>
        <img src='/icons/repeat.png' style={{ height: "30px", width: "30px" }}  className='' onClick={handleRestart}/>
        </div>

      </div>
      </>)}
    </div>
  );
};

export default Recordings;

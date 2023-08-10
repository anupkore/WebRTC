import 'bootstrap/dist/css/bootstrap.css';
import { useRef, useState , useEffect } from 'react';
import * as SockJS from 'sockjs-client';
import Stomp from 'stompjs';

function Index()
{
    
    const localVideo = useRef();
    const remoteVideo = useRef();
    const localIdInp = useRef();
    const remoteIdInp = useRef();
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [localStream, setLocalStream] = useState(null);
    let remoteStream;
    var localPeer;
    let remoteID;
    let localID;
    let stompClient;
    let subscriptions = [];
    
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////  
    // ICE Server Configurations
    const iceServers = {
        iceServer: {
            urls: "stun:stun.l.google.com:19302"
        }
    }
    
    localPeer = new RTCPeerConnection(iceServers)

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    // if(videoEnabled)
    // {
    //     navigator.mediaDevices.getUserMedia({video: true, audio: true})
    //     .then(stream => {
    //         localStream = stream    
    //         localVideo.current.srcObject = stream;
    //         // access granted, stream is the webcam stream
    //     })
    //     .catch(error => {
    //         // access denied or error occurred
    //         console.log(error)
    //     });
    // }


    // Permissions for accessing the video stream and audio stream

    useEffect(() => {
        if (videoEnabled || audioEnabled) {
            navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: audioEnabled })  //Used for video and audio permissions
                .then(stream => {
                    setLocalStream(stream);
                    localVideo.current.srcObject = stream; //setting local video stream on local video div
                })
                .catch(error => {
                    console.error("Error accessing media:", error);
                });
        } else {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                setLocalStream(null);
                localVideo.current.srcObject = null;
            }
        }
    }, [videoEnabled, audioEnabled]);
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////


    function handleConnect()
    {
        // Connect to Websocket Server
        var socket = new SockJS('http://localhost:8080/websocket');
        stompClient = Stomp.over(socket)
    
        
        localID = localIdInp.current.value;
        console.log("My ID: " + localID)
        console.log("Step - 1");

        
        stompClient.connect({}, frame => 
        {
    
            console.log(frame)
    
            // Subscribe to testing URL not very important
            const testServerSubscription = stompClient.subscribe('/topic/testServer', function (test) {
                console.log('Received: ' + test.body);
            });
            subscriptions.push(testServerSubscription);
            
            
            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/call", (call) => 
            {
                console.log("Step - 2");
                console.log("Call From: " + call.body)
                console.log("Step - 3");
                remoteID = call.body;
                console.log("Remote ID: " + call.body)
    

                //Setting remote video stream to remote video div
                localPeer.ontrack = (event) => {
                    try {
                        if (event && event.streams && event.streams[0]) {
                            console.log(event.streams[0]);
                            remoteVideo.current.srcObject = event.streams[0];
                        } else {
                            console.error('Invalid event or stream data received.');
                            setErrorMessage("Invalid event or stream data received");
                        }
                    } catch (error) {
                        console.error('Error setting remote video stream:', error);
                        setErrorMessage("Error setting remote video stream:");
                    }
                };
    
    

                localPeer.onicecandidate = (event) => {
                    console.log("Step - 4");
                    try {

                        if (event.candidate) {
                            var candidate = {
                                type: "candidate",
                                lable: event.candidate.sdpMLineIndex,
                                id: event.candidate.candidate,
                            }
                            console.log("Sending Candidate")
                            console.log(candidate)
                            stompClient.send("/app/candidate", {}, JSON.stringify({
                                "toUser": call.body,
                                "fromUser": localID,
                                "candidate": candidate
                            }))
                        }
                        
                    } catch (error) {
                        console.error("Error sending candidate:", error);
                        setErrorMessage("Error sending candidate");
                    }
                    
                }
                
    



                // Adding Audio and Video Local Peer
                localStream.getTracks().forEach(track => {
                    console.log("Step - 5: Adding track to localPeer");
                    try {
                        localPeer.addTrack(track, localStream);
                        console.log("Track added successfully");
                    } catch (error) {
                        console.error("Error adding track to localPeer:", error);
                    }
                });
                
    



                localPeer.createOffer().then(description => {
                    console.log("Step - 6");
                    localPeer.setLocalDescription(description).then(() => {
                        console.log("Setting Description" + description);
                        stompClient.send("/app/offer", {}, JSON.stringify({
                            "toUser": call.body,
                            "fromUser": localID,
                            "offer": description
                        }));
                    }).catch(error => {
                        console.error("Error setting local description:", error);
                        setErrorMessage("Error setting description");
                    });
                }).catch(error => {
                    console.error("Error creating offer:", error);
                    setErrorMessage("Error creating offer");
                });

            });
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/offer", (offer) => 
            {
                try {

                console.log("Step - 7");
                console.log("Offer came")
                var o = JSON.parse(offer.body)["offer"]
                console.log(offer.body)
                console.log(new RTCSessionDescription(o))
                console.log(typeof (new RTCSessionDescription(o)))
                    
                } catch (error) {
                    console.error("Error Handling the Offer", error)
                    setErrorMessage("Error Handling the Offer");
                }
                
    
                localPeer.ontrack = (event) => {
                    console.log("Step - 8");
                    console.log(event.streams[0])
                    console.log(event.track.kind)
                    //if (event.track.kind === 'video') {
                        // Set the remote stream only when a video track is received
                        remoteVideo.current.srcObject = event.streams[0];
                    //}
                    
                }



                localPeer.onicecandidate = (event) => {
                    if (event.candidate) {
                        var candidate = {
                            type: "candidate",
                            lable: event.candidate.sdpMLineIndex,
                            id: event.candidate.candidate,
                        }
                        console.log("Sending Candidate")
                        console.log(candidate)

                        try {
                            stompClient.send("/app/candidate", {}, JSON.stringify({
                                "toUser": remoteID,
                                "fromUser": localID,
                                "candidate": candidate
                            }))
                        } catch (error) {
                            console.error("Error sending Candidate");
                            setErrorMessage("Error sending Candidate");
                        }
                        
                    }
                }
    
                // Adding Audio and Video Local Peer
                localStream.getTracks().forEach(track => {
                    localPeer.addTrack(track, localStream);
                });

                console.log(o)
                localPeer.setRemoteDescription(new RTCSessionDescription(o))

                try {
                    localPeer.createAnswer().then(description => {
                        localPeer.setLocalDescription(description)
                        console.log("Setting Local Description")
                        console.log(description)
                        stompClient.send("/app/answer", {}, JSON.stringify({
                            "toUser": remoteID,
                            "fromUser": localID,
                            "answer": description
                        }));
        
                    })
                } catch (error) {
                    console.error("An error occurred while sending description");
                    setErrorMessage("An error occurred while sending description");
                }
                
            });


    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/answer", (answer) => {
        console.log("Answer Came");
        try {
            var o = JSON.parse(answer.body)["answer"];
            console.log(o);
    
            // Set the remote description using the answer received from the server
            localPeer.setRemoteDescription(new RTCSessionDescription(o)).then(() => {
                // After setting the remote description, subscribe to the candidate topic
                stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/candidate", (candidateMsg) => {
                    console.log("Candidate Came");
                    try {
                        var o = JSON.parse(candidateMsg.body)["candidate"];
                        console.log(o);
                        console.log(o["lable"]);
                        console.log(o["id"]);
    
                        // Create a new RTCIceCandidate using the information from the server
                        var iceCandidate = new RTCIceCandidate({
                            sdpMLineIndex: o["lable"],
                            candidate: o["id"],
                        });
    
                        // Add the ice candidate to the peer connection
                        localPeer.addIceCandidate(iceCandidate);
                    } catch (candidateError) {
                        console.error("Error processing ICE candidate:", candidateError);
                    }
                });
            });
        } catch (answerError) {
            console.error("Error processing answer:", answerError);
        }
    }, (error) => {
        console.error("Error subscribing to answer topic:", error);
    });
    
    
            console.log("Step - 3");
            stompClient.send("/app/addUser", {}, localIdInp.current.value)
    
        } 
        , error => {
            console.error('Error connecting to WebSocket server:', error);
            window.alert('Error connecting to WebSocket server');
        })
            
        
    
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    
    function handleCall()
    {
        remoteID = remoteIdInp.current.value
        stompClient.send("/app/call", {}, JSON.stringify({"callTo": remoteIdInp.current.value, "callFrom": localIdInp.current.value}))
    }


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function handleTest()
    {
        stompClient.send("/app/testServer", {}, "Test Server")
    }


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    function handleLeave()
    {
        stompClient.send("/app/leave", {}, localID);
        hideVideos();
    
          // Disconnect the WebSocket connection
        stompClient.disconnect(() => {
        console.log('STOMP client disconnected');
          });

          window.location.href="/test";
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////


    // const toggleVideo = async () => {
    //     const newVideoEnabled = !videoEnabled;
    //     try 
    //     {
    //         //if(newVideoEnabled===false)
    //         //{
    //             localStream.getVideoTracks().forEach(track => {
    //                 track.enabled = newVideoEnabled; // Stop the current video track
    //             });
    //             setVideoEnabled(newVideoEnabled);
    //         //}
    //         // else
    //         // {
    //         //     const newStream = new MediaStream();
                
    //         //     const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    //         //         stream.getVideoTracks().forEach(track => {
    //         //             newStream.addTrack(track);
    //         //         });
                
    //         //     localVideo.current.srcObject = newStream; // Update video element
    //         //     setVideoEnabled(newVideoEnabled); // Update state
    //         // } 
    //     }
    //     catch (error) 
    //     {
    //         console.error("Error toggling video:", error);
    //     }
    // };

    // const toggleVideo = () => {
    //     setVideoEnabled(!videoEnabled);
    // };

    const toggleVideo = async () => {
        
        let videoTrack = localStream.getTracks().find(track => track.kind ==='video');
        if (videoTrack.enabled)
        {
            videoTrack.enabled = false;
            document.getElementById('camera-btn').style.backgroundColor = "red";
        }
        else
        {
            videoTrack.enabled = true;
            document.getElementById('camera-btn').style.backgroundColor = "black";
        }
    };


    const toggleAudio = async () => {
        
        let audioTrack = localStream.getTracks().find(track => track.kind ==='audio');
        if (audioTrack.enabled)
        {
            audioTrack.enabled = false;
            document.getElementById('mic-btn').style.backgroundColor = "red";
        }
        else
        {
            audioTrack.enabled = true;
            document.getElementById('mic-btn').style.backgroundColor = "black";
        }
    };


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    

function hideVideos() {
    localVideo.current.srcObject = null;
    remoteVideo.current.srcObject = null;

    if (localStream) {
        console.log(localStream);
        localStream.getTracks().forEach(track => {
            track.stop();
        });
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => {
            track.stop();
        });
    }
}
    
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    
    return(

        <>
            <div>
                <h1 className="text-center mt-5">
                    Hi WebRTC From Anup.
                </h1>

                <div className="d-flex mt-5">
                    <video id="localVideo" ref={localVideo} autoPlay muted className='m-3 w-50 h-25 bg-black'></video>
                    <video id="remoteVideo" ref={remoteVideo} autoPlay className='m-3 w-50 bg-black'></video>
                </div>

                <div className='d-flex justify-content-center border-radius-50'>
                    <div id='camera-btn' onClick={toggleVideo} style={{borderRadius:"50%" , padding:"20px" , backgroundColor:"black"}} className=' d-flex justify-content-center align-items-center m-5'>
                        <img style={{height:"75px" , width:"75px"}} src="/icons/camera.png" alt='Camere Button' />
                    </div>
                    <div id='mic-btn' onClick={toggleAudio} style={{borderRadius:"50%" , padding:"20px" , backgroundColor:"black"}} className=' d-flex justify-content-center align-items-center m-5'>
                        <img style={{height:"75px" , width:"75px"}} src="/icons/mic.png" alt='Camera Button' />
                    </div>
                    <div id='leave-btn' onClick={handleLeave} style={{borderRadius:"50%" , padding:"20px" , backgroundColor:"red"}} className=' d-flex justify-content-center align-items-center m-5'>
                        <img style={{height:"75px" , width:"75px"}} src="/icons/phone.png" alt='Camera Button' />
                    </div>
                </div>




                <div className='d-flex justify-content-center mt-5'>
                    <div>
                        <input type="text" name="localId" id="localId" ref={localIdInp} placeholder="Enter Your ID" className='h-50 border-dark'></input>
                        <button id="connectBtn" className='btn btn-primary m-3' onClick={handleConnect}>Connect</button>
                    </div>
                    <div>
                        <input type="text" name="remoteId" id="remoteId" ref={remoteIdInp} placeholder="Enter Remote ID" className='h-50 border-dark'></input>
                        <button id="callBtn" className='btn btn-success m-3' onClick={handleCall}>Call</button>
                    </div>
                </div>

                {/* <div className='d-flex justify-content-center mt-5'>
                    <button id="test" className='btn btn-danger m-3' onClick={handleLeave}>End Call</button>
                    <button id="testConnection" className='btn btn-primary m-3' onClick={handleTest}>Test Connection</button>
                </div> */}
                {/* <div className='d-flex justify-content-center mt-5'>
                    <button className={`btn ${videoEnabled ? 'btn-primary' : 'btn-secondary'} m-3`} onClick={toggleVideo}>
                        {videoEnabled ? 'Turn Off Video' : 'Turn On Video'}
                    </button>
                </div> */}


                
            </div>
        </>
    );
}

export default Index;


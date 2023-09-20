import 'bootstrap/dist/css/bootstrap.css';
import { useRef, useState, useEffect } from 'react';
import Stomp from 'stompjs';

function Index() {

    const localVideo = useRef();
    const remoteVideo = useRef();
    const localIdInp = useRef();
    const remoteIdInp = useRef();
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [remainder, setRemainder] = useState("");
    const [callInitiated, setCallInitiated] = useState(false);



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
    // const iceServers = {
    //     iceServer: {
    //         urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:global.stun.twilio.com:3478'],
    //         iceCandidatePoolSize: 2
    //     }
    // }

    const iceServers = {
        iceServers: [
            // {
            //     urls: [
            //         'stun:stun1.l.google.com:19302',
            //         'stun:stun2.l.google.com:19302',
            //         'stun:global.stun.twilio.com:3478'
            //     ]
            // },
            {
                urls: 'turn:turn.jami.net',
                username: 'ring',
                credential: 'ring'
            },
            {
                urls: 'stun:192.168.0.170:3478',
                username: 'test',
                credential: 'test123'
            },
            {
                urls: 'turn:192.168.0.170:3478?transport=udp',
                    username: 'test',
                    credential: 'test123'
            }
        ],
        iceCandidatePoolSize: 2
    };
    

    localPeer = new RTCPeerConnection(iceServers)

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////


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


    function handleConnect() {
        // Connect to Websocket Server
        var socket = new WebSocket('wss://web-rtc-server-git-techbrutal1151-dev.apps.sandbox-m2.ll9k.p1.openshiftapps.com/websocket');
        //var socket = new WebSocket('ws://localhost:8080/websocket');
        stompClient = Stomp.over(socket)


        localID = localIdInp.current.value;
        console.log("My ID: " + localID)
        console.log("Step - 1");


        stompClient.connect({}, frame => {

            console.log(frame)


            // Subscribe to testing URL not very important
            const testServerSubscription = stompClient.subscribe('/topic/testServer', function (test) {
                console.log('Received: ' + test.body);
            });
            subscriptions.push(testServerSubscription);


            // Subscribe to call requests
            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/call-request", (callRequest) => {
                const caller = JSON.parse(callRequest.body);
                const acceptCall = window.confirm(`Incoming call from ${caller}. Accept?`);
                //const acceptCall = true;

                if (acceptCall) {
                    stompClient.send("/app/call", {}, JSON.stringify({ "callTo": localIdInp.current.value, "callFrom": caller }))
                }
            });


            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/call", (call) => {
                console.log("Step - 2");
                console.log("Call From: " + call.body)
                console.log("Step - 3");
                remoteID = call.body;
                remoteIdInp.current.value = remoteID;
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

                            setTimeout(()=>{
                                stompClient.send("/app/candidate", {}, JSON.stringify({
                                "toUser": call.body,
                                "fromUser": localID,
                                "candidate": candidate
                                }))
                            },500)
                            
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



                // Creating And Sending Offer

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
            ////////////////////////////////////////////////////////////////////////////////////////////////////////

            //Receiving offers
            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/offer", async (offer) => {
                try {

                    console.log("Step - 7");
                    console.log("Offer came")
                    var o = JSON.parse(offer.body)["offer"]
                    console.log(offer.body)
                    console.log(new RTCSessionDescription(o))
                    console.log(typeof (new RTCSessionDescription(o)))
                    console.log(o)
                    localPeer.setRemoteDescription(new RTCSessionDescription(o))

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


                // Adding Audio and Video Local Peer
                localStream.getTracks().forEach(track => {
                    localPeer.addTrack(track, localStream);
                });



                //Creating and Sending Answer
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

                
                
                //Sending Candidates to the ice server
                localPeer.onicecandidate =(event) => {
                    if (event.candidate) {
                        var candidate = {
                            type: "candidate",
                            lable: event.candidate.sdpMLineIndex,
                            id: event.candidate.candidate,
                        }
                        console.log("Sending Candidate")
                        console.log(candidate)

                        try {
                            setTimeout(()=>{
                                stompClient.send("/app/candidate", {}, JSON.stringify({
                                "toUser": remoteID,
                                "fromUser": localID,
                                "candidate": candidate
                                }))
                            },500)
                            
                        } catch (error) {
                            console.error("Error sending Candidate");
                            setErrorMessage("Error sending Candidate");
                        }

                    }
                }

            });


            ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////////////////////////////////////////////////


            //Receiving Answers 

            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/answer", async (answer) => {
                console.log("Answer Came");
                try {
                    var object = JSON.parse(answer.body)["answer"];
                    console.log(object);
                    console.log("Setting remote description")
                    localPeer.setRemoteDescription(new RTCSessionDescription(object));

                } catch (answerError) {
                    console.error("Error processing answer:", answerError);
                }
            });


            ////////////////////////////////////////////////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////////////////////////////////////////////////

            //Receiving the candidate information
            
                stompClient.subscribe("/user/" + localIdInp.current.value + "/topic/candidate", (candidate) => {
                    console.log("Candidate Came");
                    console.log("Inside /Candidate")
                    var o = JSON.parse(candidate.body)["candidate"];
                    console.log(o);
                    console.log(o["lable"]);
                    console.log(o["id"]);
    
                    // Create a new RTCIceCandidate using the information from the server
                    console.log("Setting up a new RTCIceCandidate")
                    var iceCandidate = new RTCIceCandidate({
                        sdpMLineIndex: o["lable"],
                        candidate: o["id"],
                    });
    
                    console.log("Adding iceCandidate")
                    setCallInitiated(true);
                    // Add the ice candidate to the peer connection
                    localPeer.addIceCandidate(iceCandidate);
                });
            
            



            //Receiving the remainder information
            stompClient.subscribe("/topic/reminder", message => {
                console.log('Reminder:', JSON.parse(message.body).message);
                window.alert("Reminder: " + JSON.parse(message.body).message);
                setRemainder(JSON.parse(message.body).message);
            });


            console.log("Step - 3");
            stompClient.send("/app/addUser", {}, localIdInp.current.value)



            //Frame Ends here
        }
            , error => {
                console.error('Error connecting to WebSocket server:', error);
                window.alert('Error connecting to WebSocket server');
            })



    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    function endCallAutomatically() {
        console.log('Call ended automatically.');
        handleLeave();
    }

    function showReminder() {
        console.log('1 minutes remaining!');

        // Send a reminder message to the WebSocket server
        if (stompClient) {
            const reminderMessage = {
                type: 'reminder',
                message: '1 minutes remaining!',
            };

            stompClient.send("/app/sendMessage", {}, JSON.stringify(reminderMessage));
        }
    }

    function handleCall() {
        if (stompClient) {
            remoteID = remoteIdInp.current.value
            stompClient.send("/app/call-request", {}, JSON.stringify({ "callTo": remoteIdInp.current.value, "callFrom": localIdInp.current.value }))
            //stompClient.send("/app/call", {}, JSON.stringify({"callTo": remoteIdInp.current.value, "callFrom": localIdInp.current.value}))
            setTimeout(showReminder, 2 * 60 * 1000);
            setTimeout(endCallAutomatically, 3 * 60 * 1000);
        } else {
            setErrorMessage("Stomp is not available");
            window.alert("User Already Busy in Another Call");
        }

    }


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function handleTest() {
        stompClient.send("/app/testServer", {}, "Test Server")
    }


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function handleLeave() {
        clearTimeout(showReminder);
        clearTimeout(endCallAutomatically);
        if (stompClient) {
            stompClient.send("/app/leave", {}, localID);
            hideVideos();

            // Disconnect the WebSocket connection
            stompClient.disconnect(() => {
                console.log('STOMP client disconnected');
            });

            window.location.href = "/test";
        } else {
            window.location.href = "/test";
        }

    }




    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////



    const toggleVideo = async () => {

        let videoTrack = localStream.getTracks().find(track => track.kind === 'video');
        if (videoTrack.enabled) {
            videoTrack.enabled = false;
            document.getElementById('camera-btn').style.backgroundColor = "red";
        }
        else {
            videoTrack.enabled = true;
            document.getElementById('camera-btn').style.backgroundColor = "rgb(179,102,249,.9)";
        }
    };


    const toggleAudio = async () => {

        let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
        if (audioTrack.enabled) {
            audioTrack.enabled = false;
            document.getElementById('mic-btn').style.backgroundColor = "red";
        }
        else {
            audioTrack.enabled = true;
            document.getElementById('mic-btn').style.backgroundColor = "rgb(179,102,249,.9)";
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


    function disconnectFromStomp() 
    {
        if (stompClient) {
            stompClient.disconnect(() => {
                console.log('STOMP client disconnected');
            });
        }
    }
    
    // Attach the event listener to the window
    useEffect(() => {
        window.addEventListener('beforeunload', disconnectFromStomp);
        return () => {
            window.removeEventListener('beforeunload', disconnectFromStomp);
        };
    }, []);
    


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////


    return (

        
            <div style={{backgroundImage: 'url("https://images.unsplash.com/photo-1668632150893-6bfccb01bdc2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8c3RhcnRzJTIwYXQlMjBuaWdodHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60")'}}>
                <h1 className="text-center text-light">
                    Hi WebRTC-Project From Anup.
                </h1>

                <div className="d-flex justify-content-center mt-5">
                    <video id="localVideo" ref={localVideo} autoPlay muted className='m-2 bg-black' style={{height:"500px",width:"500px"}}></video>
                    <video id="remoteVideo" ref={remoteVideo} autoPlay className='m-2 bg-black' style={{height:"500px",width:"500px"}}></video>
                </div>



                <div className='d-flex justify-content-center border-radius-50'>
                    <div id='camera-btn' onClick={toggleVideo} style={{ borderRadius: "50%", padding: "20px", backgroundColor: "rgb(179,102,249,.9)" }} className=' d-flex justify-content-center align-items-center m-5'>
                        <img style={{ height: "75px", width: "75px" }} src="/icons/camera.png" alt='Camere Button' />
                    </div>
                    <div id='mic-btn' onClick={toggleAudio} style={{ borderRadius: "50%", padding: "20px", backgroundColor: "rgb(179,102,249,.9)" }} className=' d-flex justify-content-center align-items-center m-5'>
                        <img style={{ height: "75px", width: "75px" }} src="/icons/mic.png" alt='Camera Button' />
                    </div>
                    <div id='leave-btn' onClick={handleLeave} style={{ borderRadius: "50%", padding: "20px", backgroundColor: "red" }} className=' d-flex justify-content-center align-items-center m-5'>
                        <img style={{ height: "75px", width: "75px" }} src="/icons/phone.png" alt='Camera Button' />
                    </div>
                </div>




                {!callInitiated && (
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
                )}

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
        
    );
}

export default Index;


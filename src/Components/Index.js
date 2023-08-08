import 'bootstrap/dist/css/bootstrap.css';
import { useRef, useState } from 'react';
import * as SockJS from 'sockjs-client';
import Stomp from 'stompjs';

function Index()
{
    const url = "http://localhost:8080"

  
    const localVideo = useRef();
    const remoteVideo = useRef();
    const localIdInp = useRef();
    const remoteIdInp = useRef();
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(false);
    let localStream;
    let remoteStream;
    var localPeer;
    let remoteID;
    let localID;
    let stompClient;
    let subscriptions = [];
    
    
    // ICE Server Configurations
    const iceServers = {
        iceServer: {
            urls: "stun:stun.l.google.com:19302"
        }
    }
    
    localPeer = new RTCPeerConnection(iceServers)
    
    
    navigator.mediaDevices.getUserMedia({video: true, audio: true})
        .then(stream => {
            localStream = stream
    
            // console.log(stream.getTracks()[0])
            // console.log(stream.getTracks()[1])
            // console.log(localStream.getTracks()[0])
            // console.log(localStream.getTracks()[1])
    
            localVideo.current.srcObject = stream;
            // access granted, stream is the webcam stream
        })
        .catch(error => {
            // access denied or error occurred
            console.log(error)
        });
    
    function handleConnect()
    {
        // Connect to Websocket Server
        var socket = new SockJS('https://web-rtc-server-techbrutal1151-dev.apps.sandbox-m2.ll9k.p1.openshiftapps.com/websocket');
        stompClient = Stomp.over(socket);
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
            
            
            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/call", (call) => {
                console.log("Step - 2");
                console.log("Call From: " + call.body)
                console.log("Step - 3");
                remoteID = call.body;
                console.log("Remote ID: " + call.body)
    
                localPeer.ontrack = (event) => {
                    // Setting Remote stream in remote video element
                    remoteVideo.current.srcObject = event.streams[0]
                }
    
    
                localPeer.onicecandidate = (event) => {
                    console.log("Step - 4");
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
                }
    
                // Adding Audio and Video Local Peer
                localStream.getTracks().forEach(track => {
                    console.log("Step - 5");
                    localPeer.addTrack(track, localStream);
                });
    
                localPeer.createOffer().then(description => {
                    console.log("Step - 6");
                    localPeer.setLocalDescription(description);
                    console.log("Setting Description" + description);
                    stompClient.send("/app/offer", {}, JSON.stringify({
                        "toUser": call.body,
                        "fromUser": localID,
                        "offer": description
                    }))
                })
            });
    /////////////////////////////////////////////////////////////////////////////////////////////////////
            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/offer", (offer) => {
                console.log("Step - 7");
                console.log("Offer came")
                var o = JSON.parse(offer.body)["offer"]
                console.log(offer.body)
                console.log(new RTCSessionDescription(o))
                console.log(typeof (new RTCSessionDescription(o)))
    
                localPeer.ontrack = (event) => {
                    remoteVideo.current.srcObject = event.streams[0]
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
                        stompClient.send("/app/candidate", {}, JSON.stringify({
                            "toUser": remoteID,
                            "fromUser": localID,
                            "candidate": candidate
                        }))
                    }
                }
    
                // Adding Audio and Video Local Peer
                localStream.getTracks().forEach(track => {
                    localPeer.addTrack(track, localStream);
                });
                console.log(o)
                localPeer.setRemoteDescription(new RTCSessionDescription(o))

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
            });
    ////////////////////////////////////////////////////////////////////////////////////////////////////////
            stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/answer", (answer) => {
                console.log("Answer Came")
                var o = JSON.parse(answer.body)["answer"]
                console.log(o)
                localPeer.setRemoteDescription(new RTCSessionDescription(o)).then(()=>{
                    stompClient.subscribe('/user/' + localIdInp.current.value + "/topic/candidate", (answer) => {
                        console.log("Candidate Came")
                        var o = JSON.parse(answer.body)["candidate"]
                        console.log(o)
                        console.log(o["lable"])
                        console.log(o["id"])
                        var iceCandidate = new RTCIceCandidate({
                            sdpMLineIndex: o["lable"],
                            candidate: o["id"],
                        })
                        localPeer.addIceCandidate(iceCandidate)
                    });
                })
    
            });
    
            
    
            console.log("Step - 3");
            stompClient.send("/app/addUser", {}, localIdInp.current.value)
    
        })
    }
    
    function handleCall()
    {
        remoteID = remoteIdInp.current.value
        stompClient.send("/app/call", {}, JSON.stringify({"callTo": remoteIdInp.current.value, "callFrom": localIdInp.current.value}))
    }

    function handleTest()
    {
        stompClient.send("/app/testServer", {}, "Test Server")
    }
    
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


    // Inside your component function
function toggleAudio() {
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !audioMuted;
    });
    setAudioMuted(!audioMuted);
}

function toggleVideo() {
    localStream.getVideoTracks().forEach(track => {
        track.enabled = !videoMuted;
    });
    setVideoMuted(!videoMuted);
}


    
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

                <div className='d-flex justify-content-center mt-5'>
                    <button id="test" className='btn btn-danger m-3' onClick={handleLeave}>End Call</button>
                    <button id="testConnection" className='btn btn-primary m-3' onClick={handleTest}>Test Connection</button>
                    <button className={`btn ${audioMuted ? 'btn-secondary' : 'btn-primary'} m-3`} onClick={toggleAudio}>
                        {audioMuted ? 'Unmute Audio' : 'Mute Audio'}
                    </button>
                    <button className={`btn ${videoMuted ? 'btn-secondary' : 'btn-primary'} m-3`} onClick={toggleVideo}>
                        {videoMuted ? 'Turn On Video' : 'Turn Off Video'}
                    </button>
                </div>
                
            </div>
        </>
    );
}

export default Index;


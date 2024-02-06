import 'bootstrap/dist/css/bootstrap.css';
import { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import RecordRTC from 'recordrtc';
import Stomp from 'stompjs';

function Index() {

    const { myId, remoteId, role, appointmentId } = useParams();
    const localVideo = useRef();
    const remoteVideo = useRef();

    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [remainder, setRemainder] = useState("");
    const [callInitiated, setCallInitiated] = useState(false);
    const [join , setJoin] = useState(true);
    const [connectClicked , setConnectClicked] = useState(false);
    const [patientJoined , setPatientJoined] = useState(false);
    const [patientAlreadyJoined , setPatientAlreadyJoined] = useState(false);
    const [personLeft , setPersonLeft] = useState(false);
    const [leaveClicked , setLeaveClicked] = useState(false);
    const [localRecorder, setLocalRecorder] = useState(null);
    const [remoteRecorder, setRemoteRecorder] = useState(null);
    const [recordingStarted, setRecordingStarted] = useState(false);
    const [recordingTextVisible, setRecordingTextVisible] = useState(false);
    const [recordClicked , setRecordClicked] = useState(false);
    const [recordingStopped , setRecordingStopped] = useState(false);
    const [recordButtonDisplay , setRecordButtonDisplay] = useState(false);

    const [localStream, setLocalStream] = useState(null);
    let remoteStream;
    var localPeer;
    let stompClient;

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////  
    
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
    
    
    useEffect(()=>{
        if(connectClicked){
            //var socket = new WebSocket('wss://web-rtc-server-git-techbrutal1151-dev.apps.sandbox-m2.ll9k.p1.openshiftapps.com/websocket');
            //var socket = new WebSocket('ws://localhost:8080/websocket');
            var socket = new WebSocket('wss://192.168.1.206:30030/websocket');
            stompClient = Stomp.over(socket);
        }
    },[connectClicked,patientAlreadyJoined,patientJoined,personLeft,leaveClicked,recordClicked,recordingStopped])
    

    useEffect(()=>{
        
        if(connectClicked)
        {
            
            stompClient.connect({}, frame => {

                callRequestSubscription();
                callSubscription();
                offerSubscription();
                answerSubscription();
                candidateSubscription();
                remainderSubscription();
                notification();
                callEndedSubscription();
                recordRequestSubscription();
                recordRequestAcceptanceSubscription();
                recordingStoppedSubscription();
                
                if(leaveClicked){
                    sendLeaveRequest();
                }

                if(recordClicked){
                    sendRecordRequest();
                }

                if(recordingStopped){
                    sendRecordingStoppedMessage();
                }

                const ids = { myId: myId, remoteId: remoteId,  role: role };
                stompClient.send("/app/addUser", {}, JSON.stringify(ids));
            }
                , error => {
                    console.error('Error connecting to WebSocket server:', error);
                    window.alert('Error connecting to WebSocket server');
                })


        }
        else{
            console.log("Stomp Clent Not Connected")
        }
        console.log("first connection");
    },[connectClicked,leaveClicked,recordClicked,recordingStopped])


    useEffect(()=>{
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

    },[join])

    



    function callRequestSubscription(){
        stompClient.subscribe('/user/' + myId + "/topic/call-request", (callRequest) => {
            const caller = JSON.parse(callRequest.body);
            const acceptCall = window.confirm(`Incoming call from ${caller}. Accept?`);
            //const acceptCall = true;

            if (acceptCall) {
                stompClient.send("/app/call", {}, JSON.stringify({ "callTo": myId, "callFrom": caller }))
            }
        });
    }

    function callSubscription(){
        stompClient.subscribe('/user/' + myId + "/topic/call", (call) => {
            
            sendCandidate_1(call);    

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

            createOffer(call);

        });
    }

    function offerSubscription(){
        stompClient.subscribe('/user/' + myId + "/topic/offer", async (offer) => {
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
                    console.log("Remote Id While Sending ID is..."+remoteId)
                    stompClient.send("/app/answer", {}, JSON.stringify({
                        "toUser": remoteId,
                        "fromUser": myId,
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
                            "toUser": remoteId,
                            "fromUser": myId,
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
    }

    function answerSubscription(){
        stompClient.subscribe('/user/' + myId + "/topic/answer", async (answer) => {
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
    }

    function candidateSubscription(){
        stompClient.subscribe("/user/" + myId + "/topic/candidate", (candidate) => {
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

    }

    function remainderSubscription(){
        stompClient.subscribe("/topic/reminder", message => {
            console.log('Reminder:', JSON.parse(message.body).message);
            window.alert("Reminder: " + JSON.parse(message.body).message);
            setRemainder(JSON.parse(message.body).message);
        });
    }

    function notification(){

        stompClient.subscribe('/user/' + myId + "/topic/is-patient-joined", (joinedUser) => {
        const user = JSON.parse(joinedUser.body);
        if(joinedUser.body === "true"){
            console.log("Patient has already joined");
            setPatientAlreadyJoined(true);
            //window.alert("Patient has already joined");
        }else{
            console.log("Patient has not joined yet");
            //window.alert("Patient has not joined yet");
        }
    });

    stompClient.subscribe('/user/' + myId + "/topic/patient-joined", (joinedUser) => {
        const user = JSON.parse(joinedUser.body);
        console.log("Patient Has Joined");
        setPatientAlreadyJoined(true);
        //window.alert("Patient Has Joined");
        
    });

}

    function callEndedSubscription(){
        stompClient.subscribe('/user/' + myId + "/topic/callEnded", (object) => {
        console.log(object.body);
        setPersonLeft(true);
        setTimeout(() => {
            handleLeave();
        },10000);
    });
    }

    function sendCandidate_1(call){
        localPeer.onicecandidate = (event) => {
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
                        "fromUser": myId,
                        "candidate": candidate
                        }))
                    },500)
                    
                }

            } catch (error) {
                console.error("Error sending candidate:", error);
                setErrorMessage("Error sending candidate");
            }

        }
    }

    function createOffer(call){
        // Creating And Sending Offer

        localPeer.createOffer().then(description => {
            console.log("Step - 6");
            localPeer.setLocalDescription(description).then(() => {
                console.log("Setting Description" + description);
                stompClient.send("/app/offer", {}, JSON.stringify({
                    "toUser": call.body,
                    "fromUser": myId,
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
    }
 
    function handleConnect() 
    {
        setConnectClicked(true);
        setJoin(false);
        
    }

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
            stompClient.send("/app/call-request", {}, JSON.stringify({ "callTo": remoteId, "callFrom": myId }))
            //stompClient.send("/app/call", {}, JSON.stringify({"callTo": remoteIdInp.current.value, "callFrom": localIdInp.current.value}))
            //setTimeout(showReminder, 2 * 60 * 1000);
            setTimeout(endCallAutomatically, 15 * 60 * 1000);
        } else {
            setErrorMessage("Stomp is not available");
            window.alert("User Already Busy in Another Call");
        }

    }

    function sendLeaveRequest(){
        if (stompClient) 
        {
            const ids = { myId: myId, remoteId: remoteId};
            stompClient.send("/app/leave", {},JSON.stringify(ids) );

            // Disconnect the WebSocket connection
            stompClient.disconnect(() => {
                console.log('STOMP client disconnected');
            });
            if(role === "Doctor")
            {
                window.location.href = "http://192.168.1.206:30092/app";
            }else{
                window.location.href = "http://192.168.1.206:30091/dashboard/appointments";
            }
        }
    }

    function handleRecordClicked(){
        setRecordClicked(true);
    }

    function sendRecordRequest(){
        if(stompClient){
            console.log("Sending Call Record Request");
            const details = {"toUser":remoteId , "fromUser":myId}
            stompClient.send("/app/recordRequest",{},JSON.stringify(details))
        }
        else{
            console.log("StompClient does not exist");
        }
    }

    function sendRecordingStoppedMessage(){
        if(stompClient){
            console.log("Sending recording stopped message");
            const details = {"toUser":remoteId}
            stompClient.send("/app/recordingStopped",{},JSON.stringify(details))
        }
        else{
            console.log("StompClient does not exist");
        }
    }

    function recordRequestSubscription(){
        stompClient.subscribe('/user/' + myId + "/topic/recordRequest", (callRecordRequest) => {
            const caller = JSON.parse(callRecordRequest.body);
            const acceptRecordCall = window.confirm(`Doctor wants to record this call for future reference.  Accept?`);

            if (acceptRecordCall) {
                setRecordingStarted(true);
                setRecordingTextVisible(true);
                const id = {"toUser":remoteId};
                stompClient.send("/app/recordRequestAcceptance",{},JSON.stringify(id))
            }
        });
    }

    function recordRequestAcceptanceSubscription(){                                                                                                                                        
        stompClient.subscribe('/user/' + myId + "/topic/recordRequestAcceptance", (callRecordRequestAcceptance) => {
            console.log(callRecordRequestAcceptance.body);
            setRecordButtonDisplay(true);
            handleStartRecording();
        });
    }

    function recordingStoppedSubscription(){
        stompClient.subscribe('/user/' + myId + "/topic/recordingStopped", (message) => {
            console.log("Recording Stopped Message is : "+message.body);
            setRecordingStarted(false);
            setRecordingTextVisible(false);
            setRecordingStopped(false);
        });
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////


    function handleLeave() {
        setLeaveClicked(true);
        console.log("Leave button clicked");
        clearTimeout(showReminder);
        clearTimeout(endCallAutomatically);
        hideVideos();
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
            document.getElementById('camera-btn').style.backgroundColor = "rgb(150,20,249,.9)";
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
            document.getElementById('mic-btn').style.backgroundColor = "rgb(150,20,249,.9)";
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
    

    useEffect(() => {
        const handleBeforeUnload = () => {
            setTimeout(() => {
                handleLeave();
            }, 0);
            // Optionally return a message to be displayed in the confirmation dialog
            return 'Are you sure you want to leave?';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup the event listener when the component is unmounted
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);


    const startRecording = (mediaStream, setRecorder) => {
        const recorder = RecordRTC(mediaStream, {
          type: 'video',
          videoBitsPerSecond: 100000,
          audio: true,
        });
    
        recorder.startRecording();

        setRecorder(recorder);
        setRecordingStarted(true);
        setRecordingTextVisible(true);
      };

      const stopRecording = (recorder) => {
        if (recorder) {
          recorder.stopRecording(() => {
            const blob = recorder.getBlob();
            // Handle the blob (e.g., save it, download it)
            console.log(blob); 
          });
        }
        setRecordingStarted(false);
        setRecordingTextVisible(false);
        setRecordClicked(false);
        setRecordingStopped(true);
      };

      const downloadLocalBlob = (localBlob) => {
        const url = URL.createObjectURL(localBlob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = `local_video_${Date.now()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
      };
      
      const downloadRemoteBlob = (remoteBlob) => {
        const url = URL.createObjectURL(remoteBlob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = `remote_video_${Date.now()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
      };
      
      const handleDownload = async () => {
        if (localRecorder && remoteRecorder) {
          const doctorStream = localRecorder.getBlob();
          const patientStream = remoteRecorder.getBlob();
          console.log("Local Video Blob Size is: " + localRecorder)
          console.log("Remote Video Blob Size is: " + remoteRecorder)
        
        const formData = new FormData();
        formData.append('doctorStream', doctorStream);
        formData.append('patientStream', patientStream);
        formData.append('appointmentId', appointmentId);

        const response = await fetch('https://192.168.1.206:30002/api/documentation/video-recordings',{
            method: 'POST',
            body: formData
        });

        console.log(response);
 
        // const response = await fetch('https://192.168.1.206:30031/side', {
        //     method: 'POST',
        //     body: formData,
        // });

        // console.log(response);
 
        // if (response.ok) {
        //     const blob = await response.blob();
        //     console.log("Merged Video size is"+blob.size)
        //     const url = URL.createObjectURL(blob);
   
        //     // Create a link and trigger a download
        //     const a = document.createElement('a');
        //     a.href = url;
        //     a.download = `Date ${new Date().toISOString()} merged_video.webm`;
        //     a.click();
        //     window.URL.revokeObjectURL(url);
        // } else {
        //     // Handle errors
        //     console.error('Error merging videos:', response.statusText);
        // }
          
        //downloadLocalBlob(localBlob);
        //downloadRemoteBlob(remoteBlob);
        }
      };
      
    
      const handleStartRecording = () => {
        startRecording(localVideo.current.srcObject, setLocalRecorder);
        startRecording(remoteVideo.current.srcObject, setRemoteRecorder);
      };
      
      const handleStopRecording = () => {
        stopRecording(localRecorder);
        stopRecording(remoteRecorder);
      };
      
      const blinkingDotStyle = {
        width: '10px',
        height: '10px',
        backgroundColor: 'red',
        borderRadius: '50%',
        display: 'inline-block',
        marginRight: '5px',
        animation: 'blinkDot 1s infinite',
    };

    const keyframes = `@keyframes blinkDot {
        0% { opacity: 1; }
        50% { opacity: 0; }
        100% { opacity: 1; }
    }
`;

    // Apply the keyframes to the document's styles
    const styleSheet = document.styleSheets[0];
    styleSheet.insertRule(keyframes, styleSheet.cssRules.length);

    

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////


    return (

        
            <div style={{backgroundImage: `url(https://img.freepik.com/premium-vector/technology-background-web-connection-background-connection-background_759274-328.jpg?w=1060)`,backgroundSize:"cover", filter:"blur"}}>
                
                <div className='text-center'>
                    <img src="/icons/SiteLogo.png" style={{"width":"400px","height":"90px"}}/>
                    {/* <h2 className="text-dark">ArogyaMandi</h2> */}
                    <h5 className="text-dark">Video Consultation Platform</h5>
                </div>


                {!connectClicked &&
                <div className='text-center mt-3'>
                    <h5 className='text-success'>Please Click On Join Now Button To Start A Call</h5>
                </div>
                }



                {role === "Doctor" && connectClicked && !callInitiated &&

                <div className='text-center'>
                    <div className='text-center bg-white rounded w-50 mx-auto mt-3'>
                        {patientAlreadyJoined?
                        <h5 className='text-success'>Patient Has Joined And Waiting For Your Call</h5>
                        :<h5 className='text-danger'>Please Wait For Patient To Join</h5>
                        }
                    </div>
                </div>
                }

                {role === "Patient" && connectClicked && !callInitiated &&
                <div className='text-center bg-white rounded w-50 mx-auto mt-3'>
                    <h5 className='text-success'>Doctor Will Call Shortly. Please Wait</h5>
                </div>
                }

                {role === "Doctor" && personLeft &&
                <div className='text-center bg-white rounded w-50 mx-auto mt-3'>
                    <h5 className='text-danger'>Patient Has Left The Call , Redirecting To The Dashboard...</h5>
                </div>
                }

                {role === "Patient" && personLeft &&
                <div className='text-center bg-white rounded w-50 mx-auto mt-3'>
                    <h5 className='text-danger'>Doctor Has Left The Call , Redirecting To The Dashboard...</h5>
                </div>
                }

                {/* {recordingStarted &&
                <div className='text-center mt-3'>
                   <h5 className='text-danger'>Recording</h5> 
                </div>
                } */}

                {recordingStarted && (
                    <div className='text-center mt-3 d-flex justify-content-center'>
                        <div className='mt-2' style={blinkingDotStyle}></div>
                        <h5 className='text-danger'>
                            <span className={`blinking-text ${recordingTextVisible ? 'visible' : 'hidden'}`}>Recording Started</span>
                        </h5>
                        
                    </div>
                )}
                 
                <div className="d-flex justify-content-center mt-1">
                    <div>
                        <h5 className='text-center'>You</h5>
                        <video id="localVideo" ref={localVideo} autoPlay muted className='m-1 bg-black' style={{height:"350px",width:"650px",borderRadius:"20px"}}></video>
                    </div>

                    <div>
                        {role === "Doctor" && 
                            <h5 className='text-center'>Patient</h5>
                        }
                        {role === "Patient" && 
                            <h5 className='text-center'>Doctor</h5>
                        }
                        
                        <video id="remoteVideo" ref={remoteVideo} autoPlay className='m-1 bg-black' style={{height:"350px",width:"650px",borderRadius:"20px"}}></video>
                    </div>
                </div>



                {connectClicked &&
                <div className='d-flex justify-content-center border-radius-50'>
                    <div id='camera-btn' onClick={toggleVideo} style={{ borderRadius: "50%", padding: "20px", backgroundColor: "rgb(150,20,249,.9)" }} className=' d-flex justify-content-center align-items-center m-2'>
                        <img style={{ height: "30px", width: "30px" }} src="/icons/camera.png" alt='Camere Button' />
                    </div>
                    <div id='mic-btn' onClick={toggleAudio} style={{ borderRadius: "50%", padding: "20px", backgroundColor: "rgb(150,20,249,.9)" }} className=' d-flex justify-content-center align-items-center m-2'>
                        <img style={{ height: "30px", width: "30px" }} src="/icons/mic.png" alt='Camera Button' />
                    </div>
                    <div id='leave-btn' onClick={handleLeave} style={{ borderRadius: "50%", padding: "20px", backgroundColor: "red" }} className=' d-flex justify-content-center align-items-center m-2'>
                        <img style={{ height: "30px", width: "30px" }} src="/icons/phone.png" alt='Camera Button' />
                    </div>
                </div>
                }




                {!callInitiated && (
                    <div className='d-flex justify-content-center mt-2'>
                        <div style={{display: join? "block":"none"}}>
                            {/* <input type="text" name="localId" id="localId" onChange={handleSetLocalId} value={localIdInp} placeholder="Enter Your ID" className='h-50 border-dark'></input> */}
                            <button id="connectBtn" className='btn btn-primary m-3' onClick={handleConnect}>Join Now</button>
                        </div>

                        {role === "Doctor" && patientAlreadyJoined &&
                        <div style={{display: join? "none":"block"}}>
                            {/* <input type="text" name="remoteId" id="remoteId" onChange={handleSetRemoteId} value={remoteIdInp} placeholder="Enter Remote ID" className='h-50 border-dark'></input> */}
                            <button id="callBtn" className='btn btn-success m-2' onClick={handleCall}>Call</button>
                        </div>
                        }
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


                {callInitiated && role === "Doctor" &&
                    <div className='text-center'>
                        {recordButtonDisplay && !recordingStopped &&
                        <button className='btn btn-primary m-3' onClick={handleStopRecording}>Stop Recording</button>
                        }

                        {!recordButtonDisplay && !recordingStopped &&
                        <button className='btn btn-primary m-3' onClick={handleRecordClicked}>Start Recording</button>
                        }

                        {recordingStopped &&
                        <button className='btn btn-success m-3' onClick={handleDownload}>Download Videos</button>
                        }
                    </div>
                }
            </div>
        
    );
}

export default Index;


import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import "./App.css";

const socket = io.connect("http://localhost:5000");

function App() {
  const [stream, setStream] = useState(null);
  const [userName, setUserName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [peers, setPeers] = useState([]);
  const myVideo = useRef();
  const peersRef = useRef([]);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setStream(stream);
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
      });

    socket.on("rooms-list", (rooms) => {
      setRooms(rooms);
    });

    socket.on("room-hosted", (room) => {
      setCurrentRoom(room);
    });

    socket.on("room-joined", (room) => {
      setCurrentRoom(room);
    });

    socket.on("user-joined", ({ userId }) => {
      const peer = createPeer(userId, socket.id, stream);
      peersRef.current.push({
        peerID: userId,
        peer,
      });
      setPeers((users) => [...users, peer]);
    });

    socket.on("call-made", ({ offer, socket: callerId }) => {
      const peer = addPeer(offer, callerId, stream);
      peersRef.current.push({
        peerID: callerId,
        peer,
      });
      setPeers((users) => [...users, peer]);
    });

    socket.on("answer-made", ({ answer, socket: answererId }) => {
      const item = peersRef.current.find((p) => p.peerID === answererId);
      item.peer.signal(answer);
    });

    socket.on("user-left", ({ userId }) => {
      const item = peersRef.current.find((p) => p.peerID === userId);
      if (item) {
        item.peer.destroy();
      }
      const newPeers = peersRef.current.filter((p) => p.peerID !== userId);
      peersRef.current = newPeers;
      setPeers(newPeers);
    });

    return () => {
      socket.off("rooms-list");
      socket.off("room-hosted");
      socket.off("room-joined");
      socket.off("user-joined");
      socket.off("call-made");
      socket.off("answer-made");
      socket.off("user-left");
    };
  }, [stream]);

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("call-user", {
        userToSignal,
        callerID,
        signal,
      });
    });

    peer.on("icecandidate", (candidate) => {
      socket.emit("ice-candidate", {
        to: userToSignal,
        candidate,
      });
    });

    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("make-answer", {
        answer: signal,
        to: callerID,
      });
    });

    peer.on("icecandidate", (candidate) => {
      socket.emit("ice-candidate", {
        to: callerID,
        candidate,
      });
    });

    peer.signal(incomingSignal);
    return peer;
  };

  const hostRoom = () => {
    socket.emit("host-room", { name: userName });
  };

  const findRooms = () => {
    socket.emit("get-rooms");
  };

  const joinRoom = (roomId) => {
    const key = prompt("Enter room key");
    if (key) {
      socket.emit("join-room", { roomId, key });
    }
  };

  const leaveRoom = () => {
    socket.emit("leave-room", { roomId: currentRoom.id });
    setCurrentRoom(null);
    peers.forEach((peer) => peer.destroy());
    setPeers([]);
    peersRef.current = [];
  };

  return (
    <div className="App">
      <h1>Verdi Live</h1>
      <div className="video-wrapper">
        <video muted ref={myVideo} autoPlay playsInline />
        {peers.map((peer, index) => {
          return <Video key={index} peer={peer} />;
        })}
      </div>
      {!currentRoom ? (
        <div className="controls">
          <input
            type="text"
            placeholder="Enter your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button onClick={hostRoom}>Host Live</button>
          <button onClick={findRooms}>Find Devices</button>
          <div className="rooms-list">
            {rooms.map((room) => (
              <div key={room.id} className="room">
                <span>{room.name}</span>
                <button onClick={() => joinRoom(room.id)}>Join</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="room-info">
          <h2>{currentRoom.name}</h2>
          <p>Room Key: {currentRoom.key}</p>
          <button onClick={leaveRoom}>Leave Room</button>
        </div>
      )}
    </div>
  );
}

const Video = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on("stream", (stream) => {
      ref.current.srcObject = stream;
    });
  }, [peer]);

  return <video playsInline autoPlay ref={ref} />;
};

export default App;
